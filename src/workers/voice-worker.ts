import 'dotenv/config'; // <-- THIS MUST BE THE ABSOLUTE FIRST LINE

// --- GLOBAL CATCHERS ---
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception in Voice Worker:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection in Voice Worker:', reason);
});

import { fileURLToPath } from 'url';
import { WorkerOptions, cli, defineAgent, voice, llm } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { simpleSearch } from '@/lib/langchain/chains/search-chain';
import { uploadFile } from '@/services/cdn.service';

export default defineAgent({
  entry: async (ctx) => {
    const startTime = Date.now();
    const transcript: { speaker: string; text: string; time: string }[] = [];
    let voiceSettings: any = null;
    let callerNumber = "Unknown";
    let conversation: any;
    let endCallTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      await ctx.connect();
      
      // 1. Extract Prospect Data and Agent ID from Room Metadata
      let prospectName = "there";
      let leadSource = "our website";
      let metadataAgentId = null;
      
      if (ctx.room.metadata) {
        try {
          const meta = JSON.parse(ctx.room.metadata);
          if (meta.prospectName) prospectName = meta.prospectName;
          if (meta.leadSource) leadSource = meta.leadSource;
          if (meta.agentId) metadataAgentId = meta.agentId; 
        } catch (e) {
          console.warn("[VOICE] Could not parse room metadata", e);
        }
      }

      // 2. Identify who is calling and what number they dialed
      const roomName = ctx.room.name;
      if (!roomName) {
        console.error('[VOICE] No room name found');
        await ctx.room.disconnect();
        return; 
      }

      const rawNumberMatch = roomName.match(/(\+?\d{10,15})/);
      const dialedNumber = rawNumberMatch ? rawNumberMatch[0] : roomName;
      
      // Find the prospect's phone number
      for (const [sid, participant] of ctx.room.remoteParticipants) {
        if (participant.identity.includes('sip_')) {
          callerNumber = participant.identity.replace('sip_', '');
        } else if (participant.identity.includes('web_preview_')) {
          callerNumber = participant.identity.replace('web_preview_', 'Web Preview: ');
        }
      }
      
      // 3. Fetch the Voice Agent & Chatbot settings
      if (metadataAgentId) {
        voiceSettings = await prisma.voiceAgent.findUnique({
          where: { id: metadataAgentId },
          include: { chatbot: true }
        });
      } else {
        voiceSettings = await prisma.voiceAgent.findUnique({
          where: { phoneNumber: dialedNumber },
          include: { chatbot: true }
        });
      }

      if (!voiceSettings) {
         console.error(`[VOICE] Unregistered number/agent dialed. Room: ${roomName}`);
         await ctx.room.disconnect();
         return; 
      }

      const { agentName, voiceId, firstSpeaker, greeting, directive: agentDirective } = voiceSettings;
      const { id: chatbotId, directive: chatbotDirective } = voiceSettings.chatbot;

      // Create a Conversation record in the unified inbox
      conversation = await prisma.conversation.create({
        data: {
          chatbotId: chatbotId,
          title: `📞 Phone Call from ${callerNumber}`,
          metadata: { channel: "voice", callerNumber }
        }
      });
      console.log(`[VOICE] Created unified inbox conversation: ${conversation.id}`);

      // ─── ACTIVE TOOLS CONFIGURATION ──────────────────────────────────────────────
      let session: voice.AgentSession | null = null;

      const searchKnowledgeBase = llm.tool({
        description: "Search the company knowledge base for factual information, policies, and product details. Use this if the user asks a specific question about Prabisha's services.",
        parameters: z.object({
          query: z.string().describe("The search query to look up in the database")
        }),
        execute: async ({ query }) => {
          console.log(`[RAG] Voice Agent searching for: "${query}"`);
          try {
            const results = await simpleSearch(chatbotId, query, { limit: 3 });
            if (!results || results.length === 0) {
              return "No specific information found in the knowledge base. Pivot back to the call flow.";
            }
            return results.map(r => r.content).join('\n\n---\n\n');
          } catch (error) {
            return "Error accessing the knowledge base.";
          }
        }
      });

      const qualifyLead = llm.tool({
        description: "Use this tool to log the prospect's requirements when they express interest in Website Development, Digital Marketing, or other IT services.",
        parameters: z.object({
          interestCategory: z.enum(["WEBSITE_DEV", "DIGITAL_MARKETING", "SEO", "APP_DEV", "OTHER"]),
          requirementDetails: z.string().describe("A summary of what the prospect is looking to build or improve."),
        }),
        execute: async ({ interestCategory, requirementDetails }) => {
          console.log(`[SALES] Lead Qualified for ${callerNumber}: ${interestCategory} - ${requirementDetails}`);
          try {
            await prisma.ticket.create({
              data: {
                chatbotId,
                caller: callerNumber,
                type: "QUALIFIED_LEAD",
                details: { interestCategory, requirementDetails }
              }
            });
            return `Lead successfully qualified and requirement captured. Proceed to Warm Close.`;
          } catch (error) {
            console.error("[SALES] Qualify lead failed:", error);
            return "System error capturing lead, but continue to Warm Close.";
          }
        }
      });

      const scheduleCallback = llm.tool({
        description: "Use this tool when the prospect asks to be called back later or next week, or if you reached the wrong person and they provided a better time.",
        parameters: z.object({
          suggestedTime: z.string().describe("The specific day and time the prospect requested for a callback."),
        }),
        execute: async ({ suggestedTime }) => {
          console.log(`[SALES] Callback scheduled for ${callerNumber} at ${suggestedTime}`);
          try {
            await prisma.ticket.create({
              data: {
                chatbotId,
                caller: callerNumber,
                type: "CALLBACK_REQUEST",
                details: { suggestedTime }
              }
            });
            return `Callback logged for ${suggestedTime}. Gracefully end the call now.`;
          } catch (error) {
            return "System error logging callback, but gracefully end the call.";
          }
        }
      });

      const sendDetails = llm.tool({
        description: "Use this tool when the prospect says they are busy or asks you to send details via email or WhatsApp.",
        parameters: z.object({
          sendMethod: z.enum(["WHATSAPP", "EMAIL", "UNKNOWN"]),
          targetService: z.string().describe("The specific service they want info on (e.g., 'Web Dev' or 'Digital Marketing')."),
        }),
        execute: async ({ sendMethod, targetService }) => {
          console.log(`[SALES] Action item logged to send ${targetService} details via ${sendMethod} to ${callerNumber}`);
          try {
            await prisma.ticket.create({
              data: {
                chatbotId,
                caller: callerNumber,
                type: "SEND_BROCHURE",
                details: { sendMethod, targetService }
              }
            });
            return `Action item logged to send details. Gracefully end the call now.`;
          } catch (error) {
            return "System error logging send details request, but gracefully end the call.";
          }
        }
      });

      const endCall = llm.tool({
        description: "Gracefully end the phone call. Use this when you feel the conversation is over, the prospect is unresponsive, or you have delivered the Warm Close.",
        parameters: z.object({
          reason: z.string().describe("Internal reason for hanging up (e.g., Warm Close, Firm Not Interested, Unresponsive)."),
        }),
        execute: async ({ reason }) => {
          console.log(`[VOICE] End-call requested by AI: ${reason}`);
          
          if (!endCallTimer) {
            // Give the AI exactly 4 seconds to finish speaking its final goodbye sentence
            endCallTimer = setTimeout(() => {
              console.log('[VOICE] Forcing Room Disconnect to terminate telecom call...');
              ctx.room.disconnect().catch(e => console.error('[VOICE] Disconnect error:', e));
            }, 4000); 
          }
          return "The conversation is complete. Say a brief, polite goodbye now; the call will end shortly.";
        },
      });

      // 4. Inject Personality and Tools into the Agent
      const agent = new voice.Agent({
        instructions: `
          ${agentDirective || chatbotDirective}
          
          You are Priya from Prabisha Consulting. You are making an outbound lead-generation call.
          Your tone: Warm, professional, and conversational. Sound human, not scripted. Use filler words sparingly.
          
          CRITICAL CALL FLOW (STRICT ADHERENCE):
          
          - NODE 1 (Opening): Greet the user and check identity ("Am I speaking with ${prospectName}?"). If it's the wrong person, ask for a callback time, use the "scheduleCallback" tool, and end the call.
          - NODE 2 (Web Dev Hook): If confirmed, state you help businesses get their online presence sorted and ask: "are you currently looking at any website development work, or thinking about it?".
          - NODE 3 (Capture Requirement): If YES, ask what they have in mind. Listen without interrupting. Use the "qualifyLead" tool to save their answer, then go to NODE 7.
          - NODE 4 (Pivot): If NO to Web Dev, pivot: "Is there anything on that front you've been meaning to look into, like SEO, digital marketing, or app development?" If YES, go to Node 3. If NO, go to Node 5.
          - NODE 5 (Soft FOMO): If NO to everything, say: "Totally understand... a lot of businesses wait until a competitor pulls ahead online before they act, so if anything comes up, we're here." Then go to NODE 7.
          - NODE 7 (Warm Close): End with: "Thanks so much for your time today... really appreciate you chatting with me. Have a great day ahead!" and use the "endCall" tool.

          OBJECTION HANDLING & TERMINATION RULES:
          - If the user is unresponsive, rude, or you feel the conversation has reached a natural end, politely say goodbye and immediately use the "endCall" tool to hang up.
          - "Busy right now": Offer to send a quick message. Use "sendDetails" tool, then Node 7.
          - "Send details on email/WhatsApp": Ask if they want web dev or marketing info so it's not generic. Use "sendDetails", then go to Node 3.
          - "How much does it cost?": Do not give blind pricing. Say a specialist will put together a no-obligation estimate based on their exact needs.
          - "Already have a website": Ask if they are happy with how it brings in leads or ranks on Google. Pivot to Node 4.
          - "Not interested" (firm): Ask to stay in touch for the future. If yes, go to Node 7. If no, exit immediately using "endCall".
          - "Who gave you my number?": Truthfully state their contact came from ${leadSource}, apologize if caught off guard, and ask for a minute.
          - "Call me later": Ask for a specific day/time, use the "scheduleCallback" tool, and end call.

          Do NOT use markdown, bolding, or bullet points in your speech.
        `,
        tools: { searchKnowledgeBase, qualifyLead, scheduleCallback, sendDetails, endCall },
      });

      session = new voice.AgentSession({
        llm: new google.beta.realtime.RealtimeModel({
          model: 'gemini-3.1-flash-live-preview', 
          voice: voiceId || 'Puck', 
          apiKey: process.env.GOOGLE_API_KEY, 
        }),
      });

      // 5. Capture Real-time Transcriptions
      // @ts-expect-error - LiveKit typings mismatch
      ctx.room.on('transcriptionReceived', (segments: any[], participant: any) => {
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
      
      // 6. Trigger First Speaker / Greeting
      if (metadataAgentId) {
        console.log(`[VOICE] Outbound call connected. Forcing AI to initiate Node 1...`);
        await session.generateReply({ 
          instructions: `You just called the user. Start the conversation IMMEDIATELY by executing NODE 1. Greet the user and ask: "Am I speaking with ${prospectName}?"` 
        });
      } else if (firstSpeaker === 'agent' && greeting) {
        console.log(`[VOICE] Inbound call connected. Triggering standard greeting...`);
        await session.generateReply({ 
          instructions: `Greet the user exactly like this: "${greeting}"` 
        });
      }

    } catch (criticalError) {
      console.error('[VOICE] Fatal error during call setup or execution:', criticalError);
      // Forcefully hang up the phone if the code crashes
      await ctx.room.disconnect();
    }

    // 7. Handle Hangup: Upload files to CDN & Save to Database
    // This will trigger automatically when the caller hangs up OR when ctx.room.disconnect() is called!
    ctx.room.on('disconnected', async () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`[VOICE] Call ended. Duration: ${duration}s. Saving logs...`);
      
      let cdnTranscriptUrl = null;

      if (voiceSettings) {
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
          if (endCallTimer) clearTimeout(endCallTimer);

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
          if (transcript.length > 0 && conversation) {
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