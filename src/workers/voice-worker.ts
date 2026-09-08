import { fileURLToPath } from 'url';
import { WorkerOptions, cli, defineAgent, voice, llm } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { z } from 'zod';
import dotenv from 'dotenv';

import { prisma } from '@/lib/prisma';
import { simpleSearch } from '@/lib/langchain/chains/search-chain';
import { uploadFile } from '@/services/cdn.service';

// Load environments
dotenv.config();

export default defineAgent({
  entry: async (ctx) => {
    const startTime = Date.now();
    const transcript: { speaker: string; text: string; time: string }[] = [];

    await ctx.connect();
    
    // 1. Identify who is calling and what number they dialed
    const roomName = ctx.room.name;
    const rawNumberMatch = roomName.match(/(\+?\d{10,15})/);
    const dialedNumber = rawNumberMatch ? rawNumberMatch[0] : roomName;
    
    // Find the caller's phone number
    let callerNumber = "Unknown";
    let sipParticipantIdentity = null;
    for (const [sid, participant] of ctx.room.remoteParticipants) {
      if (participant.identity.includes('sip_')) {
        callerNumber = participant.identity.replace('sip_', '');
        sipParticipantIdentity = participant.identity;
      }
    }
    
    // 2. Fetch the Voice Agent & Chatbot settings
    const voiceSettings = await prisma.voiceAgent.findUnique({
      where: { phoneNumber: dialedNumber },
      include: { chatbot: true }
    });

    if (!voiceSettings) {
       console.error(`[VOICE] Unregistered number dialed: ${dialedNumber}`);
       await ctx.disconnect();
       return; 
    }

    const { agentName, voiceId, firstSpeaker, greeting, directive: agentDirective } = voiceSettings;
    const { id: chatbotId, directive: chatbotDirective } = voiceSettings.chatbot;

    // Create a Conversation record in the unified inbox
    const conversation = await prisma.conversation.create({
      data: {
        chatbotId: chatbotId,
        title: `📞 Phone Call from ${callerNumber}`,
        metadata: { channel: "voice", callerNumber }
      }
    });
    console.log(`[VOICE] Created unified inbox conversation: ${conversation.id}`);

    // ─── ACTIVE TOOLS CONFIGURATION ──────────────────────────────────────────────

    const searchKnowledgeBase = llm.tool({
      description: "Search the company knowledge base for factual information, policies, and product details. Always use this tool when the user asks a question about the business.",
      parameters: z.object({
        query: z.string().describe("The search query to look up in the database")
      }),
      execute: async ({ query }) => {
        console.log(`[RAG] Voice Agent searching for: "${query}"`);
        try {
          const results = await simpleSearch(chatbotId, query, { limit: 3 });
          if (!results || results.length === 0) {
            return "No specific information found in the knowledge base. Tell the user you don't know the exact answer.";
          }
          return results.map(r => r.content).join('\n\n---\n\n');
        } catch (error) {
          console.error("[RAG] Search failed:", error);
          return "Error accessing the knowledge base.";
        }
      }
    });

    const scheduleMeeting = llm.tool({
      description: "Schedule a demo or meeting. Use this when a user wants to book time with the team.",
      parameters: z.object({
        time: z.string().describe("The preferred date and time for the meeting (e.g., 'Tomorrow at 2 PM')."),
        subject: z.string().describe("The topic or subject of the meeting.")
      }),
      execute: async ({ time, subject }) => {
        console.log(`[VOICE] Scheduling meeting for ${callerNumber} at ${time}`);
        try {
          const ticket = await prisma.ticket.create({
            data: {
              chatbotId,
              caller: callerNumber,
              type: "MEETING",
              details: { time, subject }
            }
          });
          return `Successfully scheduled the meeting for ${time}. Reference ID is ${ticket.id}. Tell the user the meeting is confirmed.`;
        } catch (error) {
          console.error("[VOICE] Schedule meeting failed:", error);
          return "Failed to schedule the meeting due to a system error. Apologize to the user.";
        }
      }
    });

    const registerComplaint = llm.tool({
      description: "Register a complaint or issue reported by the user (e.g., broken pipe, bad service, bug report).",
      parameters: z.object({
        issue: z.string().describe("A detailed description of the complaint or issue.")
      }),
      execute: async ({ issue }) => {
        console.log(`[VOICE] Registering complaint for ${callerNumber}: ${issue}`);
        try {
          const ticket = await prisma.ticket.create({
            data: {
              chatbotId,
              caller: callerNumber,
              type: "COMPLAINT",
              details: { issue }
            }
          });
          return `Successfully registered the complaint. Reference ID is ${ticket.id}. Tell the user the complaint is logged and someone will look into it.`;
        } catch (error) {
          console.error("[VOICE] Register complaint failed:", error);
          return "Failed to register the complaint due to a system error. Apologize to the user.";
        }
      }
    });

    const transferCall = llm.tool({
      description: "Transfer or forward the call to a specific department or role (e.g., PLUMBER, SALES, SUPPORT, MANAGER).",
      parameters: z.object({
        role: z.string().describe("The requested role or department to transfer to.")
      }),
      execute: async ({ role }) => {
        console.log(`[VOICE] Looking up contact for role: ${role}`);
        try {
          const contact = await prisma.contact.findFirst({
            where: {
              chatbotId,
              role: {
                equals: role,
                mode: 'insensitive' // Matches "Plumber", "PLUMBER", "plumber"
              }
            }
          });

          if (!contact) {
            return `Sorry, I couldn't find a contact for the ${role} department in the database. Tell the user no one is available for that role right now.`;
          }

          console.log(`[VOICE] Contact found: ${contact.name} (${contact.phoneNumber}). Initiating transfer...`);
          
          // ── SIP TRANSFER LOGIC ──
          // If you are using LiveKit's SIP integration, you can dispatch a SIP refer 
          // or instruct your backend to bridge the call here.
          // Example: await ctx.room.localParticipant.performSipTransfer(contact.phoneNumber);
          
          return `Contact found: ${contact.name}. Inform the user that you are transferring them to ${contact.name} now, and conclude your part of the conversation.`;
        } catch (error) {
          console.error("[VOICE] Transfer call failed:", error);
          return "Failed to look up the contact due to a system error.";
        }
      }
    });

    // 4. Inject Personality and Tools into the Agent
    const agent = new voice.Agent({
      instructions: `
        ${agentDirective || chatbotDirective}
        
        Your name is ${agentName}. You are an active AI voice assistant talking to a user on the phone.
        
        CRITICAL RULES:
        1. When the user asks a factual question, ALWAYS use the "searchKnowledgeBase" tool.
        2. If the user wants to schedule a meeting or demo, use the "scheduleMeeting" tool.
        3. If the user wants to report an issue or register a complaint, use the "registerComplaint" tool.
        4. If the user needs to speak to a specific person, department, or requests a service (like a plumber), use the "transferCall" tool.
        
        Keep your spoken answers brief, natural, and conversational. Do not use formatting like bolding or bullet points.
      `,
      tools: { searchKnowledgeBase, scheduleMeeting, registerComplaint, transferCall },
    });

    const session = new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        model: 'gemini-3.1-flash-live-preview', 
        voice: voiceId || 'Puck', 
        apiKey: process.env.GOOGLE_API_KEY, 
      }),
    });

    // 5. Capture Real-time Transcriptions
    ctx.room.on('transcriptionReceived', (segments, participant) => {
      for (const segment of segments) {
        if (segment.isFinal) {
          transcript.push({
            speaker: participant?.identity === ctx.room.localParticipant?.identity ? agentName : 'Caller',
            text: segment.text,
            time: new Date().toISOString(),
          });
        }
      }
    });

    // Start the session
    await session.start({ agent, room: ctx.room });
    console.log(`[VOICE] ${agentName} is active and listening on ${dialedNumber}!`);
    
    // Trigger greeting
    if (firstSpeaker === 'agent' && greeting) {
      await session.generateReply({ 
        instructions: `Greet the user exactly like this: "${greeting}"` 
      });
    }

    // 6. Handle Hangup: Upload files to CDN & Save to Database
    ctx.room.on('disconnected', async () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`[VOICE] Call ended. Duration: ${duration}s. Saving logs...`);
      
      let cdnTranscriptUrl = null;

      try {
        const transcriptBuffer = Buffer.from(JSON.stringify(transcript, null, 2), 'utf-8');
        const uploadResult = await uploadFile(transcriptBuffer, {
          fileName: `transcript-${voiceSettings.id}-${Date.now()}.json`,
          providers: ["local-public"]
        });
        
        cdnTranscriptUrl = uploadResult.url;
        console.log(`[VOICE] Transcript uploaded to CDN: ${cdnTranscriptUrl}`);
      } catch (uploadError) {
        console.error('[VOICE] Failed to upload transcript to CDN:', uploadError);
      }
      
      try {
        // Save the telecom-specific CallLog
        await prisma.callLog.create({
          data: {
            voiceAgentId: voiceSettings.id,
            callerNumber: callerNumber,
            duration: duration,
            transcript: transcript,
            recordingUrl: cdnTranscriptUrl, 
            status: 'completed',
          }
        });
        console.log(`[VOICE] Call log saved successfully for ${callerNumber}`);

        // Push the transcript into the unified Conversation/Message inbox
        if (transcript.length > 0) {
          const messagesToInsert = transcript.map(t => ({
            conversationId: conversation.id,
            content: t.text,
            senderType: t.speaker === 'Caller' ? 'USER' as const : 'BOT' as const,
            messageType: 'DIRECT_MESSAGE' as const
          }));

          await prisma.message.createMany({
            data: messagesToInsert
          });
          console.log(`[VOICE] Saved ${transcript.length} messages to unified inbox.`);
        }

      } catch (dbError) {
        console.error('[VOICE] Failed to save call log to DB:', dbError);
      }
    });
  }
});

// Boot the worker
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'voice-agent',
  }));
}