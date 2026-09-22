import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';

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
    });

    if (!voiceAgent) return NextResponse.json({ error: 'Voice agent not found' }, { status: 404 });

    const roomName = `preview_${voiceAgent.phoneNumber}`;
    const participantIdentity = `web_preview_${session.user.email}`;

    // 1. THE FIX: Explicitly wake up the agent and send it to the room!
    try {
      const dispatchClient = new AgentDispatchClient(
        process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
      );
      
      await dispatchClient.createDispatch(roomName, 'voice-agent');
      console.log(`[PREVIEW] Explicitly dispatched voice-agent to ${roomName}`);
    } catch (dispatchError) {
      console.log('[PREVIEW] Note: Agent may already be in the room or dispatch failed:', dispatchError);
      // We don't throw an error here, just in case the agent is already active in this room
    }

    // 2. Generate the standard frontend access token
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      { identity: participantIdentity }
    );
    
    at.addGrant({ roomJoin: true, room: roomName });

    return NextResponse.json({ 
      token: await at.toJwt(), 
      url: process.env.LIVEKIT_URL 
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}