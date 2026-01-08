// app/api/chat/route.ts
import { searchSimilar } from '@/lib/langchain/vector-store';
import { NextRequest, NextResponse } from 'next/server';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { generateText } from 'ai';
import prisma from '@/lib/prisma';

const togetherai = createTogetherAI({
  apiKey: process.env.TOGETHER_AI_API_KEY ?? '',
});

const QUERY_REWRITE_PROMPT = `Convert the conversational question into a clear search query.
Rules: Extract key concepts, remove filler, keep it 3-10 words, no quotes.
User: {question}
Search Query:`;

const RAG_ANSWER_PROMPT = `Answer using ONLY the CONTEXT provided.
RULES:
1. Base answers STRICTLY on context
2. If context lacks info, say "I don't have information about that."
3. Don't make up information
4. Be conversational but accurate

CONTEXT:
{context}

CONVERSATION HISTORY:
{history}

USER: {question}

ASSISTANT:`;

function generateSystemPrompt(chatbot: any) {
  const base = chatbot.directive || "You are a helpful assistant.";
  const personality = chatbot.description ? `\nPersonality: ${chatbot.description}` : "";
  return `${base}${personality}\nGuidelines: Prioritize knowledge base, be honest, stay professional.`;
}

async function rewriteQuery(userMessage: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: togetherai('meta-llama/Llama-3.3-70B-Instruct-Turbo'),
      prompt: QUERY_REWRITE_PROMPT.replace('{question}', userMessage),
      maxOutputTokens: 100,
      temperature: 0.3,
    });
    const rewritten = text.trim().replace(/["']/g, '');
    console.log('🔄 Query:', userMessage, '→', rewritten);
    return rewritten;
  } catch (error) {
    console.error('Query rewrite error:', error);
    return userMessage;
  }
}

async function searchKnowledgeBases(chatbot: any, query: string): Promise<string> {
  if (!chatbot.knowledgeBases?.length) return '';

  const allResults: any[] = [];
  
  for (const kb of chatbot.knowledgeBases) {
    try {
      const results = await searchSimilar({
        query,
        chatbotId: chatbot.id,
        knowledgeBaseId: kb.id,
        limit: 5,
        threshold: 0.65,
      });
      console.log(`📊 ${kb.name}: ${results.length} results`);
      allResults.push(...results.map((r: any) => ({ ...r, kbName: kb.name })));
    } catch (error) {
      console.error(`❌ ${kb.name}:`, error);
    }
  }

  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  const top = allResults.slice(0, 8);
  
  if (!top.length) return '';

  const formatted = top.map((r, i) => 
    `[Source ${i + 1}: ${r.kbName} - ${(r.score * 100).toFixed(1)}%]\n${r.content}`
  ).join('\n---\n');

  return `KNOWLEDGE BASE:\n${formatted}\n\nSources: ${top.length}`;
}

function formatHistory(messages: any[]): string {
  if (!messages.length) return "New conversation";
  return messages.map(m => 
    `${m.senderType === 'USER' ? 'User' : 'Bot'}: ${m.content}`
  ).join('\n');
}

async function getLogicContext(chatbot: any, message: string): Promise<string> {
  let ctx = '';
  for (const logic of chatbot.logics || []) {
    if (logic.triggerType === 'KEYWORD' && logic.keywords) {
      try {
        const keywords = JSON.parse(logic.keywords);
        if (keywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()))) {
          if (logic.type === 'LINK_BUTTON' && logic.linkButton) {
            ctx += `\n[Mention: ${logic.linkButton.buttonText}]\n`;
          } else if (logic.type === 'SCHEDULE_MEETING') {
            ctx += '\n[Offer meeting scheduling]\n';
          }
        }
      } catch (e) {}
    }
  }
  return ctx;
}

