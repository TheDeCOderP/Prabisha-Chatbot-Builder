import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { sttLimiter, getRequestIdentifier } from '@/lib/rate-limit';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Gemini reliably accepts these container/codec combos for audio understanding.
// The client records WAV (PCM16) so this is the expected default, but we pass through
// whatever the browser produced and let Gemini handle it.
const ALLOWED_AUDIO_PREFIXES = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/mp4'];

// ~10 MB ceiling — a normal voice query is a few hundred KB; this just caps abuse.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// BCP-47 → readable name so the model doesn't misread a bare code like "ar".
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', pa: 'Punjabi', kn: 'Kannada', te: 'Telugu',
  bn: 'Bengali', gu: 'Gujarati', ja: 'Japanese', fr: 'French', es: 'Spanish',
  ar: 'Arabic', zh: 'Chinese', de: 'German', pt: 'Portuguese', it: 'Italian',
  nl: 'Dutch', ru: 'Russian', ko: 'Korean',
};

export async function POST(request: NextRequest) {
  try {
    // Rate limit — transcription is a paid model call; cap per IP.
    const identifier = getRequestIdentifier(request);
    const rate = sttLimiter.check(identifier);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before using voice again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const formData = await request.formData();
    const audio = formData.get('audio');
    const langRaw = (formData.get('lang') as string | null)?.trim() || '';

    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio too large' }, { status: 413 });
    }

    const mimeType = (audio.type || 'audio/wav').split(';')[0];
    if (!ALLOWED_AUDIO_PREFIXES.some(p => mimeType === p)) {
      return NextResponse.json({ error: `Unsupported audio type: ${mimeType}` }, { status: 415 });
    }

    const arrayBuffer = await audio.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Use just the base language subtag (e.g. "en" from "en-US") for the name lookup.
    const baseLang = langRaw.split('-')[0].toLowerCase();
    const langName = LANGUAGE_NAMES[baseLang];
    const langHint = langName ? ` The speaker is talking in ${langName}.` : '';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          {
            text:
              `Transcribe the speech in this audio clip to plain text.${langHint} ` +
              `Return ONLY the exact transcript — no quotes, no labels, no commentary, no translation. ` +
              `If there is no intelligible speech, return an empty string.`,
          },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      config: { temperature: 0, maxOutputTokens: 512 },
    });

    const transcript = (response.text || '').trim();
    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    console.error('STT Error:', error);
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
