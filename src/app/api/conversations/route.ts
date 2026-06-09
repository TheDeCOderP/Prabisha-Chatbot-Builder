import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');
    const workspaceId = searchParams.get('workspaceId');
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // 'active' | 'closed' | null
    const hasLead = searchParams.get('hasLead'); // 'true' | 'false' | null
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;

    // Base where clause — only conversations in workspaces the user is a member of
    const whereClause: any = {
      chatbot: {
        workspace: {
          members: { some: { userId: user.id } },
        },
      },
    };

    if (chatbotId) {
      whereClause.chatbotId = chatbotId;
    }

    if (workspaceId) {
      whereClause.chatbot.workspaceId = workspaceId;
    }

    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'closed') {
      whereClause.isActive = false;
    }

    if (hasLead === 'true') {
      whereClause.lead = { isNot: null };
    } else if (hasLead === 'false') {
      whereClause.lead = { is: null };
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
        { chatbot: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: {
          chatbot: {
            select: {
              id: true,
              name: true,
              workspace: { select: { id: true, name: true } },
            },
          },
          lead: {
            select: { id: true, createdAt: true, data: true },
          },
          _count: { select: { messages: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'asc' },
            select: { content: true, senderType: true },
          },
        },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where: whereClause }),
    ]);

    const formattedConversations = conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      chatbot: conversation.chatbot,
      workspace: conversation.chatbot.workspace,
      lead: conversation.lead,
      isActive: conversation.isActive,
      messageCount: conversation._count.messages,
      firstMessage: conversation.messages[0]?.content || null,
      firstMessageType: conversation.messages[0]?.senderType || null,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      endedAt: conversation.endedAt,
    }));

    return NextResponse.json({
      conversations: formattedConversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatbot: { workspace: { members: { some: { userId: user.id } } } },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    await prisma.conversation.delete({ where: { id: conversationId } });

    return NextResponse.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { isActive } = body;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        chatbot: { workspace: { members: { some: { userId: user.id } } } },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isActive: isActive !== undefined ? isActive : conversation.isActive,
        endedAt: isActive === false ? new Date() : isActive === true ? null : conversation.endedAt,
      },
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