async function generateRAGResponse(chatbot: any, userMessage: string, conversationId: string) {
  try {
    const history = await prisma.message.findMany({
      where: { conversationId, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }},
      orderBy: { createdAt: 'asc' },
      take: 10
    });

    const formattedHistory = formatHistory(history);
    const rewrittenQuery = await rewriteQuery(userMessage);
    const knowledgeContext = await searchKnowledgeBases(chatbot, rewrittenQuery);
    const logicContext = await getLogicContext(chatbot, userMessage);

    let prompt: string;
    
    if (knowledgeContext) {
      prompt = RAG_ANSWER_PROMPT
        .replace('{context}', knowledgeContext + logicContext)
        .replace('{history}', formattedHistory)
        .replace('{question}', userMessage);
      console.log('✅ Using RAG mode with knowledge base');
    } else {
      prompt = `${generateSystemPrompt(chatbot)}\n${logicContext}\nHistory:\n${formattedHistory}\nUser: ${userMessage}\nAssistant:`;
      console.log('⚠️ No knowledge found, using general mode');
    }

    const { text } = await generateText({
      model: togetherai(chatbot.model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
      prompt,
      maxOutputTokens: chatbot.max_tokens || 500,
      temperature: chatbot.temperature || 0.7,
    });

    return text.trim();

  } catch (error) {
    console.error('RAG error:', error);
    throw error;
  }
}

async function checkLogicTriggers(chatbot: any, message: string) {
  const triggered: any[] = [];
  
  for (const logic of chatbot.logics || []) {
    if (logic.triggerType === 'KEYWORD' && logic.keywords) {
      try {
        const keywords = JSON.parse(logic.keywords);
        if (keywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()))) {
          triggered.push(logic);
        }
      } catch (e) {}
    }
  }
  
  return triggered;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message || body.input;
    const chatbotId = body.chatbotId;
    const conversationId = body.conversationId;
    const context = body.context;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (!chatbotId) {
      return NextResponse.json({ error: 'Chatbot ID required' }, { status: 400 });
    }

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        knowledgeBases: { include: { documents: true }},
        logics: {
          where: { isActive: true },
          include: {
            linkButton: true,
            meetingSchedule: true,
            leadCollection: { include: { formFields: true }}
          }
        }
      }
    });

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({ where: { id: conversationId }});
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { chatbotId, title: message.substring(0, 50), metadata: context }
        });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: { chatbotId, title: message.substring(0, 50), metadata: context }
      });
    }

    await prisma.message.create({
      data: { content: message, senderType: 'USER', conversationId: conversation.id }
    });

    const triggeredLogics = await checkLogicTriggers(chatbot, message);
    const aiResponse = await generateRAGResponse(chatbot, message, conversation.id);

    await prisma.message.create({
      data: { content: aiResponse, senderType: 'BOT', conversationId: conversation.id }
    });

    const responseData: any = {
      message: aiResponse,
      response: aiResponse,
      conversationId: conversation.id,
      chatbotId: chatbot.id,
      chatbotName: chatbot.name
    };

    if (triggeredLogics.length > 0) {
      responseData.logicTriggers = triggeredLogics.map(logic => ({
        id: logic.id,
        type: logic.type,
        name: logic.name,
        config: logic.config,
        linkButton: logic.linkButton,
        meetingSchedule: logic.meetingSchedule,
        leadCollection: logic.leadCollection
      }));
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Chat API error:', error);
    
    let errorMessage = 'Failed to process message';
    let statusCode = 500;
    
    if (error.message?.includes('API key')) {
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
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const chatbotId = searchParams.get('chatbotId');

    if (!conversationId || !chatbotId) {
      return NextResponse.json(
        { error: 'conversationId and chatbotId required' },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 }}
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.chatbotId !== chatbotId) {
      return NextResponse.json(
        { error: 'Conversation does not belong to this chatbot' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      data: conversation.messages,
      conversationId: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, isActive, metadata } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(metadata && { metadata }),
        ...(isActive === false && { endedAt: new Date() })
      }
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      isActive: conversation.isActive,
      endedAt: conversation.endedAt
    });

  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}