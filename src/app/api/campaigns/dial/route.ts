import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentDispatchClient, SipClient, RoomServiceClient } from 'livekit-server-sdk';

export async function POST(request: NextRequest) {
  try {
    // 1. Secure the route
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse the campaign / prospect details from the request
    const { agentId, prospectNumber, prospectName, leadSource } = await request.json();

    if (!agentId || !prospectNumber) {
      return NextResponse.json({ error: 'Agent ID and Prospect Number are required' }, { status: 400 });
    }

    // 3. Verify the Voice Agent exists
    const voiceAgent = await prisma.voiceAgent.findUnique({
      where: { id: agentId }
    });

    if (!voiceAgent) {
      return NextResponse.json({ error: 'Voice agent not found' }, { status: 404 });
    }

    // Ensure you have configured your SIP Trunk ID in your .env
    const sipTrunkId = process.env.LIVEKIT_SIP_TRUNK_ID;
    if (!sipTrunkId) {
      return NextResponse.json({ error: 'SIP Trunk not configured on server' }, { status: 500 });
    }

    // 4. Create a unique room for this specific outbound call
    const roomName = `outbound_${prospectNumber.replace(/\+/g, '')}_${Date.now()}`;
    
    // Inject the prospect's name and context into the room metadata so the worker can read it!
    const roomMetadata = JSON.stringify({
      agentId: agentId,
      prospectName: prospectName || "Sir/Madam",
      leadSource: leadSource || "our website"
    });

    const roomClient = new RoomServiceClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );

    await roomClient.createRoom({
      name: roomName,
      emptyTimeout: 3 * 60, // Close room if no one joins after 3 minutes
      metadata: roomMetadata
    });

    // 5. Wake up the Voice Worker and send it to the new room
    const dispatchClient = new AgentDispatchClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    
    await dispatchClient.createDispatch(roomName, 'voice-agent');
    console.log(`[DIALER] Dispatched agent to ${roomName}`);

    // 6. Tell LiveKit to dial the prospect's phone number via SIP
    const sipClient = new SipClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );

    await sipClient.createSipParticipant(
      sipTrunkId,         // Your outbound SIP trunk ID (e.g., Exotel/Tata/Airtel)
      prospectNumber,     // The number to call (e.g., +919876543210)
      roomName,           // Drop the prospect into the room with the AI
      {
        participantIdentity: `sip_${prospectNumber}`,
        participantName: prospectName || 'Prospect'
      }
    );
    console.log(`[DIALER] Dialing ${prospectNumber}...`);

    // 7. Log the outbound attempt in your database
    await prisma.ticket.create({
      data: {
        chatbotId: voiceAgent.chatbotId,
        caller: prospectNumber,
        type: "OUTBOUND_CALL_ATTEMPT",
        details: { prospectName, leadSource, roomName }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Dialing ${prospectNumber}`,
      roomName 
    });

  } catch (error: any) {
    console.error('[DIALER] Error initiating outbound call:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}