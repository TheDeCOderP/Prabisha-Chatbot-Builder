import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    const { start, end } = getDateRange(timeRange);

    // Get user ID from session (you'll need to implement auth)
    // const session = await getServerSession();
    // const userId = session?.user?.id;
    // For now, we'll fetch all data, but you should filter by user/workspace

    // Fetch basic stats
    const [
      totalChatbots,
      totalConversations,
      activeConversations,
      totalLeads,
      totalMessages,
      totalWorkspaces,
    ] = await Promise.all([
      prisma.chatbot.count(),
      prisma.conversation.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.conversation.count({
        where: {
          isActive: true,
        },
      }),
      prisma.lead.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.message.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.workspace.count(),
    ]);

    // Calculate conversion rate
    const conversionRate = totalConversations > 0 
      ? ((totalLeads / totalConversations) * 100).toFixed(1)
      : '0.0';

    // Get conversation trends by day
    const conversations = await prisma.conversation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        createdAt: true,
        messages: {
          select: {
            id: true,
          },
        },
      },
    });

    const leads = await prisma.lead.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date
    const dateMap = new Map<string, { conversations: number; messages: number; leads: number }>();
    
    conversations.forEach((conv) => {
      const dateKey = formatDate(conv.createdAt, timeRange);
      const existing = dateMap.get(dateKey) || { conversations: 0, messages: 0, leads: 0 };
      dateMap.set(dateKey, {
        conversations: existing.conversations + 1,
        messages: existing.messages + conv.messages.length,
        leads: existing.leads,
      });
    });

    leads.forEach((lead) => {
      const dateKey = formatDate(lead.createdAt, timeRange);
      const existing = dateMap.get(dateKey) || { conversations: 0, messages: 0, leads: 0 };
      dateMap.set(dateKey, {
        ...existing,
        leads: existing.leads + 1,
      });
    });

    const conversationData = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Get chatbot performance
    const chatbots = await prisma.chatbot.findMany({
      include: {
        conversations: {
          where: {
            createdAt: { gte: start, lte: end },
          },
        },
        leads: {
          where: {
            createdAt: { gte: start, lte: end },
          },
        },
      },
    });

    const chatbotPerformance = chatbots
      .map((chatbot) => ({
        name: chatbot.name,
        conversations: chatbot.conversations.length,
        leads: chatbot.leads.length,
        satisfaction: 4.5, // You can calculate this from feedback if you have it
      }))
      .slice(0, 5); // Top 5 chatbots

    // Get lead source distribution
    const leadForms = await prisma.leadForm.findMany({
      include: {
        leads: {
          where: {
            createdAt: { gte: start, lte: end },
          },
        },
      },
    });

    const leadSourceMap = new Map<string, number>();
    leadForms.forEach((form) => {
      const style = form.leadFormStyle;
      leadSourceMap.set(style, (leadSourceMap.get(style) || 0) + form.leads.length);
    });

    const leadSourceData = Array.from(leadSourceMap.entries()).map(([name, value], index) => ({
      name: name === 'EMBEDDED' ? 'Embedded Form' : 'Message Form',
      value,
      color: generateColor(index),
    }));

    // Get flow type distribution
    const flows = await prisma.flow.findMany({
      select: {
        type: true,
      },
    });

    const flowTypeMap = new Map<string, number>();
    flows.forEach((flow) => {
      flowTypeMap.set(flow.type, (flowTypeMap.get(flow.type) || 0) + 1);
    });

    const flowTypeData = Array.from(flowTypeMap.entries()).map(([name, count], index) => ({
      name,
      count,
      color: generateColor(index),
    }));

    // Get hourly activity (messages per hour)
    const messages = await prisma.message.findMany({
      where: {
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

    // Fill in missing hours
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const hourKey = `${i.toString().padStart(2, '0')}:00`;
      return {
        hour: hourKey,
        activity: hourlyMap.get(hourKey) || 0,
      };
    }).filter((_, i) => i % 4 === 0); // Show every 4 hours

    // Get logic type usage
    const logics = await prisma.logic.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        type: true,
      },
    });

    const logicTypeMap = new Map<string, number>();
    logics.forEach((logic) => {
      const typeName = logic.type.split('_').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ');
      logicTypeMap.set(typeName, (logicTypeMap.get(typeName) || 0) + 1);
    });

    const totalLogics = logics.length;
    const logicTypeUsage = Array.from(logicTypeMap.entries()).map(([name, count]) => ({
      name,
      count,
      value: count,
      percentage: totalLogics > 0 ? Math.round((count / totalLogics) * 100) : 0,
    }));

    // Calculate average response time (simplified - you'd need to track actual times)
    const avgResponseTime = '1.2s'; // Placeholder

    const response = {
      stats: {
        totalChatbots,
        totalConversations,
        activeConversations,
        totalLeads,
        conversionRate: parseFloat(conversionRate),
        avgResponseTime,
        totalWorkspaces,
        totalMessages,
      },
      conversationData: conversationData.length > 0 ? conversationData : [
        { date: 'No Data', conversations: 0, messages: 0, leads: 0 }
      ],
      chatbotPerformance: chatbotPerformance.length > 0 ? chatbotPerformance : [
        { name: 'No Chatbots', conversations: 0, leads: 0, satisfaction: 0 }
      ],
      leadSourceData: leadSourceData.length > 0 ? leadSourceData : [
        { name: 'No Data', value: 0, color: generateColor(0) }
      ],
      flowTypeData: flowTypeData.length > 0 ? flowTypeData : [
        { name: 'No Flows', count: 0, color: generateColor(0) }
      ],
      hourlyActivity,
      logicTypeUsage: logicTypeUsage.length > 0 ? logicTypeUsage : [
        { name: 'No Logic', count: 0, value: 0, percentage: 0 }
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}