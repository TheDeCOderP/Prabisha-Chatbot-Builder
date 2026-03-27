import { streamRAGResponse } from '@/lib/langchain/chains/search-chain';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { chatbotId, conversationId, message, language = 'en', timezone, pageUrl, isReturning } = await req.json();

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        knowledgeBases: { select: { id: true, name: true } },
        logic: true,
        form: true,
      },
    });

    if (!chatbot) {
      return new Response('Chatbot not found', { status: 404 });
    }

    let conversation = conversationId
      ? await prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { chatbotId, title: message.substring(0, 50) },
      });
    }

    await prisma.message.create({
      data: { content: message, senderType: 'USER', conversationId: conversation.id },
    });

    const stringStream = await streamRAGResponse(chatbot, message, conversation.id, undefined, language, { timezone, pageUrl, isReturning });

    // Encode string chunks to Uint8Array so Response can stream them correctly
    const encoder = new TextEncoder();
    const byteStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = stringStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(encoder.encode(value));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(byteStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': conversation.id,
      },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response('Failed to process request', { status: 500 });
  }
}
