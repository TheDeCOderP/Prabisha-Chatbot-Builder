import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";

function isTokenExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) return true;
    return new Date(expiresAt) < new Date(Date.now() + 60000); // 1 minute buffer
}

export class InstagramService {
  private chatbotId: string;
  private accessToken: string | null = null;
  private instagramId: string | null = null;

  constructor(chatbotId: string) {
    this.chatbotId = chatbotId;
  }

  /**
   * Initializes the service by fetching and decrypting the token from DB
   */
  private async init() {
    const connection = await prisma.connections.findFirst({
      where: {
        chatbotId: this.chatbotId,
        platform: 'INSTAGRAM'
      }
    });

    if (!connection) {
      throw new Error(`No Instagram connection found for chatbot: ${this.chatbotId}`);
    }

    // 1. Decrypt token
    let token = await decryptToken(connection.accessToken);

    // 2. Check for expiration and refresh if necessary
    if (connection.tokenExpiresAt && isTokenExpired(connection.tokenExpiresAt)) {
      token = await this.refreshToken(connection.id, token);
    }

    this.accessToken = token;
    this.instagramId = connection.platformUserId;
  }

  /**
   * Refresh a long-lived token (valid for another 60 days)
   */
  private async refreshToken(connectionId: string, currentToken: string): Promise<string> {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
    );
    const data = await res.json();

    if (!res.ok) throw new Error(`Token refresh failed: ${data.error?.message}`);

    const encryptedToken = await encryptToken(data.access_token);
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await prisma.connections.update({
      where: { id: connectionId },
      data: {
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt
      }
    });

    return data.access_token;
  }

  /**
   * Fetch posts (media) within a specific time period (e.g., last 24 hours)
   */
  async getRecentPosts(hours: number = 24) {
    await this.init();
    const sinceTimestamp = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);

    const res = await fetch(
      `https://graph.instagram.com/v19.0/${this.instagramId}/media?fields=id,caption,media_type,media_url,timestamp,permalink&since=${sinceTimestamp}&access_token=${this.accessToken}`
    );
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to fetch posts");
    
    return data.data; // Array of media objects
  }

  /**
   * Fetches comments from all recent posts within a specific time period
   */
  async getRecentComments(hours: number = 24) {
    await this.init();
    const sinceTimestamp = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);

    // 1. First, get all media items (posts) 
    // We fetch a larger limit to ensure we check all recently active posts
    const mediaRes = await fetch(
      `https://graph.instagram.com/v19.0/${this.instagramId}/media?fields=id&limit=50&access_token=${this.accessToken}`
    );
    const mediaData = await mediaRes.json();
    if (!mediaRes.ok) throw new Error("Failed to fetch media for comments");
console.log("Fetched media items for comments:", mediaData);
    const allRecentComments: any[] = [];

    // 2. Iterate through posts to get comments
    // Note: For production, consider using Promise.all for speed
    for (const media of mediaData.data) {
      const commentRes = await fetch(
        `https://graph.instagram.com/v19.0/${media.id}/comments?fields=id,text,timestamp,username&access_token=${this.accessToken}`
      );
      const commentData = await commentRes.json();
console.log(`Fetched comments for media ${media.id}:`, commentData);
      if (commentRes.ok && commentData.data) {
        // 3. Filter comments based on the timestamp
        const filtered = commentData.data.filter((comment: any) => {
          const commentTime = Math.floor(new Date(comment.timestamp).getTime() / 1000);
          return commentTime >= sinceTimestamp;
        });
        
        // Attach the parent media ID so you know which post the comment belongs to
        const commentsWithMeta = filtered.map((c: any) => ({
          ...c,
          parentMediaId: media.id
        }));

        allRecentComments.push(...commentsWithMeta);
      }
    }

    // Sort by newest first
    return allRecentComments.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Reply to a specific comment
   */
  async replyToComment(commentId: string, message: string) {
    await this.init();
    
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${commentId}/replies?message=${encodeURIComponent(message)}&access_token=${this.accessToken}`,
      { method: 'POST' }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to reply to comment");
    
    return data;
  }

  /**
   * Send a Direct Message (DM) to a user
   * Note: The recipient_id must be an IGSID (Instagram Scoped ID) 
   * obtained via the Webhook or the conversations API.
   */
  async sendDM(recipientId: string, text: string) {
    await this.init();

    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${this.accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: text }
        })
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to send DM");
    
    return data;
  }

  /**
   * Fetch latest conversations/DMs
   */
  async getConversations() {
    await this.init();
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/conversations?platform=instagram&access_token=${this.accessToken}`
    );
    return await res.json();
  }
}