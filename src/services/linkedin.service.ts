// src/services/linkedin.service.ts
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";

function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date(Date.now() + 60000);
}

export interface LinkedInPost {
  id: string;
  text?: string;
  author: {
    id: string;
    name?: string;
  };
  created: string;
  lastModified?: string;
  lifecycleState: string;
  visibility: string;
  totalReactions?: number;
  totalComments?: number;
}

export interface LinkedInComment {
  id: string;
  text: string;
  created: string;
  author: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
  parentMediaId: string;
  rootCommentId?: string;
  parentCommentId?: string;
}

export interface LinkedInOrganization {
  id: string;
  name: string;
  localizedName?: string;
  vanityName?: string;
  logoUrl?: string;
}

export class LinkedInService {
  private chatbotId: string;
  private accessToken: string | null = null;
  private organizationId: string | null = null;
  private connectionId: string | null = null;

  constructor(chatbotId: string) {
    this.chatbotId = chatbotId;
  }

  private async init() {
    const connection = await prisma.connections.findFirst({
      where: { chatbotId: this.chatbotId, platform: "LINKEDIN" },
    });

    if (!connection) {
      throw new Error(
        `No LinkedIn connection found for chatbot: ${this.chatbotId}`
      );
    }

    let token = await decryptToken(connection.accessToken);

    if (connection.tokenExpiresAt && isTokenExpired(connection.tokenExpiresAt)) {
      token = await this.refreshToken(connection.id, token);
    }

    this.accessToken = token;
    this.organizationId = connection.platformUserId;
    this.connectionId = connection.id;
  }

