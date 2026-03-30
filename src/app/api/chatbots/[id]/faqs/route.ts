import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface RouterParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouterParams) {
  const { id } = await context.params;

  try {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id }
    });

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }
    
    const faqs = await prisma.questionCache.findMany({
      where: { chatbotId: id },
      select: {
        id: true,
        normalizedQ: true,
        htmlResponse: true,
      }
    });

    return NextResponse.json(faqs);
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
  }
}