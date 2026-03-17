import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const query = url.searchParams;

    const chatbotId = query.get('chatbotId') as string;
    if (!chatbotId) {
      return NextResponse.json({ error: "Missing chatbotId" }, { status: 400 });
    }

    const connections = await prisma.connections.findMany({
      where: { chatbotId },
    });
    
    return NextResponse.json({ success: true, connections }); 
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } 
}