import { NextResponse } from "next/server";
import { SipClient } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma"; 

export async function POST(req: Request) {
  try {
    const sipClient = new SipClient(
      process.env.LIVEKIT_URL || "https://dummy.livekit.cloud",
      process.env.LIVEKIT_API_KEY || "",
      process.env.LIVEKIT_API_SECRET || ""
    );

    const { chatbotId, phoneNumber, method } = await req.json();

    // 1. Create a dynamic SIP Trunk in LiveKit for this specific number
    const trunk = await sipClient.createSipInboundTrunk(
      `Trunk-${phoneNumber}`,
      [phoneNumber] 
    );

    // 2. Save it to your PostgreSQL database
    const voiceAgent = await prisma.voiceAgent.create({
      data: {
        chatbotId,
        phoneNumber,
        method,
        sipTrunkId: trunk.sipTrunkId,
      },
    });

    return NextResponse.json({ 
      success: true, 
      voiceAgent,
      sipUri: `sip:${phoneNumber}@your-project.sip.livekit.cloud` 
    });

  } catch (error) {
    console.error("SIP Provisioning Error:", error);
    return NextResponse.json({ error: "Failed to provision number" }, { status: 500 });
  }
}