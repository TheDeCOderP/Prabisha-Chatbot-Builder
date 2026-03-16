import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Helper to add WAV header to raw PCM data
function encodeWAV(samples: Buffer, sampleRate: number = 24000) {
  const buffer = Buffer.alloc(44 + samples.length);
  /* RIFF identifier */ buffer.write('RIFF', 0);
  /* file length */ buffer.writeUInt32LE(36 + samples.length, 4);
  /* RIFF type */ buffer.write('WAVE', 8);
  /* format chunk identifier */ buffer.write('fmt ', 12);
  /* format chunk length */ buffer.writeUInt32LE(16, 16);
  /* sample format (raw) */ buffer.writeUInt16LE(1, 20);
  /* channel count */ buffer.writeUInt16LE(1, 22);
  /* sample rate */ buffer.writeUInt32LE(sampleRate, 24);
  /* byte rate (sampleRate * blockAlign) */ buffer.writeUInt32LE(sampleRate * 2, 28);
  /* block align (channelCount * bytesPerSample) */ buffer.writeUInt16LE(2, 32);
  /* bits per sample */ buffer.writeUInt16LE(16, 34);
  /* data chunk identifier */ buffer.write('data', 36);
  /* data chunk length */ buffer.writeUInt32LE(samples.length, 40);
  samples.copy(buffer, 44);
  return buffer;
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const cleanText = text.replace(/<[^>]*>?/gm, '');

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ role: 'user', parts: [{ text: cleanText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } }
      }
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const audioPart = chunk.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (audioPart?.inlineData?.data) {
              const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
              controller.enqueue(new Uint8Array(pcmBuffer));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'audio/pcm',
        'X-Sample-Rate': '24000',
      },
    });

  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}