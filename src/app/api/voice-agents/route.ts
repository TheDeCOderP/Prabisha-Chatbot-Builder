import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/voice-agents - List all voice agents for a workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const workspaceId = searchParams.get('workspaceId') as string;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 });
    }

    const voiceAgents = await prisma.voiceAgent.findMany({
      where: { 
        chatbot: { workspaceId } 
      },
      include: {
        chatbot: {
          select: { name: true }
        },
        _count: {
          select: { callLogs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(voiceAgents);
  } catch (error) {
    console.error('Error fetching voice agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/voice-agents - Create a new voice agent
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agentName, phoneNumber, chatbotId, workspaceId } = await request.json();

    if (!phoneNumber || !chatbotId || !workspaceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify workspace access
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { workspaces: { where: { workspaceId } } }
    });

    if (!user || user.workspaces.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const formattedPhone = phoneNumber.trim().startsWith("+")
      ? phoneNumber.trim()
      : `+${phoneNumber.trim()}`;

    // Create the Voice Agent
    const voiceAgent = await prisma.voiceAgent.create({
      data: {
        agentName: agentName || "AI Assistant",
        phoneNumber: formattedPhone,
        chatbotId,
        method: "call_forwarding",
        voiceId: "Puck",
        firstSpeaker: "agent",
        greeting: "Hello! How can I help you today?",
        directive: "You are a helpful phone assistant. Keep your responses brief, conversational, and natural.",
      }
    });

    return NextResponse.json(
      { message: 'Voice Agent created successfully', voiceAgent },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating voice agent:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This phone number or chatbot is already in use by another Voice Agent.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}