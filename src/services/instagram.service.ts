import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";

function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date(Date.now() + 60000);
}

export interface InstagramPost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  timestamp: string;
  permalink: string;
  from: { id: string; username: string };
}

export interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username: string };
  parentMediaId: string;
  // If this comment is a reply to another comment, this is the root comment ID
  rootCommentId?: string;
}

export class InstagramService {
  private chatbotId: string;
  private accessToken: string | null = null;
  private instagramId: string | null = null;
  private connectionId: string | null = null;

  constructor(chatbotId: string) {
    this.chatbotId = chatbotId;
  }

  private async init() {
    const connection = await prisma.connections.findFirst({
      where: { chatbotId: this.chatbotId, platform: "INSTAGRAM" },
    });

    if (!connection) {
      throw new Error(
        `No Instagram connection found for chatbot: ${this.chatbotId}`
      );
    }

    let token = await decryptToken(connection.accessToken);

    if (connection.tokenExpiresAt && isTokenExpired(connection.tokenExpiresAt)) {
      token = await this.refreshToken(connection.id, token);
    }

    this.accessToken = token;
    this.instagramId = connection.platformUserId;
    this.connectionId = connection.id;
  }

  private async refreshToken(
    connectionId: string,
    currentToken: string
  ): Promise<string> {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`Token refresh failed: ${data.error?.message}`);

    const encryptedToken = await encryptToken(data.access_token);
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await prisma.connections.update({
      where: { id: connectionId },
      data: { accessToken: encryptedToken, tokenExpiresAt: expiresAt },
    });

