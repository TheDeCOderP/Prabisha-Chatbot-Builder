// src/app/api/cron/auto-reply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { InstagramService } from '@/services/instagram.service';

export async function GET(
  req: NextRequest,
) {
  try {
    // 1. Session Validation
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const query = url.searchParams;

    const chatbotId = query.get('chatbotId') as string;
    if (!chatbotId) {
      return NextResponse.json({ error: "Missing chatbotId" }, { status: 400 });
    }

    // Allow dynamic hours (defaulting to 24)
    const hours = parseInt(query.get('hours') || '24');

    // 2. Initialize the Service
    // The service handles DB retrieval, decryption, and token refreshing internally
    const instagram = new InstagramService(chatbotId);

    // 3. Fetch Posts
    const posts = await instagram.getRecentPosts(hours);

    const comments = await instagram.getRecentComments(hours);

    return NextResponse.json({
      success: true,
      count: {
        posts: posts.length,
        comments: comments.length
      },
      data: {
        posts,
        comments
      }
    });

  } catch (error: any) {
    console.error("Instagram Fetch Error:", error.message);
    
    // Handle specific case where connection doesn't exist
    if (error.message.includes("No Instagram connection found")) {
      return NextResponse.json({ error: "Account not connected" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Internal Server Error", details: error.message }, 
      { status: 500 }
    );
  }
}