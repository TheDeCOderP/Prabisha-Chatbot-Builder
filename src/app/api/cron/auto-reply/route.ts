// src/app/api/cron/auto-reply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { InstagramService } from "@/services/instagram.service";
import { LinkedInService } from "@/services/linkedin.service";

type Platform = "instagram" | "linkedin";
type Action =
  | "fetch"           // fetch + log posts/comments (no writes)
  | "reply_comment"   // reply to a specific comment by ID
  | "send_dm"         // send DM to a specific user (Instagram only)
  | "create_post"     // create a new post (LinkedIn only)
  | "process_all"     // full auto-reply run across all recent comments
  | "get_organizations" // get LinkedIn organizations
  | "get_analytics"   // get post analytics (LinkedIn only)
  | "get_stats";      // get organization stats (LinkedIn only)

export async function GET(req: NextRequest) {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = new URL(req.url).searchParams;

    // 2. Required params
    const chatbotId = q.get("chatbotId");
    if (!chatbotId) {
      return NextResponse.json({ error: "Missing chatbotId" }, { status: 400 });
    }

    const platform = (q.get("platform") ?? "instagram") as Platform;
    const action = (q.get("action") ?? "fetch") as Action;
    const hours = parseInt(q.get("hours") ?? "24");
    // dry=true → skips actual API calls and DB writes, returns what would happen
    const dry = q.get("dry") === "true";

    // Initialize services
    const instagram = platform === "instagram" ? new InstagramService(chatbotId) : null;
    const linkedin = platform === "linkedin" ? new LinkedInService(chatbotId) : null;

    // -----------------------------------------------------------------------
    // Instagram Actions
    // -----------------------------------------------------------------------
    if (platform === "instagram") {
      if (!instagram) {
        return NextResponse.json({ error: "Instagram service not initialized" }, { status: 500 });
      }

      // fetch — just pull posts + comments, no writes
      if (action === "fetch") {
        const [posts, comments] = await Promise.all([
          instagram.getRecentPosts(hours),
          instagram.getRecentComments(hours),
        ]);

        return NextResponse.json({
          platform,
          action,
          dry,
          count: { posts: posts.length, comments: comments.length },
          data: { posts, comments },
        });
      }

      // reply_comment — reply to a single comment
      if (action === "reply_comment") {
        const commentId = q.get("commentId");
        const message = q.get("message") ?? "Thank you for your comment!";

        if (!commentId) {
          return NextResponse.json(
            { error: "reply_comment requires ?commentId=..." },
            { status: 400 }
          );
        }

        if (dry) {
          return NextResponse.json({
            platform,
            action,
            dry,
            would: { replyToComment: commentId, with: message },
          });
        }

        const comments = await instagram.getRecentComments(hours);
        const comment = comments.find((c) => c.id === commentId);

        if (!comment) {
          return NextResponse.json(
            {
              error: `Comment ${commentId} not found in the last ${hours}h. Try increasing ?hours=`,
            },
            { status: 404 }
          );
        }

        const result = await instagram.replyToComment(comment, message);

        return NextResponse.json({
          platform,
          action,
          dry,
          skipped: result === null,
          reason: result === null ? "already_replied" : undefined,
          result,
        });
      }

      // send_dm — send a raw DM to a user by IGSID
      if (action === "send_dm") {
        const recipientId = q.get("recipientId");
        const message = q.get("message") ?? "Hello! This is a test DM.";
        const username = q.get("username") ?? undefined;

        if (!recipientId) {
          return NextResponse.json(
            { error: "send_dm requires ?recipientId=<IGSID>" },
            { status: 400 }
          );
        }

        if (dry) {
          return NextResponse.json({
            platform,
            action,
            dry,
            would: { sendDMTo: recipientId, username, with: message },
          });
        }

        const result = await instagram.sendDM(recipientId, message, { username });

        return NextResponse.json({ platform, action, dry, result });
      }

      // process_all — full auto-reply loop across all recent comments
      if (action === "process_all") {
        const replyMessage =
          q.get("message") ?? "Thank you for your comment! We'll be in touch.";
        const mode = (q.get("mode") ?? "comment") as
          | "comment"       // reply publicly to the comment
          | "private"       // slide into their DMs
          | "both";         // do both

        const comments = await instagram.getRecentComments(hours);

        const summary: {
          commentId: string;
          username?: string;
          text: string;
          commentReply?: "sent" | "skipped" | "dry";
          privateReply?: "sent" | "skipped" | "dry";
          error?: string;
        }[] = [];

        for (const comment of comments) {
          const entry: (typeof summary)[number] = {
            commentId: comment.id,
            username: comment.username ?? comment.from?.username,
            text: comment.text,
          };

          try {
            if (mode === "comment" || mode === "both") {
              if (dry) {
                entry.commentReply = "dry";
              } else {
                const r = await instagram.replyToComment(comment, replyMessage);
                entry.commentReply = r === null ? "skipped" : "sent";
              }
            }

            if (mode === "private" || mode === "both") {
              if (dry) {
                entry.privateReply = "dry";
              } else {
                const r = await instagram.sendPrivateReplyToComment(
                  comment,
                  replyMessage
                );
                entry.privateReply = r === null ? "skipped" : "sent";
              }
            }
          } catch (err: any) {
            entry.error = err.message;
          }

          summary.push(entry);
        }

        const sent = summary.filter(
          (s) => s.commentReply === "sent" || s.privateReply === "sent"
        ).length;
        const skipped = summary.filter(
          (s) => s.commentReply === "skipped" || s.privateReply === "skipped"
        ).length;
        const errors = summary.filter((s) => s.error).length;

        return NextResponse.json({
          platform,
          action,
          dry,
          mode,
          hours,
          count: { total: comments.length, sent, skipped, errors },
          summary,
        });
      }
    }

    // -----------------------------------------------------------------------
    // LinkedIn Actions
    // -----------------------------------------------------------------------
    if (platform === "linkedin") {
      if (!linkedin) {
        return NextResponse.json({ error: "LinkedIn service not initialized" }, { status: 500 });
      }

      // get_organizations — list organizations user can manage
      if (action === "get_organizations") {
        const organizations = await linkedin.getOrganizations();
        return NextResponse.json({
          platform,
          action,
          dry,
          count: organizations.length,
          organizations,
        });
      }

      // fetch — pull recent posts and comments
      if (action === "fetch") {
        const [posts, comments] = await Promise.all([
          linkedin.getRecentPosts(hours),
          linkedin.getRecentComments(hours),
        ]);

        return NextResponse.json({
          platform,
          action,
          dry,
          count: { posts: posts.length, comments: comments.length },
          data: { posts, comments },
        });
      }

      // reply_comment — reply to a specific comment
      if (action === "reply_comment") {
        const commentId = q.get("commentId");
        const message = q.get("message") ?? "Thank you for your comment!";

        if (!commentId) {
          return NextResponse.json(
            { error: "reply_comment requires ?commentId=..." },
            { status: 400 }
          );
        }

        if (dry) {
          return NextResponse.json({
            platform,
            action,
            dry,
            would: { replyToComment: commentId, with: message },
          });
        }

        const comments = await linkedin.getRecentComments(hours);
        const comment = comments.find((c) => c.id === commentId);

        if (!comment) {
          return NextResponse.json(
            {
              error: `Comment ${commentId} not found in the last ${hours}h. Try increasing ?hours=`,
            },
            { status: 404 }
          );
        }

        const result = await linkedin.replyToComment(comment, message);

        return NextResponse.json({
          platform,
          action,
          dry,
          skipped: result === null,
          reason: result === null ? "already_replied" : undefined,
          result,
        });
      }

      // create_post — create a new post (LinkedIn only)
      if (action === "create_post") {
        const content = q.get("content");
        const visibility = (q.get("visibility") ?? "PUBLIC") as "PUBLIC" | "CONNECTIONS";

        if (!content) {
          return NextResponse.json(
            { error: "create_post requires ?content=..." },
            { status: 400 }
          );
        }

        if (dry) {
          return NextResponse.json({
            platform,
            action,
            dry,
            would: { createPost: content, visibility },
          });
        }

        const result = await linkedin.createPost(content, visibility);

        return NextResponse.json({
          platform,
          action,
          dry,
          result,
        });
      }

      // get_analytics — get post analytics
      if (action === "get_analytics") {
        const postId = q.get("postId");

        if (!postId) {
          return NextResponse.json(
            { error: "get_analytics requires ?postId=..." },
            { status: 400 }
          );
        }

        const analytics = await linkedin.getPostAnalytics(postId);

        return NextResponse.json({
          platform,
          action,
          dry,
          analytics,
        });
      }

      // get_stats — get organization statistics
      if (action === "get_stats") {
        const [followersCount, orgStats] = await Promise.all([
          linkedin.getFollowersCount(),
          linkedin.getOrganizationStatistics(),
        ]);

        return NextResponse.json({
          platform,
          action,
          dry,
          followers: followersCount,
          statistics: orgStats,
        });
      }

      // process_all — full auto-reply loop across all recent comments
      if (action === "process_all") {
        const replyMessage =
          q.get("message") ?? "Thank you for your comment! We appreciate your engagement.";

        const comments = await linkedin.getRecentComments(hours);

        const summary: {
          commentId: string;
          authorName?: string;
          text: string;
          reply?: "sent" | "skipped" | "dry";
          error?: string;
        }[] = [];

        for (const comment of comments) {
          const entry: (typeof summary)[number] = {
            commentId: comment.id,
            authorName: comment.author.name,
            text: comment.text,
          };

          try {
            if (dry) {
              entry.reply = "dry";
            } else {
              const r = await linkedin.replyToComment(comment, replyMessage);
              entry.reply = r === null ? "skipped" : "sent";
            }
          } catch (err: any) {
            entry.error = err.message;
          }

          summary.push(entry);
        }

        const sent = summary.filter((s) => s.reply === "sent").length;
        const skipped = summary.filter((s) => s.reply === "skipped").length;
        const errors = summary.filter((s) => s.error).length;

        return NextResponse.json({
          platform,
          action,
          dry,
          hours,
          count: { total: comments.length, sent, skipped, errors },
          summary,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Unknown action or platform
    // -----------------------------------------------------------------------
    return NextResponse.json(
      {
        error: `Invalid combination: platform="${platform}", action="${action}"`,
        valid_platforms: ["instagram", "linkedin"],
        valid_actions: {
          instagram: ["fetch", "reply_comment", "send_dm", "process_all"],
          linkedin: ["fetch", "reply_comment", "create_post", "get_organizations", "get_analytics", "get_stats", "process_all"],
        },
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error(`${error.message.includes("Instagram") ? "Instagram" : "LinkedIn"} auto-reply error:`, error.message);

    if (error.message?.includes("No connection found")) {
      return NextResponse.json({ error: "Account not connected" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}