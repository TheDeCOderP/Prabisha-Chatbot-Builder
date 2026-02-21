import { streamRAGResponse } from '@/lib/langchain/chains/search-chain';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { chatbotId, conversationId, message } = await req.json();

    const chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId },
        include: {
        knowledgeBases: { include: { documents: true } },
        logic: true,
        form: true
        }
    });

    if (!chatbot) {
        return new Response('Chatbot not found', { status: 404 });
    }

    // Create/get conversation and store user message
    let conversation = conversationId
        ? await prisma.conversation.findUnique({ where: { id: conversationId } })
        : null;

    if (!conversation) {
        conversation = await prisma.conversation.create({
        data: { chatbotId, title: message.substring(0, 50) }
        });
    }

    await prisma.message.create({
        data: { content: message, senderType: 'USER', conversationId: conversation.id }
    });

    const stream = await streamRAGResponse(chatbot, message, conversation.id);

    return new Response(stream, {
        headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': conversation.id,
        }
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response('Failed to process request', { status: 500 });
  }
}