import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/voice-agents/[id] - Fetch specific voice agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const voiceAgent = await prisma.voiceAgent.findUnique({
      where: { id },
      include: { chatbot: true }
    });

    if (!voiceAgent) return NextResponse.json({ error: 'Voice agent not found' }, { status: 404 });

    return NextResponse.json({ voiceAgent });
  } catch (error) {
    console.error('Error fetching voice agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/voice-agents/[id] - Update voice agent personality
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { agentName, voiceId, firstSpeaker, greeting, directive } = body;

    const updatedAgent = await prisma.voiceAgent.update({
      where: { id },
      data: {
        agentName,
        voiceId,
        firstSpeaker,
        greeting,
        directive,
      },
    });

    return NextResponse.json({ message: 'Updated successfully', voiceAgent: updatedAgent });
  } catch (error) {
    console.error('Error updating voice agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}