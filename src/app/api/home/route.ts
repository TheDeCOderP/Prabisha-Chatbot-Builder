import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Fetch all chatbots for the current workspace
export async function GET(request: NextRequest) {
  try {
    const chatbots = await prisma.chatbot.findMany({
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
    });

    return NextResponse.json({ chatbots });
  } catch (error) {
    console.error("Error fetching chatbots:", error);
    return NextResponse.json(
      { error: "Failed to fetch chatbots" },
      { status: 500 }
    );
  }
}