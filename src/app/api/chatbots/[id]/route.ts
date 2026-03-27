//src/app/api/chatbots/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma';
import { upload } from '@/lib/cloudinary'
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Supported language codes — keep in sync with frontend SUPPORTED_LANGUAGES
const SUPPORTED_LANGUAGE_CODES = ['en', 'ar', 'fr', 'es', 'de', 'pt', 'it', 'nl', 'ru', 'zh', 'ja', 'ko', 'hi'];

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish',
  de: 'German', pt: 'Portuguese', it: 'Italian', nl: 'Dutch',
  ru: 'Russian', zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean', hi: 'Hindi',
};

/**
 * Given a MultilingualSuggestion object that may have gaps,
 * use Gemini to fill in any missing translations.
 */
async function fillMissingTranslations(
  suggestion: Record<string, string>
): Promise<Record<string, string>> {
  console.log('Filling translations for suggestion:', suggestion);

  const filled = Object.entries(suggestion).filter(([, v]) => v?.trim());
  if (filled.length === 0) return suggestion;

  const missing = SUPPORTED_LANGUAGE_CODES.filter(code => !suggestion[code]?.trim());
  if (missing.length === 0) return suggestion;

  const [sourceLang, sourceText] = filled[0];
  const sourceLanguageName = LANGUAGE_NAMES[sourceLang] ?? sourceLang;

  const targetList = missing
    .map(code => `"${code}" (${LANGUAGE_NAMES[code] ?? code})`)
    .join(', ');

  const prompt = `You are a translation assistant. Translate the following chatbot quick-suggestion text from ${sourceLanguageName} into each of these languages: ${targetList}.

Source text: "${sourceText}"

Respond ONLY with a valid JSON object where keys are the language codes and values are the translated strings. No extra text, no markdown fences.
Example: {"fr":"Bonjour","es":"Hola"}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const translations: Record<string, string> = JSON.parse(clean);

    return { ...suggestion, ...translations };
  } catch (err) {
    console.error('Gemini translation error:', err);
    return suggestion;
  }
}

interface RouterParams {
  params: Promise<{ id: string }>
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id } = await context.params;

    const chatbot = await prisma.chatbot.findUnique({ 
      where: { id },
      include: { 
        theme: true,
        logic: true,
        form: true,
      }, 
    })

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    return NextResponse.json(chatbot, { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching chatbot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function PUT(request: NextRequest, context: RouterParams) {
  try {
    const { id } = await context.params;

    const formData = await request.formData();

    // ── Extract fields ────────────────────────────────────────────────────────
    // Only fields that still exist on the Chatbot model
    const name         = formData.get('name')        as string | null;
    const avatarFile   = formData.get('avatar')      as File   | null;
    const iconFile     = formData.get('icon')        as File   | null;
    const popup_onload = formData.get('popup_onload') as string | null;
    const greeting     = formData.get('greeting')    as string | null;
    const directive    = formData.get('directive')   as string | null;
    const description  = formData.get('description') as string | null;
    const suggestions  = formData.get('suggestions') as string | null;
    const model        = formData.get('model')       as string | null;
    const max_tokens   = formData.get('max_tokens')  as string | null;
    const temperature  = formData.get('temperature') as string | null;

    if (!id) {
      return NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 })
    }

    const existingChatbot = await prisma.chatbot.findUnique({ where: { id } });
    if (!existingChatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    // ── Image uploads ─────────────────────────────────────────────────────────
    let avatarUrl: string | undefined;
    if (avatarFile && avatarFile.size > 0) {
      try {
        avatarUrl = await upload(avatarFile, 'chatbot-avatars');
      } catch (error) {
        console.error('Error uploading avatar:', error);
        return NextResponse.json({ error: 'Failed to upload avatar image' }, { status: 500 });
      }
    }

    let iconUrl: string | undefined;
    if (iconFile && iconFile.size > 0) {
      try {
        iconUrl = await upload(iconFile, 'chatbot-icons');
      } catch (error) {
        console.error('Error uploading icon:', error);
        return NextResponse.json({ error: 'Failed to upload icon image' }, { status: 500 });
      }
    }

    // ── Parse & auto-translate greeting ──────────────────────────────────────
    let parsedGreeting: Record<string, string>[] | undefined;
    if (greeting !== null) {
      try {
        const raw = JSON.parse(greeting);

        let greetingObj: Record<string, string>;
        if (Array.isArray(raw)) {
          const first = raw[0];
          greetingObj = (typeof first === 'object' && first !== null)
            ? first as Record<string, string>
            : { en: String(first ?? '') };
        } else if (typeof raw === 'object' && raw !== null) {
          greetingObj = raw as Record<string, string>;
        } else if (typeof raw === 'string') {
          greetingObj = { en: raw };
        } else {
          greetingObj = {};
        }

        const filled = await fillMissingTranslations(greetingObj);
        parsedGreeting = [filled];
      } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON format for greeting' }, { status: 400 });
      }
    }

    // ── Parse & auto-translate suggestions ───────────────────────────────────
    let parsedSuggestions: Record<string, string>[] | undefined;
    if (suggestions !== null) {
      try {
        const raw = JSON.parse(suggestions);

        if (!Array.isArray(raw)) {
          return NextResponse.json({ error: 'Suggestions must be a JSON array' }, { status: 400 });
        }

        const normalized: Record<string, string>[] = raw.map((item) => {
          if (typeof item === 'string') return { en: item };
          if (typeof item === 'object' && item !== null) return item as Record<string, string>;
          return {};
        });

        parsedSuggestions = await Promise.all(normalized.map((s) => fillMissingTranslations(s)));
      } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON format for suggestions' }, { status: 400 });
      }
    }

    // ── Model settings validation ─────────────────────────────────────────────
    if (max_tokens !== null) {
      const n = parseInt(max_tokens);
      if (isNaN(n) || n < 1 || n > 8192) {
        return NextResponse.json({ error: 'max_tokens must be a number between 1 and 8192' }, { status: 400 });
      }
    }
    if (temperature !== null) {
      const n = parseFloat(temperature);
      if (isNaN(n) || n < 0 || n > 2) {
        return NextResponse.json({ error: 'temperature must be a number between 0 and 2' }, { status: 400 });
      }
    }

    // ── Build update payload ──────────────────────────────────────────────────
    // Only fields that exist on the simplified Chatbot model
    const updateData: any = {};

    if (name              !== null)      updateData.name        = name;
    if (avatarUrl         !== undefined) updateData.avatar      = avatarUrl;
    if (iconUrl           !== undefined) updateData.icon        = iconUrl;
    if (popup_onload      !== null)      updateData.popup_onload = popup_onload === 'true';
    if (parsedGreeting    !== undefined) updateData.greeting    = parsedGreeting;
    if (directive         !== null)      updateData.directive   = directive;
    if (description       !== null)      updateData.description = description;
    if (parsedSuggestions !== undefined) updateData.suggestions = parsedSuggestions;
    if (model             !== null)      updateData.model       = model;
    if (max_tokens        !== null)      updateData.max_tokens  = parseInt(max_tokens);
    if (temperature       !== null)      updateData.temperature = parseFloat(temperature);

    const updatedChatbot = await prisma.chatbot.update({ where: { id }, data: updateData });

    return NextResponse.json({
      message: 'Chatbot updated successfully',
      chatbot: updatedChatbot,
    });
  } catch (error) {
    console.error('Error updating chatbot', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouterParams) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversation: { chatbotId: id } } }),
      prisma.document.deleteMany({ where: { knowledgeBase: { chatbotId: id } } }),
      prisma.lead.deleteMany({ where: { chatbotId: id } }),
      prisma.conversation.deleteMany({ where: { chatbotId: id } }),
      prisma.knowledgeBase.deleteMany({ where: { chatbotId: id } }),
      prisma.chatbotForm.deleteMany({ where: { chatbotId: id } }),
      prisma.chatbotLogic.deleteMany({ where: { chatbotId: id } }),
      prisma.chatbot.delete({ where: { id } }),
    ]);

    return NextResponse.json({ message: 'Chatbot deleted successfully' });
  } catch (error) {
    console.error('Error deleting chatbot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}