// src/app/api/cron/auto-reply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { InstagramService } from "@/services/instagram.service";

type Action =
  | "fetch"           // fetch + log posts/comments (no writes)
  | "reply_comment"   // reply to a specific comment by ID
  | "private_reply"   // send private reply to a specific comment by ID
  | "send_dm"         // send DM to a specific user by IGSID
  | "process_all";    // full auto-reply run across all recent comments

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

    const action = (q.get("action") ?? "fetch") as Action;
    const hours = parseInt(q.get("hours") ?? "24");
    // dry=true → skips actual Instagram API calls and DB writes, returns what would happen
    const dry = q.get("dry") === "true";

    const instagram = new InstagramService(chatbotId);

    // -----------------------------------------------------------------------
    // fetch — just pull posts + comments, no writes
    // -----------------------------------------------------------------------
    if (action === "fetch") {
      const [posts, comments] = await Promise.all([
        instagram.getRecentPosts(hours),
        instagram.getRecentComments(hours),
      ]);

      return NextResponse.json({
        action,
        dry,
        count: { posts: posts.length, comments: comments.length },
        data: { posts, comments },
      });
    }

    // -----------------------------------------------------------------------
    // reply_comment — reply to a single comment (test specific comment IDs)
    // -----------------------------------------------------------------------
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
          action,
          dry,
          would: { replyToComment: commentId, with: message },
        });
      }

      // Build a minimal InstagramComment shape for the service
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
        action,
        dry,
        skipped: result === null,
        reason: result === null ? "already_replied" : undefined,
        result,
      });
    }

    // -----------------------------------------------------------------------
    // private_reply — send private DM triggered by a comment
    // -----------------------------------------------------------------------
    if (action === "private_reply") {
      const commentId = q.get("commentId");
      const message = q.get("message") ?? "Hi! Sending you a quick private note.";

      if (!commentId) {
        return NextResponse.json(
          { error: "private_reply requires ?commentId=..." },
          { status: 400 }
        );
      }

      if (dry) {
        return NextResponse.json({
          action,
          dry,
          would: { privateReplyToComment: commentId, with: message },
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

      const result = await instagram.sendPrivateReplyToComment(comment, message);

      return NextResponse.json({
        action,
        dry,
        skipped: result === null,
        reason: result === null ? "already_sent_private_reply" : undefined,
        result,
      });
    }

    // -----------------------------------------------------------------------
    // send_dm — send a raw DM to a user by IGSID
    // -----------------------------------------------------------------------
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
          action,
          dry,
          would: { sendDMTo: recipientId, username, with: message },
        });
      }

      const result = await instagram.sendDM(recipientId, message, { username });

      return NextResponse.json({ action, dry, result });
    }

    // -----------------------------------------------------------------------
    // process_all — full auto-reply loop across all recent comments
    //               This is what the real cron job will run
    // -----------------------------------------------------------------------
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
        action,
        dry,
        mode,
        hours,
        count: { total: comments.length, sent, skipped, errors },
        summary,
      });
    }

    // -----------------------------------------------------------------------
    // Unknown action
    // -----------------------------------------------------------------------
    return NextResponse.json(
      {
        error: `Unknown action: "${action}"`,
        valid_actions: ["fetch", "reply_comment", "private_reply", "send_dm", "process_all"],
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Instagram auto-reply error:", error.message);

    if (error.message?.includes("No Instagram connection found")) {
      return NextResponse.json({ error: "Account not connected" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}