    return data.access_token;
  }

  // ---------------------------------------------------------------------------
  // CONVERSATION HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Finds or creates a Conversation for a given Instagram comment thread.
   *
   * Strategy:
   *   - mediaId   = the Instagram post ID (groups all activity on a post)
   *   - Each root comment gets its own conversation, identified by
   *     metadata.rootCommentId so we can look it up cheaply.
   *   - userId    = the commenter's Instagram scoped ID (IGSID)
   */
  private async findOrCreateCommentConversation({
    rootCommentId,
    mediaId,
    userId,
    username,
  }: {
    rootCommentId: string;
    mediaId: string;
    userId?: string;
    username?: string;
  }) {
    // Try to find an existing conversation for this root comment
    const existing = await prisma.conversation.findFirst({
      where: {
        chatbotId: this.chatbotId,
        mediaId,
        // metadata stores the rootCommentId so we don't need a new DB column
        metadata: { path: ["rootCommentId"], equals: rootCommentId },
      },
    });

    if (existing) return existing;

    return prisma.conversation.create({
      data: {
        chatbotId: this.chatbotId,
        mediaId,
        userId,
        title: username ? `@${username} on post ${mediaId}` : undefined,
        metadata: { rootCommentId, platform: "INSTAGRAM" },
      },
    });
  }

  /**
   * Finds or creates a Conversation for a DM thread.
   * One conversation per (chatbot, userId) DM thread.
   */
  private async findOrCreateDMConversation({
    userId,
    username,
  }: {
    userId: string;
    username?: string;
  }) {
    const existing = await prisma.conversation.findFirst({
      where: {
        chatbotId: this.chatbotId,
        userId,
        mediaId: null, // DMs have no mediaId
        metadata: { path: ["platform"], equals: "INSTAGRAM_DM" },
      },
    });

    if (existing) return existing;

    return prisma.conversation.create({
      data: {
        chatbotId: this.chatbotId,
        userId,
        title: username ? `DM @${username}` : undefined,
        metadata: { platform: "INSTAGRAM_DM" },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // DEDUP CHECKS
  // ---------------------------------------------------------------------------

  /**
   * Returns true if we have already stored (and therefore replied to)
   * this exact Instagram comment ID.
   */
  private async hasAlreadyProcessedComment(commentId: string): Promise<boolean> {
    const msg = await prisma.message.findFirst({
      where: {
        // parentId holds the Instagram comment ID for comment-type messages
        parentId: commentId,
        senderType: "BOT",
        messageType: "COMMENT",
        conversation: { chatbotId: this.chatbotId },
      },
    });
    return !!msg;
  }

  /**
   * Returns true if we already sent a private reply (DM) originating
   * from this comment.
   */
  private async hasAlreadySentPrivateReply(commentId: string): Promise<boolean> {
    const msg = await prisma.message.findFirst({
      where: {
        parentId: commentId,
        senderType: "BOT",
        messageType: "PRIVATE_REPLY",
        conversation: { chatbotId: this.chatbotId },
      },
    });
    return !!msg;
  }

  // ---------------------------------------------------------------------------
  // STORE MESSAGES
  // ---------------------------------------------------------------------------

  /**
   * Persists an incoming user comment and the bot's comment reply
   * into the conversation thread for that root comment.
   */
  private async storeCommentExchange({
    comment,
    botReply,
  }: {
    comment: InstagramComment;
    botReply: string;
  }) {
    const rootCommentId = comment.rootCommentId ?? comment.id;

    const conversation = await this.findOrCreateCommentConversation({
      rootCommentId,
      mediaId: comment.parentMediaId,
      userId: comment.from?.id,
      username: comment.username ?? comment.from?.username,
    });

    // Store user comment
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: comment.text,
        senderType: "USER",
        messageType: "COMMENT",
        parentId: comment.id,           // Instagram comment ID
        senderId: comment.from?.id,
        senderName: comment.username ?? comment.from?.username,
      },
    });

    // Store bot reply
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: botReply,
        senderType: "BOT",
        messageType: "COMMENT",
        parentId: comment.id,           // same comment ID = "reply to this comment"
        recipientId: comment.from?.id,
      },
    });

    return conversation;
  }

  /**
   * Persists an incoming user comment and the bot's PRIVATE reply (DM)
   * that was triggered by that comment.
   */
  private async storePrivateReplyExchange({
    comment,
    botReply,
  }: {
    comment: InstagramComment;
    botReply: string;
  }) {
    // Private replies live in a DM conversation, not the comment thread
    const conversation = await this.findOrCreateDMConversation({
      userId: comment.from?.id ?? comment.id, // fallback if IGSID unavailable
      username: comment.username ?? comment.from?.username,
    });

    // Store user comment (source of the private reply trigger)
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: comment.text,
        senderType: "USER",
        messageType: "COMMENT",         // it was a comment that triggered this
        parentId: comment.id,
        senderId: comment.from?.id,
        senderName: comment.username ?? comment.from?.username,
      },
    });

    // Store bot's private reply
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: botReply,
        senderType: "BOT",
        messageType: "PRIVATE_REPLY",
        parentId: comment.id,           // which comment triggered this DM
        recipientId: comment.from?.id,
      },
    });

    return conversation;
  }

  /**
   * Persists a regular DM exchange.
   */
  private async storeDMExchange({
    userId,
    username,
    userMessage,
    botReply,
  }: {
    userId: string;
    username?: string;
    userMessage: string;
    botReply: string;
  }) {
    const conversation = await this.findOrCreateDMConversation({ userId, username });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: userMessage,
        senderType: "USER",
        messageType: "DIRECT_MESSAGE",
        senderId: userId,
        senderName: username,
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: botReply,
        senderType: "BOT",
        messageType: "DIRECT_MESSAGE",
        recipientId: userId,
      },
    });

    return conversation;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  async getRecentPosts(hours: number = 24): Promise<InstagramPost[]> {
    await this.init();
    const sinceTimestamp = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);

    const res = await fetch(
      `https://graph.instagram.com/v19.0/${this.instagramId}/media?fields=id,caption,media_type,media_url,timestamp,permalink&since=${sinceTimestamp}&access_token=${this.accessToken}`
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to fetch posts");
    return data.data;
  }

  async getRecentComments(hours: number = 24): Promise<InstagramComment[]> {
    await this.init();
    const sinceTimestamp = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);

    const mediaRes = await fetch(
      `https://graph.instagram.com/v19.0/${this.instagramId}/media?fields=id&limit=50&access_token=${this.accessToken}`
    );
    const mediaData = await mediaRes.json();
    if (!mediaRes.ok) throw new Error("Failed to fetch media for comments");

    const allRecentComments: InstagramComment[] = [];

    for (const media of mediaData.data) {
      const commentRes = await fetch(
        `https://graph.instagram.com/v19.0/${media.id}/comments?fields=id,text,timestamp,username,from{id,username}&access_token=${this.accessToken}`
      );
      const commentData = await commentRes.json();

      if (commentRes.ok && commentData.data) {
        const filtered = commentData.data.filter((comment: any) => {
          const commentTime = Math.floor(new Date(comment.timestamp).getTime() / 1000);
          return commentTime >= sinceTimestamp;
        });

        const commentsWithMeta = filtered.map((c: any) => ({
          ...c,
          parentMediaId: media.id,
          rootCommentId: c.id, // top-level comments are their own root
        }));

        allRecentComments.push(...commentsWithMeta);
      }
    }

    return allRecentComments.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Reply to a comment with dedup guard.
   * Returns null if already replied (skipped), otherwise returns the IG response.
   */
  async replyToComment(
    comment: InstagramComment,
    message: string
  ): Promise<{ igResponse: any; conversationId: string } | null> {
    await this.init();

    // --- DEDUP CHECK ---
    if (await this.hasAlreadyProcessedComment(comment.id)) {
      console.log(`[Instagram] Skipping already-replied comment: ${comment.id}`);
      return null;
    }

    const res = await fetch(
      `https://graph.instagram.com/v19.0/${comment.id}/replies?message=${encodeURIComponent(message)}&access_token=${this.accessToken}`,
      { method: "POST" }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to reply to comment");

    // --- STORE ---
    const conversation = await this.storeCommentExchange({ comment, botReply: message });

    return { igResponse: data, conversationId: conversation.id };
  }

  /**
   * Send a private reply (DM triggered by a comment) with dedup guard.
   * Returns null if already sent.
   */
  async sendPrivateReplyToComment(
    comment: InstagramComment,
    message: string
  ): Promise<{ igResponse: any; conversationId: string } | null> {
    await this.init();

    // --- DEDUP CHECK ---
    if (await this.hasAlreadySentPrivateReply(comment.id)) {
      console.log(
        `[Instagram] Skipping already-sent private reply for comment: ${comment.id}`
      );
      return null;
    }

    const res = await fetch(`https://graph.instagram.com/v19.0/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: comment.id },
        message: { text: message },
      }),
    });

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error?.message || "Failed to send private reply");

    // --- STORE ---
    const conversation = await this.storePrivateReplyExchange({
      comment,
      botReply: message,
    });

    return { igResponse: data, conversationId: conversation.id };
  }

  /**
   * Send a DM to a user with automatic conversation threading.
   */
  async sendDM(
    recipientId: string,
    text: string,
    options?: { username?: string; incomingMessage?: string }
  ): Promise<{ igResponse: any; conversationId: string }> {
    await this.init();

    const res = await fetch(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${this.accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to send DM");

    const conversation = await this.storeDMExchange({
      userId: recipientId,
      username: options?.username,
      userMessage: options?.incomingMessage ?? "(incoming DM)",
      botReply: text,
    });

    return { igResponse: data, conversationId: conversation.id };
  }

  async getConversations() {
    await this.init();
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/conversations?platform=instagram&access_token=${this.accessToken}`
    );
    return await res.json();
  }
}