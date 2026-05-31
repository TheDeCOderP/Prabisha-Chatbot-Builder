import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache';
import { getToken } from 'next-auth/jwt';
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

const cacheHeaders = {
  ...corsHeaders,
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function GET(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id } = await context.params;

    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
      // Deliberately exclude workspace/member data from the public endpoint.
      // Only theme, logic, and form are needed by the embed widget.
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        avatar: true,
        popup_onload: true,
        greeting: true,
        suggestions: true,
        directive: true,
        model: true,
        max_tokens: true,
        temperature: true,
        domain: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        theme: true,
        logic: true,
        form: {
          select: {
            id: true,
            title: true,
            description: true,
            fields: true,
            leadTiming: true,
            leadFormStyle: true,
            cadence: true,
            successMessage: true,
            redirectUrl: true,
            autoClose: true,
            showThankYou: true,
            // notifyEmail and webhookUrl are admin-only; never expose to embed
          },
        },
      },
    })

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    return NextResponse.json(chatbot, { status: 200, headers: cacheHeaders })
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
    const token = await getToken({ req: request });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 })
    }

    // Verify the caller is a member of the workspace that owns this chatbot
    const existingChatbot = await prisma.chatbot.findFirst({
      where: {
        id,
        workspace: {
          members: { some: { userId: token.sub } },
        },
      },
    });
    if (!existingChatbot) {
      return NextResponse.json({ error: 'Chatbot not found or access denied' }, { status: 404 })
    }

    const formData = await request.formData();

    // ── Extract fields ────────────────────────────────────────────────────────
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
    const domain       = formData.get('domain')      as string | null;
    const isPublished  = formData.get('isPublished') as string | null;

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
    // Gemini is only called when the English source text has actually changed,
    // so routine saves (color tweaks, model changes, etc.) are free.
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

        // Compare incoming English text with what is already stored
        const existingGreeting = Array.isArray(existingChatbot.greeting)
          ? (existingChatbot.greeting[0] as Record<string, string> | undefined)
          : undefined;
        const existingEnGreeting = existingGreeting?.en ?? '';
        const incomingEnGreeting = greetingObj.en ?? '';

        if (incomingEnGreeting !== existingEnGreeting) {
          // English text changed → fill missing translations via Gemini
          const filled = await fillMissingTranslations(greetingObj);
          parsedGreeting = [filled];
        } else {
          // No change in source text → keep existing translations, just store as-is
          parsedGreeting = [greetingObj];
        }
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

        // Retrieve existing English suggestion texts for comparison
        const existingSuggestions = Array.isArray(existingChatbot.suggestions)
          ? (existingChatbot.suggestions as Record<string, string>[])
          : [];

        parsedSuggestions = await Promise.all(
          normalized.map((s, i) => {
            const existingEn = existingSuggestions[i]?.en ?? '';
            const incomingEn = s.en ?? '';
            // Only hit Gemini if the English text for this suggestion changed
            if (incomingEn !== existingEn) {
              return fillMissingTranslations(s);
            }
            return Promise.resolve(s);
          })
        );
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
    
    // New fields — validate domain format before persisting
    if (domain !== null) {
      if (domain !== '') {
        try {
          const parsed = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return NextResponse.json({ error: 'domain must be a valid http/https URL' }, { status: 400 });
          }
          updateData.domain = domain;
        } catch {
          return NextResponse.json({ error: 'domain must be a valid URL' }, { status: 400 });
        }
      } else {
        updateData.domain = null;
      }
    }
    if (isPublished !== null) updateData.isPublished = isPublished === 'true';

    const updatedChatbot = await prisma.chatbot.update({ where: { id }, data: updateData });

    revalidateTag(`chatbot-config-${id}`, 'default');

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
    const token = await getToken({ req: request });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Chatbot ID is required' }, { status: 400 })
    }

    // Only OWNER or ADMIN of the workspace may delete a chatbot
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id,
        workspace: {
          members: {
            some: {
              userId: token.sub,
              role: { in: ['OWNER', 'ADMIN'] },
            },
          },
        },
      },
    });
    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found or access denied' }, { status: 404 });
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