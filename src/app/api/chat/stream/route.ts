import { streamRAGResponse } from '@/lib/langchain/chains/search-chain';
import { prisma } from '@/lib/prisma';
import { chatLimiter, getRequestIdentifier } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    // Rate limiting (same as standard /api/chat)
    const identifier = getRequestIdentifier(req as any);
    const rateResult = chatLimiter.check(identifier);
    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait before sending more messages.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const {
      chatbotId,
      conversationId,
      message,
      language = 'en',
      timezone,
      pageUrl,
      isReturning,
    } = await req.json();

    if (!message?.trim()) {
      return new Response('Message required', { status: 400 });
    }
    if (!chatbotId) {
      return new Response('Chatbot ID required', { status: 400 });
    }

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

    if (!chatbot.isPublished) {
      return new Response('Chatbot is not available', { status: 403 });
    }

    // Verify or create conversation
    let conversation = conversationId
      ? await prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;

    // If the provided conversationId doesn't exist or belongs to a different chatbot, start fresh
    if (conversation && conversation.chatbotId !== chatbotId) {
      conversation = null;
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { chatbotId, title: message.substring(0, 50) },
      });
    }

    // Save user message
    await prisma.message.create({
      data: { content: message, senderType: 'USER', conversationId: conversation.id },
    });

    const conversationIdFinal = conversation.id;
    const stringStream = await streamRAGResponse(
      chatbot,
      message,
      conversationIdFinal,
      undefined,
      language,
      { timezone, pageUrl, isReturning }
    );

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
          // NOTE: the bot message is persisted inside streamRAGResponse (it stores the
          // cleaned HTML with sources). Saving the raw stream here too would write a
          // second, duplicate bot message every turn and corrupt conversation history.
          controller.close();
        }
      },
    });

    return new Response(byteStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': conversationIdFinal,
      },
    });
  } catch (error) {
    console.error('Error processing streaming request:', error);
    return new Response('Failed to process request', { status: 500 });
  }
}
