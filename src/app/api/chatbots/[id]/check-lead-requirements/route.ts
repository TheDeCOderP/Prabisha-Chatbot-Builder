import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouterParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id: chatbotId } = await context.params;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Get the chatbot logic configuration
    const chatbotLogic = await prisma.chatbotLogic.findUnique({
      where: { chatbotId },
    });

    // Check if lead collection is enabled
    if (!chatbotLogic || !chatbotLogic.leadCollectionEnabled || !chatbotLogic.isActive) {
      return NextResponse.json({ shouldShowForm: false });
    }

    // Parse triggers from JSON
    let triggers = [];
    if (chatbotLogic.triggers) {
      try {
        const raw = chatbotLogic.triggers;
        triggers = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(triggers)) {
          triggers = [];
        }
      } catch (e) {
        console.error('Error parsing triggers:', e);
        triggers = [];
      }
    }

    // Find lead collection trigger
    const leadTrigger = triggers.find((trigger: any) => 
      trigger.feature === 'leadCollection' || trigger.type === 'COLLECT_LEADS'
    );

    if (!leadTrigger) {
      return NextResponse.json({ shouldShowForm: false });
    }

    const triggerType = leadTrigger.triggerType || 'MANUAL';

    // Check different trigger types
    switch (triggerType.toUpperCase()) {
      case 'ALWAYS':
      case 'SHOW_ALWAYS':
        return NextResponse.json({ shouldShowForm: true });

      case 'MESSAGE_COUNT': {
        const messageCount = await prisma.message.count({
          where: { conversationId },
        });

        // Get threshold from trigger config or default to 1
        const threshold = leadTrigger.messageCountThreshold || 1;

        if (messageCount >= threshold) {
          return NextResponse.json({ shouldShowForm: true });
        }
        break;
      }

      case 'END_OF_CONVERSATION': {
        // Check if conversation is marked as ended
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { endedAt: true, isActive: true }
        });

        if (conversation && (conversation.endedAt || !conversation.isActive)) {
          return NextResponse.json({ shouldShowForm: true });
        }
        break;
      }

      case 'KEYWORD': {
        const lastMessage = await prisma.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
        });

        if (lastMessage && lastMessage.senderType === 'USER') {
          const keywords = leadTrigger.keywords || [];
          const content = lastMessage.content.toLowerCase();
          
          const matches = keywords.some((keyword: string) => 
            content.includes(keyword.toLowerCase())
          );

          if (matches) {
            return NextResponse.json({ shouldShowForm: true });
          }
        }
        break;
      }

      case 'TIME_DELAY': {
        // Check if enough time has passed since conversation started
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { createdAt: true }
        });

        if (conversation) {
          const delayMinutes = leadTrigger.delayMinutes || 5; // Default 5 minutes
          const delayMs = delayMinutes * 60 * 1000;
          const shouldShowTime = new Date(conversation.createdAt.getTime() + delayMs) <= new Date();

          if (shouldShowTime) {
            return NextResponse.json({ shouldShowForm: true });
          }
        }
        break;
      }

      // For MANUAL trigger type, let frontend handle it
      case 'MANUAL':
      default:
        return NextResponse.json({ shouldShowForm: false });
    }

    return NextResponse.json({ shouldShowForm: false });

  } catch (error) {
    console.error('Error checking lead requirements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: POST endpoint to manually trigger form for testing
export async function POST(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id: chatbotId } = await context.params;
    const body = await request.json();
    const { conversationId, force = false } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Get the chatbot logic configuration
    const chatbotLogic = await prisma.chatbotLogic.findUnique({
      where: { chatbotId },
    });

    // Check if lead collection is enabled
    if (!chatbotLogic || !chatbotLogic.leadCollectionEnabled || !chatbotLogic.isActive) {
      return NextResponse.json({ 
        success: false, 
        message: 'Lead collection is not enabled for this chatbot' 
      });
    }

    // If force is true, override all checks
    if (force) {
      return NextResponse.json({ 
        success: true, 
        shouldShowForm: true,
        message: 'Form manually triggered'
      });
    }

    // Otherwise, do the regular trigger checks (same as GET)
    // ... (copy the trigger logic from above if needed)

    return NextResponse.json({ 
      success: false, 
      shouldShowForm: false,
      message: 'Trigger conditions not met'
    });

  } catch (error) {
    console.error('Error triggering lead form:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}