  private async refreshToken(
    connectionId: string,
    currentToken: string
  ): Promise<string> {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: currentToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Token refresh failed: ${data.error_description}`);

    const encryptedToken = await encryptToken(data.access_token);
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await prisma.connections.update({
      where: { id: connectionId },
      data: { accessToken: encryptedToken, tokenExpiresAt: expiresAt },
    });

    return data.access_token;
  }

  // ---------------------------------------------------------------------------
  // ORGANIZATION HELPERS
  // ---------------------------------------------------------------------------

  async getOrganizations(): Promise<LinkedInOrganization[]> {
    await this.init();

    try {
      const res = await fetch(
        "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignment&role=ADMINISTRATOR&state=APPROVED",
        {
          headers: { 
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to fetch organizations: ${errorData.message || res.status}`);
      }

      const data = await res.json();
      const organizations: LinkedInOrganization[] = [];

      if (data.elements) {
        for (const element of data.elements) {
          const orgId = element.organizationalTarget?.split(':').pop();
          if (orgId) {
            const orgRes = await fetch(
              `https://api.linkedin.com/v2/organizations/${orgId}`,
              {
                headers: { 
                  Authorization: `Bearer ${this.accessToken}`,
                },
              }
            );

            if (orgRes.ok) {
              const orgData = await orgRes.json();
              organizations.push({
                id: orgData.id,
                name: orgData.localizedName || orgData.name,
                localizedName: orgData.localizedName,
                vanityName: orgData.vanityName,
                logoUrl: orgData.logoV2?.original,
              });
            }
          }
        }
      }

      return organizations;
    } catch (error) {
      console.error("Error fetching organizations:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // CONVERSATION HELPERS
  // ---------------------------------------------------------------------------

  private async findOrCreateCommentConversation({
    rootCommentId,
    postId,
    userId,
    userName,
  }: {
    rootCommentId: string;
    postId: string;
    userId?: string;
    userName?: string;
  }) {
    const existing = await prisma.conversation.findFirst({
      where: {
        chatbotId: this.chatbotId,
        mediaId: postId,
        metadata: { path: ["rootCommentId"], equals: rootCommentId },
      },
    });

    if (existing) return existing;

    return prisma.conversation.create({
      data: {
        chatbotId: this.chatbotId,
        mediaId: postId,
        userId,
        title: userName ? `${userName} on post ${postId}` : undefined,
        metadata: { rootCommentId, platform: "LINKEDIN" },
      },
    });
  }

  private async hasAlreadyProcessedComment(commentId: string): Promise<boolean> {
    const msg = await prisma.message.findFirst({
      where: {
        parentId: commentId,
        senderType: "BOT",
        messageType: "COMMENT",
        conversation: { chatbotId: this.chatbotId },
      },
    });
    return !!msg;
  }

  private async storeCommentExchange({
    comment,
    botReply,
  }: {
    comment: LinkedInComment;
    botReply: string;
  }) {
    const rootCommentId = comment.rootCommentId ?? comment.id;

    const conversation = await this.findOrCreateCommentConversation({
      rootCommentId,
      postId: comment.parentMediaId,
      userId: comment.author.id,
      userName: comment.author.name,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: comment.text,
        senderType: "USER",
        messageType: "COMMENT",
        parentId: comment.id,
        senderId: comment.author.id,
        senderName: comment.author.name,
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: botReply,
        senderType: "BOT",
        messageType: "COMMENT",
        parentId: comment.id,
        recipientId: comment.author.id,
      },
    });

    return conversation;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API - FIXED WITH CORRECT API PATHS
  // ---------------------------------------------------------------------------

  async getRecentPosts(hours: number = 24): Promise<LinkedInPost[]> {
    await this.init();
    
    try {
      // Correct endpoint for getting organization posts
      const endpoint = `https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:organization:${this.organizationId}`;
      
      console.log("Fetching posts from:", endpoint);
      
      const res = await fetch(endpoint, {
        headers: { 
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("LinkedIn API error:", errorData);
        throw new Error(errorData.message || `Failed to fetch posts: ${res.status}`);
      }

      const data = await res.json();
      const posts: LinkedInPost[] = [];
      
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      if (data.elements) {
        for (const element of data.elements) {
          const created = new Date(element.created);
          
          if (created >= cutoffTime) {
            // Get social actions (likes, comments) for each post
            let totalReactions = 0;
            let totalComments = 0;
            
            try {
              const socialRes = await fetch(
                `https://api.linkedin.com/v2/socialActions/${element.id}`,
                {
                  headers: { 
                    Authorization: `Bearer ${this.accessToken}`,
                  },
                }
              );
              
              if (socialRes.ok) {
                const socialData = await socialRes.json();
                totalReactions = socialData.likesSummary?.totalLikes || 0;
                totalComments = socialData.commentsSummary?.totalFirstLevelComments || 0;
              }
            } catch (error) {
              console.error(`Failed to fetch social actions for post ${element.id}:`, error);
            }
            
            posts.push({
              id: element.id,
              text: element.commentary?.text,
              author: {
                id: element.author,
                name: this.organizationId as string, // We can enhance this by fetching organization details if needed
              },
              created: element.created,
              lastModified: element.lastModified,
              lifecycleState: element.lifecycleState,
              visibility: element.visibility?.code || "PUBLIC",
              totalReactions,
              totalComments,
            });
          }
        }
      }

      console.log(`Found ${posts.length} posts in the last ${hours} hours`);
      return posts;
    } catch (error) {
      console.error("Error fetching LinkedIn posts:", error);
      throw error;
    }
  }

  async getRecentComments(hours: number = 24): Promise<LinkedInComment[]> {
    await this.init();
    
    try {
      const posts = await this.getRecentPosts(hours * 24);
      const allRecentComments: LinkedInComment[] = [];
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      for (const post of posts) {
        try {
          // Get comments using the socialActions endpoint
          const commentsRes = await fetch(
            `https://api.linkedin.com/v2/socialActions/${post.id}/comments?q=comments&count=100`,
            {
              headers: { 
                Authorization: `Bearer ${this.accessToken}`,
              },
            }
          );
          
          if (!commentsRes.ok) {
            console.error(`Failed to fetch comments for post ${post.id}: ${commentsRes.status}`);
            continue;
          }
          
          const commentsData = await commentsRes.json();

          if (commentsData.elements) {
            for (const comment of commentsData.elements) {
              const commentTime = new Date(comment.created);
              
              if (commentTime >= cutoffTime) {
                // Parse author info from the actor
                const authorId = comment.actor?.split(':').pop() || comment.actor;
                let authorName = authorId;
                let firstName, lastName;
                
                // Try to get author details
                try {
                  const authorRes = await fetch(
                    `https://api.linkedin.com/v2/people/${authorId}`,
                    {
                      headers: { 
                        Authorization: `Bearer ${this.accessToken}`,
                      },
                    }
                  );
                  if (authorRes.ok) {
                    const authorData = await authorRes.json();
                    firstName = authorData.localizedFirstName || authorData.firstName?.localized?.en_US;
                    lastName = authorData.localizedLastName || authorData.lastName?.localized?.en_US;
                    if (firstName && lastName) {
                      authorName = `${firstName} ${lastName}`;
                    } else if (firstName) {
                      authorName = firstName;
                    }
                  }
                } catch (error) {
                  console.error(`Failed to fetch author for comment ${comment.id}:`, error);
                }
                
                allRecentComments.push({
                  id: comment.id,
                  text: comment.text || comment.commentary?.text || "",
                  created: comment.created,
                  author: {
                    id: comment.actor,
                    name: authorName,
                    firstName,
                    lastName,
                  },
                  parentMediaId: post.id,
                  rootCommentId: comment.id,
                  parentCommentId: comment.parentCommentId,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error processing comments for post ${post.id}:`, error);
        }
      }

      console.log(`Found ${allRecentComments.length} comments in the last ${hours} hours`);
      return allRecentComments.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );
    } catch (error) {
      console.error("Error fetching LinkedIn comments:", error);
      throw error;
    }
  }

  async replyToComment(
    comment: LinkedInComment,
    message: string
  ): Promise<{ response: any; conversationId: string } | null> {
    await this.init();

    if (await this.hasAlreadyProcessedComment(comment.id)) {
      console.log(`[LinkedIn] Skipping already-replied comment: ${comment.id}`);
      return null;
    }
    
    try {
      const authorUrn = `urn:li:organization:${this.organizationId}`;
      
      // Format the parent comment URN properly for reply
      let parentCommentUrn = comment.id;
      if (!parentCommentUrn.startsWith('urn:li:comment:')) {
        // Extract the numeric ID from the comment
        const numericId = parentCommentUrn.match(/\d+$/)?.[0] || parentCommentUrn;
        // Format as comment URN
        parentCommentUrn = `urn:li:comment:(${comment.parentMediaId},${numericId})`;
      }

      console.log("Replying to comment with:", {
        parentCommentUrn,
        postId: comment.parentMediaId,
        message
      });

      // Use the socialActions endpoint for posting replies
      const apiUrl = `https://api.linkedin.com/v2/socialActions/${comment.parentMediaId}/comments`;

      const requestBody = {
        actor: authorUrn,
        message: {
          text: message
        },
        parentComment: parentCommentUrn
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("LinkedIn reply error:", {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
          requestBody
        });
        throw new Error(`Failed to reply to comment: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      const conversation = await this.storeCommentExchange({ comment, botReply: message });

      return { response: data, conversationId: conversation.id };
    } catch (error) {
      console.error("Error replying to LinkedIn comment:", error);
      throw error;
    }
  }

  async createPost(
    content: string,
    visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC"
  ): Promise<any> {
    await this.init();

    try {
      const postData = {
        author: `urn:li:organization:${this.organizationId}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": visibility,
        },
      };

      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(postData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to create post: ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Error creating LinkedIn post:", error);
      throw error;
    }
  }

  async getPostAnalytics(postId: string): Promise<any> {
    await this.init();

    try {
      const res = await fetch(
        `https://api.linkedin.com/v2/socialActions/${postId}`,
        {
          headers: { 
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to fetch analytics: ${res.status}`);
      }

      const data = await res.json();
      
      return {
        postId,
        likes: data.likesSummary?.totalLikes || 0,
        comments: data.commentsSummary?.totalFirstLevelComments || 0,
      };
    } catch (error) {
      console.error("Error fetching LinkedIn analytics:", error);
      throw error;
    }
  }

  async getFollowersCount(): Promise<number> {
    await this.init();

    try {
      const res = await fetch(
        `https://api.linkedin.com/v2/organizationalEntityFollowers?q=organizationalEntity&organizationalEntity=urn:li:organization:${this.organizationId}&count=0`,
        {
          headers: { 
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to fetch followers: ${res.status}`);
      }

      const data = await res.json();
      return data.paging?.total || 0;
    } catch (error) {
      console.error("Error fetching LinkedIn followers:", error);
      throw error;
    }
  }

  async getOrganizationStatistics(): Promise<any> {
    await this.init();

    try {
      const res = await fetch(
        `https://api.linkedin.com/v2/organizationPageStatistics?q=organization&organization=urn:li:organization:${this.organizationId}`,
        {
          headers: { 
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to fetch statistics: ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Error fetching LinkedIn statistics:", error);
      throw error;
    }
  }
}