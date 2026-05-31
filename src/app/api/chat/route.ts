// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { executeSearchChain, simpleSearch } from '@/lib/langchain/chains/search-chain';
import { chatLimiter, getRequestIdentifier } from '@/lib/rate-limit';

function timer(label: string) {
  const start = Date.now();
  return {
    end: () => {
      const ms = Date.now() - start;
      console.log(`⏱️ [API /chat] ${label}: ${ms}ms`);
      return ms;
    }
  };
}

export async function POST(request: NextRequest) {
  const tTotal = timer('POST [total]');
  try {
    // Rate limit by IP — 30 messages per minute
    const identifier = getRequestIdentifier(request);
    const rateResult = chatLimiter.check(identifier);
    if (!rateResult.allowed) {
      tTotal.end();
      return NextResponse.json(
        { error: 'Too many requests. Please wait before sending more messages.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const tParse = timer('parse request body');
    const body = await request.json();
    tParse.end();

    const message = body.message || body.input;
    const chatbotId = body.chatbotId;
    let conversationId = body.conversationId;
    const language: string = body.language || 'en';
    const clientContext = {
      timezone: body.timezone,
      pageUrl: body.pageUrl,
      isReturning: body.isReturning,
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    if (!chatbotId) {
      return NextResponse.json({ error: 'Chatbot ID required' }, { status: 400 });
    }

    const tChatbotFetch = timer('prisma: fetch chatbot');
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        knowledgeBases: {
          select: { id: true, name: true }
        },
        logic: true,
        form: true
      }
    });
    tChatbotFetch.end();

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    if (!chatbot.isPublished) {
      return NextResponse.json({ error: 'Chatbot is not available' }, { status: 403 });
    }

    if (conversationId) {
      const tConvCheck = timer('prisma: verify conversation');
      const existingConversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      });
      tConvCheck.end();

      if (!existingConversation) {
        conversationId = null;
      } else if (existingConversation.chatbotId !== chatbotId) {
        return NextResponse.json(
          { error: 'Conversation does not belong to this chatbot' },
          { status: 403 }
        );
      }
    }

    const tChain = timer('executeSearchChain');
    const result = await executeSearchChain({
      chatbotId,
      conversationId,
      userMessage: message,
      chatbot,
      language,
      clientContext,
    });
    tChain.end();

    const responseData: any = {
      message: result.response,
      response: result.response,
      conversationId: result.conversationId,
    };

    if (result.triggeredLogics?.length) {
      responseData.logicTriggers = result.triggeredLogics.map(logic => ({
        id: logic.id,
        type: logic.type,
        name: logic.name,
        config: logic.config,
        linkButton: logic.linkButton,
        meetingSchedule: logic.meetingSchedule,
        leadCollection: logic.leadCollection
      }));
    }

    if (result.sourceUrls?.length) {
      responseData.sourceUrls = result.sourceUrls;
    }

    tTotal.end();
    return NextResponse.json(responseData);

  } catch (error: any) {
    tTotal.end();
    console.error('Chat API error:', error);

    let errorMessage = 'Failed to process message';
    let statusCode = 500;

    if (error.message?.includes('Chatbot not found')) {
      errorMessage = 'Chatbot not found';
      statusCode = 404;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'AI service configuration error';
      statusCode = 503;
    } else if (error.message?.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded';
      statusCode = 429;
    }

    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: statusCode }
    );
  }
}

export async function GET(request: NextRequest) {
  const tTotal = timer('GET [total]');
  try {
    // Conversation history endpoint requires authentication to prevent
    // unauthenticated reads of conversation content.
    const token = await getToken({ req: request });
    if (!token?.sub) {
      tTotal.end();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const chatbotId = searchParams.get('chatbotId');
    const conversationId = searchParams.get('conversationId');
    // Pagination: ?cursor=<lastMessageId>&limit=<n> (default 50, max 100)
    const cursor = searchParams.get('cursor') ?? undefined;
    const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Math.min(isNaN(limitRaw) ? 50 : limitRaw, 100);

    if (!query || !chatbotId) {
      return NextResponse.json({ error: 'query and chatbotId required' }, { status: 400 });
    }

    if (conversationId) {
      const tConv = timer('prisma: fetch conversation with messages');
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: limit + 1, // fetch one extra to determine if there are more pages
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          },
        },
      });
      tConv.end();

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      if (conversation.chatbotId !== chatbotId) {
        return NextResponse.json(
          { error: 'Conversation does not belong to this chatbot' },
          { status: 403 }
        );
      }

      const hasMore = conversation.messages.length > limit;
      const messages = hasMore ? conversation.messages.slice(0, limit) : conversation.messages;
      const nextCursor = hasMore ? messages[messages.length - 1].id : null;

      tTotal.end();
      return NextResponse.json({
        data: messages,
        conversationId: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        pagination: {
          hasMore,
          nextCursor,
          limit,
        },
      });
    } else {
      const tSearch = timer('simpleSearch');
      const results = await simpleSearch(chatbotId, query, {
        limit: parseInt(searchParams.get('limit') || '10'),
        threshold: parseFloat(searchParams.get('threshold') || '0.65'),
        includeKnowledgeBaseNames: searchParams.get('includeKbNames') === 'true'
      });
      tSearch.end();

      tTotal.end();
      return NextResponse.json({ results, query, chatbotId, count: results.length });
    }

  } catch (error) {
    tTotal.end();
    console.error('Error in GET:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const tTotal = timer('PUT [total]');
  try {
    const token = await getToken({ req: request });
    if (!token?.sub) {
      tTotal.end();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, isActive, metadata } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    // Verify the caller is a workspace member of the chatbot that owns this conversation
    const tOwnership = timer('prisma: verify conversation ownership');
    const owned = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatbot: {
          workspace: {
            members: { some: { userId: token.sub } },
          },
        },
      },
      select: { id: true },
    });
    tOwnership.end();

    if (!owned) {
      tTotal.end();
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
    }

    const tUpdate = timer('prisma: update conversation');
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(metadata && { metadata }),
        ...(isActive === false && { endedAt: new Date() })
      }
    });
    tUpdate.end();

    tTotal.end();
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      isActive: conversation.isActive,
      endedAt: conversation.endedAt
    });

  } catch (error) {
    tTotal.end();
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}