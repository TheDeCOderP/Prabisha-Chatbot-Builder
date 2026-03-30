import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper function to get date range
function getDateRange(timeRange: string) {
  const now = new Date();
  const start = new Date();

  switch (timeRange) {
    case '24h':
      start.setHours(now.getHours() - 24);
      break;
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    default:
      start.setDate(now.getDate() - 7);
  }

  return { start, end: now };
}

// Helper function to format dates
function formatDate(date: Date, timeRange: string) {
  if (timeRange === '24h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Generate color palette
function generateColor(index: number) {
  const colors = [
    'hsl(217, 91%, 60%)',  // blue
    'hsl(263, 70%, 60%)',  // purple
    'hsl(142, 76%, 45%)',  // emerald
    'hsl(25, 95%, 53%)',   // orange
    'hsl(188, 94%, 43%)',  // cyan
    'hsl(48, 96%, 53%)',   // yellow
    'hsl(339, 90%, 51%)',  // pink
  ];
  return colors[index % colors.length];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '7d';
    const workspaceId = searchParams.get('workspaceId');

    // Validate workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    const { start, end } = getDateRange(timeRange);

    // First verify that the workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Fetch basic stats filtered by workspace
    const [
      totalChatbots,
      totalConversations,
      activeConversations,
      totalLeads,
      totalMessages,
      totalWorkspaces,
    ] = await Promise.all([
      // Count chatbots in this workspace
      prisma.chatbot.count({
        where: {
          workspaceId: workspaceId,
        },
      }),
      // Count conversations for chatbots in this workspace
      prisma.conversation.count({
        where: {
          chatbot: {
            workspaceId: workspaceId,
          },
          createdAt: { gte: start, lte: end },
        },
      }),
      // Count active conversations for chatbots in this workspace
      prisma.conversation.count({
        where: {
          chatbot: {
            workspaceId: workspaceId,
          },
          isActive: true,
        },
      }),
      // Count leads for chatbots in this workspace
      prisma.lead.count({
        where: {
          chatbot: {
            workspaceId: workspaceId,
          },
          createdAt: { gte: start, lte: end },
        },
      }),
      // Count messages for chatbots in this workspace
      prisma.message.count({
        where: {
          conversation: {
            chatbot: {
              workspaceId: workspaceId,
            },
          },
          createdAt: { gte: start, lte: end },
        },
      }),
      // Count total workspaces (still global, but you might want to change this)
      prisma.workspace.count(),
    ]);

    // Calculate conversion rate
    const conversionRate = totalConversations > 0
      ? ((totalLeads / totalConversations) * 100).toFixed(1)
      : '0.0';

    // Get conversation trends by day - filtered by workspace
    const conversationsWithMessages = await prisma.conversation.findMany({
      where: {
        chatbot: {
          workspaceId: workspaceId,
        },
        createdAt: { gte: start, lte: end },
      },
      include: {
        messages: {
          select: {
            id: true,
          },
        },
        lead: {
          select: {
            id: true,
          },
        },
      },
    });

    // Get all leads filtered by workspace
    const allLeads = await prisma.lead.findMany({
      where: {
        chatbot: {
          workspaceId: workspaceId,
        },
        createdAt: { gte: start, lte: end },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date
    const dateMap = new Map<string, { conversations: number; messages: number; leads: number }>();

    // Count conversations and their messages
    conversationsWithMessages.forEach((conv) => {
      const dateKey = formatDate(conv.createdAt, timeRange);
      const existing = dateMap.get(dateKey) || { conversations: 0, messages: 0, leads: 0 };
      dateMap.set(dateKey, {
        conversations: existing.conversations + 1,
        messages: existing.messages + conv.messages.length,
        leads: existing.leads + (conv.lead ? 1 : 0),
      });
    });

    // Add standalone leads (not associated with conversations)
    allLeads.forEach((lead) => {
      const dateKey = formatDate(lead.createdAt, timeRange);
      const existing = dateMap.get(dateKey) || { conversations: 0, messages: 0, leads: 0 };
      dateMap.set(dateKey, {
        conversations: existing.conversations,
        messages: existing.messages,
        leads: existing.leads + 1,
      });
    });

    // Convert to array and sort by date
    const conversationData = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return isNaN(dateA.getTime()) || isNaN(dateB.getTime()) ? 0 : dateA.getTime() - dateB.getTime();
      });

    // Get chatbot performance - filtered by workspace
    const chatbots = await prisma.chatbot.findMany({
      where: {
        workspaceId: workspaceId,
      },
      select: {
        id: true,
        name: true,
        conversations: {
          where: {
            createdAt: { gte: start, lte: end },
          },
          select: {
            id: true,
          },
        },
        leads: {
          where: {
            createdAt: { gte: start, lte: end },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const chatbotPerformance = chatbots
      .map((chatbot) => ({
        name: chatbot.name.length > 15 ? chatbot.name.substring(0, 15) + '...' : chatbot.name,
        conversations: chatbot.conversations.length,
        leads: chatbot.leads.length,
        satisfaction: Math.random() * 2 + 3, // Random satisfaction between 3-5
      }))
      .sort((a, b) => b.conversations - a.conversations)
      .slice(0, 5);

    // Get lead source data - filtered by workspace
    const chatbotForms = await prisma.chatbotForm.findMany({
      where: {
        chatbot: {
          workspaceId: workspaceId,
        },
      },
      select: {
        leadFormStyle: true,
        leads: {
          where: {
            createdAt: { gte: start, lte: end },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const leadSourceMap = new Map<string, number>();
    chatbotForms.forEach((form) => {
      const styleName = form.leadFormStyle === 'EMBEDDED' ? 'Embedded Form' : 
                       form.leadFormStyle === 'MESSAGES' ? 'Message Form' : 
                       form.leadFormStyle || 'Unknown';
      leadSourceMap.set(styleName, (leadSourceMap.get(styleName) || 0) + form.leads.length);
    });

    const leadSourceData = Array.from(leadSourceMap.entries()).map(([name, value], index) => ({
      name,
      value,
      color: generateColor(index),
    }));

    // Get hourly activity - filtered by workspace
    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          chatbot: {
            workspaceId: workspaceId,
          },
        },
        createdAt: { gte: start, lte: end },
      },
      select: {
        createdAt: true,
      },
    });

    const hourlyMap = new Map<string, number>();
    messages.forEach((msg) => {
      const hour = msg.createdAt.getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      hourlyMap.set(hourKey, (hourlyMap.get(hourKey) || 0) + 1);
    });

    // Fill in missing hours and sort
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const hourKey = `${i.toString().padStart(2, '0')}:00`;
      return {
        hour: hourKey,
        activity: hourlyMap.get(hourKey) || 0,
      };
    }).filter((_, i) => i % 2 === 0);

    // Get ChatbotLogic usage - filtered by workspace
    const chatbotLogics = await prisma.chatbotLogic.findMany({
      where: {
        chatbot: {
          workspaceId: workspaceId,
        },
      },
      select: {
        leadCollectionEnabled: true,
        linkButtonEnabled: true,
        meetingScheduleEnabled: true,
      },
    });

    const logicTypeMap = new Map<string, number>();
    chatbotLogics.forEach((logic) => {
      if (logic.leadCollectionEnabled) {
        logicTypeMap.set('Lead Collection', (logicTypeMap.get('Lead Collection') || 0) + 1);
      }
      if (logic.linkButtonEnabled) {
        logicTypeMap.set('Link Button', (logicTypeMap.get('Link Button') || 0) + 1);
      }
      if (logic.meetingScheduleEnabled) {
        logicTypeMap.set('Meeting Schedule', (logicTypeMap.get('Meeting Schedule') || 0) + 1);
      }
    });

    const logicTypeUsage = Array.from(logicTypeMap.entries()).map(([name, value], index) => ({
      name,
      value,
      color: generateColor(index),
      percentage: chatbotLogics.length > 0 ? Math.round((value / chatbotLogics.length) * 100) : 0,
    }));

    // Calculate average response time (placeholder)
    const avgResponseTime = '1.2s';

    const response = {
      stats: {
        totalChatbots,
        totalConversations,
        activeConversations,
        totalLeads,
        conversionRate: parseFloat(conversionRate),
        avgResponseTime,
        totalWorkspaces, // This is still global, consider if you want to change this
        totalMessages,
      },
      conversationData: conversationData.length > 0 ? conversationData : [
        { date: formatDate(new Date(), timeRange), conversations: 0, messages: 0, leads: 0 }
      ],
      chatbotPerformance: chatbotPerformance.length > 0 ? chatbotPerformance : [
        { name: 'No Data', conversations: 0, leads: 0, satisfaction: 0 }
      ],
      leadSourceData: leadSourceData.length > 0 ? leadSourceData : [
        { name: 'No Data', value: 0, color: generateColor(0) }
      ],
      hourlyActivity,
      logicTypeUsage: logicTypeUsage.length > 0 ? logicTypeUsage : [
        { name: 'No Data', value: 0, color: generateColor(0), percentage: 0 }
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}