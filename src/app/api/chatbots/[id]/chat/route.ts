import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { executeSearchChain, simpleSearch } from "@/lib/langchain/chains/search-chain";
import { chatLimiter, getRequestIdentifier } from "@/lib/rate-limit";

interface RouterParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouterParams
) {
  try {
    // Rate limit by IP — 30 messages per minute
    const identifier = getRequestIdentifier(request);
    const rateResult = chatLimiter.check(identifier);
    if (!rateResult.allowed) {
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

    const { id } = await context.params;
    if (!id) {
      return new NextResponse("Invalid ID", { status: 400 });
    }

    const {
      input,
      message,
      prompt, 
      model, 
      temperature, 
      max_tokens,
      context: requestContext,
      conversationId
    } = await request.json();

    // Use input or message field
    const userMessage = input || message;
    if (!userMessage?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Execute the search chain
    const result = await executeSearchChain({
      chatbotId: id,
      conversationId,
      userMessage,
    });

    const responseData: any = {
      message: result.response,
      response: result.response,
      conversationId: result.conversationId,
    };

    // Add request context to response if provided
    if (requestContext) {
      responseData.context = requestContext;
    }

    // Add logic triggers to response if any
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

    // Add knowledge context metadata if available (optional)
    if (result.knowledgeContext) {
      responseData.metadata = {
        hasKnowledgeBase: true,
        knowledgeSources: true
      };
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Error while generating: ", error);
    
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
    } else if (error.message?.includes('vector store')) {
      errorMessage = 'Knowledge base search error';
      statusCode = 502;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      },
      { status: statusCode }
    );
  }
}

// Add GET endpoint for simple search without conversation context
export async function GET(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return new NextResponse("Invalid ID", { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const limit = searchParams.get('limit');
    const threshold = searchParams.get('threshold');
    const includeKbNames = searchParams.get('includeKbNames');

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    // Perform simple search (just vector search, no LLM generation)
    const results = await simpleSearch(id, query, {
      limit: limit ? parseInt(limit) : 10,
      threshold: threshold ? parseFloat(threshold) : 0.65,
      includeKnowledgeBaseNames: includeKbNames === 'true'
    });

    return NextResponse.json({
      results,
      query,
      chatbotId: id,
      count: results.length,
      metadata: {
        searchType: 'vector-only',
        hasResults: results.length > 0
      }
    });

  } catch (error: any) {
    console.error("Error while searching: ", error);
    
    let errorMessage = 'Failed to perform search';
    let statusCode = 500;
    
    if (error.message?.includes('Chatbot not found')) {
      errorMessage = 'Chatbot not found';
      statusCode = 404;
    } else if (error.message?.includes('vector store')) {
      errorMessage = 'Knowledge base search error';
      statusCode = 502;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      },
      { status: statusCode }
    );
  }
}

// Optional: Add a health check endpoint
export async function HEAD(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return new NextResponse("Invalid ID", { status: 400 });
    }

    // Simple check if chatbot exists
    // Note: We're importing prisma here only for this endpoint
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!chatbot) {
      return new NextResponse("Chatbot not found", { status: 404 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Chatbot-Name': chatbot.name,
        'X-Chatbot-Status': 'active',
      }
    });
  } catch (error) {
    console.error("Health check error: ", error);
    return new NextResponse("Service unavailable", { status: 503 });
  }
}