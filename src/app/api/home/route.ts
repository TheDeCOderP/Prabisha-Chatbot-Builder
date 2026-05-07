// app/api/chatbots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BaseApiRoute } from "@/lib/api/base-api";

class ChatbotsRoute extends BaseApiRoute {
  // This endpoint is public - no authentication needed
  protected skipAuth(): boolean {
    return true;
  }

  // GET /api/chatbots - Get all published chatbots
  protected async GET(): Promise<NextResponse> {
    const chatbots = await this.dbOperation(() =>
      prisma.chatbot.findMany({
        where: {
          isPublished: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          avatar: true,
          model: true,
          createdAt: true,
          updatedAt: true,
          theme: true,
          domain: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    );

    return this.json({ chatbots });
  }
}

const route = new ChatbotsRoute();
export const GET = (req: NextRequest) => route.handle(req, { params: Promise.resolve({}) });