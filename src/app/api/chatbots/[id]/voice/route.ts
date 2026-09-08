import { NextResponse } from "next/server";
import { SipClient } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";

const livekitUrl = process.env.LIVEKIT_URL?.replace("wss://", "https://");
const sipClient = new SipClient(
  livekitUrl || "",
  process.env.LIVEKIT_API_KEY || "",
  process.env.LIVEKIT_API_SECRET || ""
);

// GET /api/chatbots/[id]/voice - Retrieve voice agent configuration
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const voiceAgent = await prisma.voiceAgent.findUnique({
      where: { chatbotId: id },
    });

    return NextResponse.json({ voiceAgent });
  } catch (error) {
    console.error("Failed to fetch voice agent:", error);
    return NextResponse.json(
      { error: "Failed to fetch voice settings" },
      { status: 500 }
    );
  }
}

// POST /api/chatbots/[id]/voice - Provision or update voice agent
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params;
    const { phoneNumber, method } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Format phone number with leading + if missing
    const formattedPhone = phoneNumber.trim().startsWith("+")
      ? phoneNumber.trim()
      : `+${phoneNumber.trim()}`;

    // Extract SIP host domain from LIVEKIT_URL
    const livekitHost = process.env.LIVEKIT_URL
      ? new URL(process.env.LIVEKIT_URL.replace("wss://", "https://")).host.replace("livekit.cloud", "sip.livekit.cloud")
      : "sip.livekit.cloud";

    let sipTrunkId: string | null = null;

    // Create LiveKit Inbound SIP Trunk
    if (process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
      try {
        const trunk = await sipClient.createSipInboundTrunk(
          `Trunk-${formattedPhone}`,
          [formattedPhone],
          {
            numbers: [`sip:${formattedPhone}@${livekitHost}`],
          }
        );
        sipTrunkId = trunk.sipTrunkId;
      } catch (err) {
        console.warn("LiveKit SIP Trunk creation notice:", err);
      }
    }

    // Upsert into PostgreSQL
    const voiceAgent = await prisma.voiceAgent.upsert({
      where: { chatbotId },
      update: {
        phoneNumber: formattedPhone,
        method: method || "call_forwarding",
        sipTrunkId: sipTrunkId || undefined,
      },
      create: {
        chatbotId,
        phoneNumber: formattedPhone,
        method: method || "call_forwarding",
        sipTrunkId,
      },
    });

    return NextResponse.json({
      success: true,
      voiceAgent,
      sipUri: `sip:${formattedPhone}@${livekitHost}`,
    });
  } catch (error: any) {
    console.error("Provisioning error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This phone number is already attached to another chatbot." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to provision voice agent" },
      { status: 500 }
    );
  }
}

// DELETE /api/chatbots/[id]/voice - Disconnect voice agent
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params;
    const existing = await prisma.voiceAgent.findUnique({
      where: { chatbotId },
    });

    if (existing?.sipTrunkId) {
      try {
        await sipClient.deleteSipTrunk(existing.sipTrunkId);
      } catch (e) {
        console.warn("Failed to delete LiveKit trunk:", e);
      }
    }

    await prisma.voiceAgent.delete({
      where: { chatbotId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete voice agent:", error);
    return NextResponse.json(
      { error: "Failed to delete voice agent" },
      { status: 500 }
    );
  }
}