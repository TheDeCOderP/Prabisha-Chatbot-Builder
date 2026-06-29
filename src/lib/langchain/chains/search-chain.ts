// lib/langchain/search-chain.ts
import { searchSimilar } from '@/lib/langchain/vector-store';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface SearchChainConfig {
  chatbotId: string;
  conversationId?: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  chatbot?: any;
  /**
   * BCP-47 language code (e.g. 'en', 'ja', 'hi', 'fr', 'es', 'ar').
   * The AI will always respond in this language regardless of what language
   * the knowledge-base content or system prompt is written in.
   * Defaults to 'en'.
   */
  language?: string;
  /** Browser context passed from the frontend for richer humanised responses */
  clientContext?: {
    timezone?: string;
    pageUrl?: string;
    isReturning?: boolean;
  };
}

export interface SearchChainResult {
  response: string;
  htmlResponse: string;
  knowledgeContext?: string;
  logicContext?: string;
  triggeredLogics?: any[];
  conversationId: string;
  sourcesUsed?: number;
  sourceUrls?: Array<{ title: string; url: string }>;
}

// Retry utility for LLM calls with exponential backoff and jitter

const RETRYABLE_CODES = new Set([429, 503, 502, 504]);
const RETRYABLE_MESSAGES = ['high demand', 'unavailable', 'overloaded', 'ECONNRESET', 'rate limit'];

function isRetryable(error: any): boolean {
  const status = error?.status ?? error?.code;
  if (RETRYABLE_CODES.has(status)) return true;
  const msg = String(error?.message ?? '').toLowerCase();
  return RETRYABLE_MESSAGES.some(s => msg.includes(s));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    maxRetries = 3,
    baseDelayMs = 500,
    label = 'Gemini call',
  }: { maxRetries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      if (!isRetryable(err) || attempt === maxRetries) {
        throw err;
      }

      const jitter = Math.random() * 300;
      const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
      console.warn(`⚠️ [${label}] attempt ${attempt + 1} failed (${err?.status ?? err?.code}), retrying in ${Math.round(delay)}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw lastError;
}

// ─── Timer utility ────────────────────────────────────────────────────────────
function timer(label: string) {
  const start = Date.now();
  return {
    end: () => {
      const ms = Date.now() - start;
      console.log(`⏱️ [search-chain] ${label}: ${ms}ms`);
      return ms;
    }
  };
}

// ─── Language directive ───────────────────────────────────────────────────────
/**
 * Returns a hard language instruction that is prepended to every prompt.
 * Using BCP-47 names so the model can't misinterpret a bare code like "ar".
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ja: 'Japanese (日本語)',
  hi: 'Hindi (हिन्दी)',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
  ar: 'Arabic (العربية)',
  zh: 'Chinese (中文)',
  de: 'German (Deutsch)',
};

// Conservative, order-preserving normalization: lowercase, strip punctuation, collapse
// whitespace. We intentionally do NOT reorder or drop words — alphabetizing the words
// made different questions ("return policy" vs "policy return", "is X better than Y"
// vs "is Y better than X") collide to the same cache key and serve the WRONG stored
// answer. Cache correctness matters more than hit rate.
function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim();
}

// Fold the language into the hash so the same question in different languages produces
// different cache keys. The unique constraint is only [chatbotId, questionHash], so
// without this an English answer and a Hindi answer would overwrite each other.
function hashQuestion(normalized: string, language: string): string {
  return createHash('sha256').update(`${language}::${normalized}`).digest('hex');
}

function languageDirective(language: string): string {
  const name = LANGUAGE_NAMES[language] ?? language;
  return `\
────────────────────────
LANGUAGE RULE (HIGHEST PRIORITY)
────────────────────────
You MUST respond exclusively in ${name}.
Do NOT switch languages for any reason — even if the source documents,
conversation history, or user message are in a different language.
All output HTML, labels, and prose must be in ${name}.

`;
}

async function getCachedResponse(chatbotId: string, userMessage: string, language: string) {
  const normalized = normalizeQuestion(userMessage);
  const hash = hashQuestion(normalized, language);

  const cached = await prisma.questionCache.findUnique({
    where: {
      chatbotId_questionHash: { chatbotId, questionHash: hash },
    }
  });

  if (cached) {
    // Update hit count async - don't await
    prisma.questionCache.update({
      where: { id: cached.id },
      data: { hitCount: { increment: 1 }, lastUsedAt: new Date() }
    }).catch(() => {});
    return cached.htmlResponse;
  }
  return null;
}

async function setCachedResponse(chatbotId: string, userMessage: string, htmlResponse: string, language = 'en') {
  const normalized = normalizeQuestion(userMessage);
  const hash = hashQuestion(normalized, language);

  await prisma.questionCache.upsert({
    where: { chatbotId_questionHash: { chatbotId, questionHash: hash } },
    update: { htmlResponse, language, lastUsedAt: new Date() },
    create: { chatbotId, normalizedQ: normalized, questionHash: hash, htmlResponse, language }
  });
}

// ─── Real-time intent detection ───────────────────────────────────────────────
interface RealtimeIntent {
  isRealtime: boolean;
  type: 'PRICE' | 'TIME' | 'AVAILABILITY' | 'NEWS' | 'WEATHER' | 'STOCK' | null;
}

const REALTIME_PATTERNS: Array<{ pattern: RegExp; type: RealtimeIntent['type'] }> = [
  { pattern: /\b(price|cost|how much|rate|fee|charge|pricing)\b/i, type: 'PRICE' },
  { pattern: /\b(time|clock|now|current time|what time|today|date|open|closed|hours)\b/i, type: 'TIME' },
  { pattern: /\b(available|availability|in stock|stock|inventory|left)\b/i, type: 'AVAILABILITY' },
  { pattern: /\b(news|latest|recent|update|today|breaking|just|happened)\b/i, type: 'NEWS' },
  { pattern: /\b(weather|temperature|forecast|rain|sunny)\b/i, type: 'WEATHER' },
  { pattern: /\b(stock|share price|market|nasdaq|nse|bse|crypto|bitcoin|eth)\b/i, type: 'STOCK' },
];

function detectRealtimeIntent(message: string): RealtimeIntent {
  for (const { pattern, type } of REALTIME_PATTERNS) {
    if (pattern.test(message)) {
      return { isRealtime: true, type };
    }
  }
  return { isRealtime: false, type: null };
}

// Minimum top retrieval score for the context to be considered "strong" enough to
// surface Sources to the user. Below this we still pass the context to the model
// (it self-limits via the prompt) but don't advertise sources.
const STRONG_CONTEXT_THRESHOLD = 0.35;

// ─── Prompts ──────────────────────────────────────────────────────────────────
const QUERY_REWRITE_PROMPT = `
You are an expert search query optimizer for a semantic vector database.

Your task:
Generate 1-2 high-quality alternative search queries that improve retrieval coverage
while preserving the user's original intent exactly.

STRICT RULES:
- Do NOT change the meaning of the question
- Preserve all product names, brands, model numbers, and proper nouns
- Do NOT introduce new assumptions
- Each variation must target a different semantic angle (features, benefits, pricing, comparison, use case, etc.)
- 5-12 words per variation
- Avoid filler words

User question:
"{question}"

Output format (plain text, one per line, no numbering):
[variation]
[variation]
`;

const RAG_ANSWER_PROMPT = `
{languageDirective}
{systemPrompt}

You have relevant knowledge below. Use it to answer like a smart friend who knows this stuff — not like a search engine.

────────────────────────
HOW TO ANSWER
────────────────────────
- Get to the point in the FIRST sentence — don't build up to the answer
- Write naturally, not like an article — vary sentence length, use contractions
- Use "I" naturally: "From what I can see...", "Honestly...", "The short answer is..."
- If the question is simple, give a SHORT answer (1–3 sentences). Don't pad it.
- If it needs detail, be detailed — but still conversational, not formal
- Never fabricate URLs, prices, features, or policies
- If something isn't in the context, say "I'm not sure about that" plainly

────────────────────────
FORMAT
────────────────────────
- PREFER short paragraphs over long walls of text
- Wrap paragraphs in <p>
- Use <ul><li> ONLY for genuine lists (3+ truly list-like items) — don't convert natural prose into bullets
- Use <strong> sparingly — only for the most critical term in a sentence
- No markdown, no <br> tags
- End with ONE short, natural follow-up question in <p class="follow-up-question">...</p>
  (Make it feel like something a real person would ask, not a formal "Would you like to know more about X?")

────────────────────────
CITATION RULES
────────────────────────
When using info from a chunk that has a URL, cite inline:
<cite data-url="FULL_URL">Page Title</cite>
Do NOT invent URLs. Skip citation if no URL exists.

────────────────────────
CONTEXT:
{context}

CONVERSATION HISTORY:
{history}

USER:
{question}

Return ONLY clean HTML.
`;

const GENERAL_ANSWER_PROMPT = `
{languageDirective}
{systemPrompt}

────────────────────────
CONVERSATION HISTORY:
{history}

AVAILABLE ACTIONS:
{logicContext}

USER:
{question}

────────────────────────
NO KNOWLEDGE-BASE MATCH (IMPORTANT)
────────────────────────
You have no specific documents for this question. So:
- Answer general or conversational questions naturally and helpfully, staying in character.
- Do NOT invent company-specific facts — prices, policies, features, dates, names, URLs, availability, contact details. If the user asks for a specific detail you don't actually know, say so plainly and briefly in your own voice, then offer a useful next step (rephrasing, or one of the AVAILABLE ACTIONS above if relevant).
- Never pretend you looked something up or have data you don't.

────────────────────────
FORMAT
────────────────────────
- Get to the point in the first sentence
- Short paragraphs, wrapped in <p>
- Use <ul><li> ONLY for genuine lists (3+ items) — not for normal prose
- Use <strong> sparingly
- No markdown, no <br> tags
- End with ONE short, natural follow-up question in <p class="follow-up-question">...</p>

Return ONLY clean HTML.
`;

// ─── rewriteQuery ─────────────────────────────────────────────────────────────
export async function rewriteQuery(userMessage: string): Promise<string[]> {
  if (userMessage.trim().split(/\s+/).length <= 5) {
    console.log('⚡ [rewriteQuery] short query — skipping rewrite, using original only');
    return [userMessage];
  }

  const t = timer('rewriteQuery (LLM call)');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: QUERY_REWRITE_PROMPT.replace('{question}', userMessage) }] }],
      config: { maxOutputTokens: 100, temperature: 0.3 },
    });
    t.end();

    const text = response.text ?? '';
    const variations = text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(v => v.length > 0)
      .slice(0, 2);

    const queries = [userMessage, ...variations].slice(0, 2);
    console.log('🔄 Query variations:', queries);
    return queries;
  } catch (error) {
    t.end();
    console.error('Query rewrite error:', error);
    return [userMessage];
  }
}

// ─── searchKnowledgeBases ─────────────────────────────────────────────────────
export async function searchKnowledgeBases(
  chatbot: any,
  queries: string[]
): Promise<{
  context: string;
  sources: Array<{ title: string; url: string; score: number }>;
  bestScore: number;
}> {
  if (!chatbot.knowledgeBases?.length) return { context: '', sources: [], bestScore: 0 };

  const tTotal = timer(`searchKnowledgeBases (${queries.length} queries × ${chatbot.knowledgeBases.length} KBs)`);

  const allResults: any[] = [];
  const seenContent = new Set<string>();
  const sourceUrls = new Map<string, { title: string; url: string; score: number }>();

  for (const query of queries) {
    for (const kb of chatbot.knowledgeBases) {
      const tKb = timer(`  KB "${kb.name}" query: "${query.substring(0, 30)}"`);
      try {
        const results = await searchSimilar({
          query,
          chatbotId: chatbot.id,
          knowledgeBaseId: kb.id,
          limit: 12,
          threshold: 0.3,
        });
        tKb.end();

        console.log(`📊 ${kb.name} (query: "${query}"): ${results.length} results`);
        if (results.length > 0) {
          const topScores = results.slice(0, 3).map(r => r.score.toFixed(3)).join(', ');
          console.log(`   Top scores: ${topScores}`);
        }

        for (const result of results) {
          const contentHash = result.content.substring(0, 100);
          if (!seenContent.has(contentHash)) {
            seenContent.add(contentHash);
            allResults.push({ ...result, kbName: kb.name, query });

            let sourceUrl = result.metadata?.source || result.metadata?.url;
            let sourceTitle = result.metadata?.title || result.metadata?.filename || kb.name;

            if (sourceUrl && (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://'))) {
              const existingSource = sourceUrls.get(sourceUrl);
              if (!existingSource || result.score > existingSource.score) {
                sourceUrls.set(sourceUrl, { title: sourceTitle || 'Untitled Source', url: sourceUrl, score: result.score });
              }
            }
          }
        }
      } catch (error) {
        tKb.end();
        console.error(`❌ ${kb.name}:`, error);
      }
    }
  }

  if (!allResults.length) {
    tTotal.end();
    console.log('❌ No results found');
    return { context: '', sources: [], bestScore: 0 };
  }

  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  const bestScore = allResults[0]?.score ?? 0;
  const top = selectDiverseResults(allResults, 15);

  console.log(`✅ Selected ${top.length} diverse results for context`);
  console.log(`   Score range: ${top[0]?.score.toFixed(3)} - ${top[top.length - 1]?.score.toFixed(3)}`);

  const formatted = top.map((r, i) => {
    const src = r.metadata?.source || r.metadata?.url;
    const title = r.metadata?.title;
    // Only include a label when there's a real URL to cite — KB names get echoed by the model
    if (src && (src.startsWith('http://') || src.startsWith('https://')) && title) {
      return `[Source: ${title} (${src})]\n${r.content}`;
    }
    return r.content;
  }).join('\n\n---\n\n');

  const context = `KNOWLEDGE BASE CONTEXT:\n\n${formatted}\n\n(Total sources: ${top.length})`;

  const sources = Array.from(sourceUrls.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  tTotal.end();
  return { context, sources, bestScore };
}

function selectDiverseResults(results: any[], limit: number): any[] {
  const selected: any[] = [];
  const keywords = new Set<string>();

  for (const result of results) {
    if (selected.length >= limit) break;
    const terms = result.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
    const newTerms = terms.filter((t: string) => !keywords.has(t));
    const novelty = newTerms.length / Math.max(terms.length, 1);

    if (result.score > 0.5 || novelty > 0.3 || selected.length < 5) {
      selected.push(result);
      newTerms.forEach((t: string) => keywords.add(t));
    }
  }

  return selected;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatHistory(messages: any[]): string {
  if (!messages.length) return "This is the start of the conversation.";
  const recent = messages.slice(-6);
  return recent.map(m =>
    `${m.senderType === 'USER' ? 'User' : 'Assistant'}: ${m.senderType === 'BOT' ? stripHtml(m.content) : m.content}`
  ).join('\n');
}

// Short follow-ups ("why?", "tell me more", "pricing") lose meaning on their own.
// Attach the previous assistant turn so the model answers in context instead of
// generically. Shared by both the streaming and non-streaming paths.
const SHORT_FOLLOWUP_RE = /^(why|how|pricing|cost|tell me more|more|what about that|and that|so)\b/i;
export function enrichFollowUp(userMessage: string, history: any[]): string {
  const trimmed = userMessage.trim();
  if (history.length > 0 && (trimmed.length <= 18 || SHORT_FOLLOWUP_RE.test(trimmed))) {
    const lastAssistant = [...history].reverse().find(m => m.senderType === 'BOT');
    if (lastAssistant) {
      return `
User follow-up question:
"${userMessage}"

This refers to the previous assistant response:
${lastAssistant.content}
`;
    }
  }
  return userMessage;
}

export async function getLogicContext(chatbot: any, message: string, preloadedLogic?: any): Promise<string> {
  const t = timer('getLogicContext');
  let ctx = '';

  const chatbotLogic = preloadedLogic ?? await prisma.chatbotLogic.findUnique({ where: { chatbotId: chatbot.id } });

  if (!chatbotLogic || !chatbotLogic.triggers) {
    t.end();
    return ctx;
  }

  try {
    const triggers = typeof chatbotLogic.triggers === 'string'
      ? JSON.parse(chatbotLogic.triggers)
      : chatbotLogic.triggers;
    if (!Array.isArray(triggers)) { t.end(); return ctx; }

    for (const trigger of triggers) {
      const keywords = trigger.keywords || [];
      const feature = trigger.feature || trigger.type;
      const hasKeyword = keywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()));

      if (hasKeyword) {
        switch (feature) {
          case 'linkButton':
          case 'LINK_BUTTON':
            let buttonText = 'this link';
            if (chatbotLogic.linkButtonConfig) {
              try {
                const linkConfig = JSON.parse(chatbotLogic.linkButtonConfig as string);
                buttonText = linkConfig.buttonText || 'this link';
              } catch (e) { console.error('Error parsing link button config:', e); }
            }
            ctx += `\nAVAILABLE ACTION: You can offer the user: "${buttonText}"\n`;
            break;
          case 'meetingSchedule':
          case 'SCHEDULE_MEETING':
            ctx += '\nAVAILABLE ACTION: You can offer to schedule a meeting with the user.\n';
            break;
          case 'leadCollection':
          case 'COLLECT_LEADS':
            ctx += '\nAVAILABLE ACTION: You can ask the user for their contact information.\n';
            break;
        }
      }
    }
  } catch (e) {
    console.error('Error parsing logic triggers:', e);
  }

  t.end();
  return ctx;
}

function generateSystemPrompt(chatbot: any, clientContext?: { timezone?: string; pageUrl?: string; isReturning?: boolean }): string {
  const directive = chatbot.directive?.trim() || "You are a helpful assistant.";
  const name = chatbot.name ? `Your name is ${chatbot.name}.` : '';
  const personality = chatbot.description?.trim()
    ? `About you: ${chatbot.description}`
    : '';

  // Real-time context
  const now = new Date();
  const tz = clientContext?.timezone || 'UTC';

  const userLocalTime = now.toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  const timeContext = `Current date & time (user's local): ${userLocalTime}`;

  const pageContext = clientContext?.pageUrl
    ? `User is currently on: ${clientContext.pageUrl}`
    : '';

  const returningContext = clientContext?.isReturning
    ? `This is a returning user continuing a previous conversation.`
    : `This is a new user — first interaction.`;

  const contextBlock = [timeContext, pageContext, returningContext].filter(Boolean).join('\n');

  return `${directive}

${name}
${personality}

${contextBlock}

Tone & style:
- Talk like a real person, not a corporate FAQ bot
- Be warm, direct, and conversational — like a knowledgeable friend helping out
- Use "I" naturally. Say things like "I'd suggest...", "Honestly...", "The thing is..."
- Match the user's energy — casual if they're casual, detailed if they ask for detail
- Never start with "Certainly!", "Of course!", "Great question!" or similar filler
- If you don't know something, say so plainly — don't pad it with apologies
- Keep answers focused. Don't repeat yourself or over-explain`.trim();
}

export async function checkLogicTriggers(chatbot: any, message: string, preloadedLogic?: any) {
  const t = timer('checkLogicTriggers');
  const triggered: any[] = [];

  const chatbotLogic = preloadedLogic ?? await prisma.chatbotLogic.findUnique({ where: { chatbotId: chatbot.id } });

  if (!chatbotLogic || !chatbotLogic.triggers || !chatbotLogic.isActive) {
    t.end();
    return triggered;
  }

  try {
    const triggers = typeof chatbotLogic.triggers === 'string'
      ? JSON.parse(chatbotLogic.triggers)
      : chatbotLogic.triggers;
    if (!Array.isArray(triggers)) { t.end(); return triggered; }

    for (const trigger of triggers) {
      const keywords = trigger.keywords || [];
      const hasKeyword = keywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()));

      if (hasKeyword) {
        const logic: any = {
          id: chatbotLogic.id,
          chatbotId: chatbotLogic.chatbotId,
          type: trigger.feature?.toUpperCase() || trigger.type,
          triggerType: trigger.triggerType || 'KEYWORD',
          keywords: trigger.keywords || [],
          name: chatbotLogic.name,
          description: chatbotLogic.description,
          isActive: chatbotLogic.isActive,
          showAlways: trigger.showAlways || false,
          showAtEnd: trigger.showAtEnd || false,
          showOnButton: trigger.showOnButton || false,
          config: {}
        };

        switch (trigger.feature || trigger.type) {
          case 'linkButton':
          case 'LINK_BUTTON':
            if (chatbotLogic.linkButtonConfig) {
              try { logic.config = { linkButton: JSON.parse(chatbotLogic.linkButtonConfig as string) }; }
              catch (e) { console.error('Error parsing link button config:', e); }
            }
            break;
          case 'meetingSchedule':
          case 'SCHEDULE_MEETING':
            if (chatbotLogic.meetingScheduleConfig) {
              try { logic.config = { meetingSchedule: JSON.parse(chatbotLogic.meetingScheduleConfig as string) }; }
              catch (e) { console.error('Error parsing meeting schedule config:', e); }
            }
            break;
          case 'leadCollection':
          case 'COLLECT_LEADS':
            if (chatbotLogic.leadCollectionConfig) {
              try { logic.config = { leadCollection: JSON.parse(chatbotLogic.leadCollectionConfig as string) }; }
              catch (e) { console.error('Error parsing lead collection config:', e); }
            }
            break;
        }

        triggered.push(logic);
      }
    }
  } catch (e) {
    console.error('Error checking logic triggers:', e);
  }

  t.end();
  return triggered;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function cleanHtmlResponse(html: string): string {
  let cleaned = html;
  cleaned = cleaned.replace(/>\s+</g, '><');
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/<\/p>/g, '</p>');
  cleaned = cleaned.replace(/<\/li>/g, '</li>');
  cleaned = cleaned.replace(/<\/ul>/g, '</ul>');
  cleaned = cleaned.replace(/<\/ol>/g, '</ol>');
  cleaned = cleaned.replace(/(<br\s*\/?>){2,}/gi, '<br>');
  cleaned = cleaned.replace(/^<br\s*\/?>/i, '');
  cleaned = cleaned.replace(/<br\s*\/?>$/i, '');
  cleaned = cleaned.replace(/<\/p><p>/g, '</p><p style="margin-top: 12px;">');
  cleaned = cleaned.replace(/<ul>/g, '<ul style="margin: 12px 0; padding-left: 24px;">');
  cleaned = cleaned.replace(/<ol>/g, '<ol style="margin: 12px 0; padding-left: 24px;">');
  cleaned = cleaned.replace(/<li>/g, '<li style="margin-bottom: 6px;">');
  cleaned = cleaned.replace(/^<p style="margin-top: 12px;">/, '<p>');

  cleaned = cleaned.replace(
    /<cite data-url="([^"]+)">([^<]+)<\/cite>/g,
    (_, url, label) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" ` +
      `style="display:inline-flex;align-items:center;gap:3px;color:#2563eb;` +
      `font-size:0.75em;font-weight:500;text-decoration:none;` +
      `background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;` +
      `padding:1px 5px;margin-left:3px;vertical-align:middle;white-space:nowrap;" ` +
      `title="${label}">` +
      `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" style="flex-shrink:0">` +
      `<path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
      `</svg>${label}</a>`
  );

  if (!cleaned.startsWith('<div') && !cleaned.startsWith('<p')) {
    cleaned = `<div style="line-height: 1.6; color: #1f2937;">${cleaned}</div>`;
  } else if (cleaned.startsWith('<p')) {
    cleaned = `<div style="line-height: 1.6; color: #1f2937;">${cleaned}</div>`;
  }
  return cleaned;
}

function ensureHtmlFormat(text: string): string {
  // Already has HTML — pass through
  if (/<[^>]+>/.test(text)) return text;

  const lines = text.split('\n');
  const output: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      output.push(`<ul style="margin:10px 0;padding-left:22px;">${listBuffer.join('')}</ul>`);
      listBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flushList(); continue; }

    // Heading patterns: "## Foo", "**Foo**", "Foo:" at start of a block
    if (/^#{1,3}\s+/.test(line)) {
      flushList();
      const txt = line.replace(/^#{1,3}\s+/, '');
      output.push(`<p style="margin:14px 0 4px;font-weight:600;color:#111;">${txt}</p>`);
      continue;
    }

    // Bold-only line used as heading: **Foo** or __Foo__
    if (/^\*\*[^*]+\*\*$/.test(line) || /^__[^_]+__$/.test(line)) {
      flushList();
      const txt = line.replace(/^\*\*|\*\*$|^__|__$/g, '');
      output.push(`<p style="margin:14px 0 4px;font-weight:600;color:#111;">${txt}</p>`);
      continue;
    }

    // List items: "- foo", "• foo", "* foo", "1. foo"
    if (/^[-•*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const txt = line.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '');
      // inline bold
      const formatted = txt.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      listBuffer.push(`<li style="margin-bottom:5px;">${formatted}</li>`);
      continue;
    }

    // Regular paragraph line — flush any open list first
    flushList();
    // inline bold
    const formatted = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    output.push(`<p style="margin:8px 0;">${formatted}</p>`);
  }

  flushList();
  return output.join('');
}

function appendReadMoreSection(
  htmlResponse: string,
  sources: Array<{ title: string; url: string }>
): string {
  if (!sources.length) return htmlResponse;

  const inlineCiteUrls = new Set<string>();
  const citeRegex = /data-url="([^"]+)"/g;
  let match;
  while ((match = citeRegex.exec(htmlResponse)) !== null) {
    inlineCiteUrls.add(match[1]);
  }

  // If every source is already cited inline, skip the section entirely
  const uncitedSources = sources.filter(s => !inlineCiteUrls.has(s.url));
  const sourcesToShow = uncitedSources.length > 0 ? uncitedSources : sources;

  const sourceItems = sourcesToShow.map((source) => {
    let hostname = '';
    try { hostname = new URL(source.url).hostname.replace('www.', ''); } catch {}

    return `<a href="${source.url}"
       target="_blank"
       rel="noopener noreferrer"
       style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;text-decoration:none;"
     >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;color:#94a3b8">
        <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1">
        <span style="font-size:12px;font-weight:500;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${source.title}</span>
        ${hostname ? `<span style="font-size:10px;color:#9ca3af">${hostname}</span>` : ''}
      </span>
    </a>`;
  }).join('');

  const count = sourcesToShow.length;
  const readMoreSection = `<details style="margin-top:14px;border-top:1px solid #f1f5f9;padding-top:10px;">
  <summary style="cursor:pointer;display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;letter-spacing:0.06em;color:#9ca3af;text-transform:uppercase;list-style:none;-webkit-user-select:none;user-select:none;outline:none;">
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="flex-shrink:0;transition:transform 0.2s">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Sources (${count})
  </summary>
  <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${sourceItems}</div>
</details>`;

  return htmlResponse + readMoreSection;
}

type IntentType = 'GREETING' | 'FEATURE' | 'GENERAL';

function detectIntent(message: string): IntentType {
  const text = message.trim().toLowerCase();

  // Greeting detection
  const greetings = [
    'hi',
    'hello',
    'hey',
    'good morning',
    'good evening',
    'good afternoon'
  ];

  if (greetings.some(g => text === g || text.startsWith(g + ' '))) {
    return 'GREETING';
  }

  // Feature / product info queries
  const featureKeywords = [
    'feature',
    'features',
    'pricing',
    'price',
    'plan',
    'plans',
    'cost',
    'how',
    'what',
    'use case',
    'use cases',
    'example',
    'examples',
    'capability',
    'capabilities',
    'integration',
    'integrations',
    'benefits',
    'advantages'
  ];

  if (featureKeywords.some(keyword => text.includes(keyword))) {
    return 'FEATURE';
  }

  return 'GENERAL';
}

// ─── Greeting fast-path ─────────────────────────────────────────────────────────
/**
 * Short, persona-aware reply to a bare greeting ("hi"/"hello"). Uses a tiny LLM call
 * so the tone matches the bot's persona and the language is correct — instead of a
 * single hardcoded English line that felt robotic and repeated on every greeting.
 */
export async function generateGreetingResponse(chatbot: any, language: string): Promise<string> {
  const systemPrompt = generateSystemPrompt(chatbot);
  const langDirective = languageDirective(language);
  const nameHint = chatbot?.name ? ` Your name is ${chatbot.name}.` : '';

  try {
    const response = await ai.models.generateContent({
      model: chatbot?.model || 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `${langDirective}${systemPrompt}

The user just greeted you (e.g. "hi" / "hello").${nameHint} Reply with ONE short, warm, natural greeting (max ~12 words) that invites them to ask their question. Vary the wording so it never sounds scripted — do NOT default to "How can I help you today". Wrap it in a single <p> tag. Output only the HTML.`,
        }],
      }],
      config: { maxOutputTokens: 60, temperature: 0.85 },
    });
    const text = response.text?.trim();
    if (text && /<p[\s>]/i.test(text)) return text;
    if (text) return `<p>${text.replace(/<\/?[^>]+>/g, '')}</p>`;
  } catch {
    /* fall through to static fallback */
  }

  // Static fallback — still persona-light, not the old fixed line
  return chatbot?.name
    ? `<p>Hey! I'm ${chatbot.name} 👋 What can I do for you?</p>`
    : `<p>Hey there 👋 What can I do for you?</p>`;
}

// ─── generateRAGResponse ──────────────────────────────────────────────────────
export async function generateRAGResponse(
  chatbot: any,
  userMessage: string,
  conversationId: string,
  preloadedChatbotLogic?: any,
  language = 'en'             // ← new param, safe default
): Promise<SearchChainResult> {
  console.group('🔍 generateRAGResponse');
  const tTotal = timer('generateRAGResponse [total]');

  const langDirective = languageDirective(language);

  // STEP 1: Parallel — history + query rewrite + chatbotLogic
  const tStep1 = timer('Step 1: history + rewriteQuery + chatbotLogic (parallel)');
  const [history, queries, chatbotLogic] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 6
    }),
    rewriteQuery(userMessage),
    preloadedChatbotLogic
      ? Promise.resolve(preloadedChatbotLogic)
      : prisma.chatbotLogic.findUnique({ where: { chatbotId: chatbot.id } })
  ]);
  tStep1.end();

  const tLogicCtx = timer('getLogicContext (reusing prefetched logic)');
  const logicContext = await getLogicContext(chatbot, userMessage, chatbotLogic);
  tLogicCtx.end();

  const formattedHistory = formatHistory(history);

  const enrichedUserMessage = enrichFollowUp(userMessage, history);

  const intent = detectIntent(userMessage);

  // ── GREETING FAST PATH ────────────────────────────────────────────────────
  if (intent === 'GREETING') {
    const tGreeting = timer('greeting fast-path (persona LLM)');
    const greetingText = await generateGreetingResponse(chatbot, language);
    tGreeting.end();

    const htmlResponse = `<div style="line-height:1.6;color:#1f2937;">${greetingText}</div>`;
    tTotal.end();
    console.groupEnd();
    return {
      response: greetingText,
      htmlResponse,
      conversationId,
      knowledgeContext: '',
      logicContext: '',
      sourcesUsed: 0,
      sourceUrls: []
    };
  }

  // STEP 2: Vector search — same multi-query retrieval as the streaming path so both
  // paths produce identical context/quality.
  const tStep2 = timer(`Step 2: vector search (${chatbot.knowledgeBases?.length ?? 0} KBs × ${queries.length} queries)`);
  const { context: knowledgeContext, sources, bestScore } = await searchKnowledgeBases(chatbot, queries);
  tStep2.end();

  console.log(`   └─ knowledgeContext length: ${knowledgeContext.length} chars, sources: ${sources.length}, best score: ${bestScore.toFixed(3)}`);

  const strongContext = bestScore >= STRONG_CONTEXT_THRESHOLD && knowledgeContext.length > 0;

  // STEP 3: LLM generation — language directive injected into both prompt branches.
  // Use RAG whenever we have ANY context (model self-limits via the prompt) — matches
  // the streaming path. strongContext is only used to decide whether to show Sources.
  const systemPrompt = generateSystemPrompt(chatbot);
  const prompt = knowledgeContext
    ? RAG_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', systemPrompt)
        .replace('{context}', knowledgeContext)
        .replace('{history}', formattedHistory)
        .replace('{question}', enrichedUserMessage)
    : GENERAL_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', systemPrompt)
        .replace('{history}', formattedHistory)
        .replace('{logicContext}', logicContext)
        .replace('{question}', enrichedUserMessage);

  const tLLM = timer(`Step 3: LLM generateText (${chatbot.model || 'gemini-2.5-flash'})`);
  const response = await withRetry(() => ai.models.generateContent({
    model: chatbot.model || 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: chatbot.max_tokens || 1200,
      temperature: chatbot.temperature ?? 0.4,
    },
  }));
  const text = response.text ?? '';
  tLLM.end();

  console.log(`   └─ LLM output length: ${text.length} chars`);

  const tHtml = timer('Step 4: cleanHtml + appendReadMore');
  let cleaned = cleanHtmlResponse(ensureHtmlFormat(text));

  const isKnowledgeIntent = intent === 'FEATURE' || intent === 'GENERAL';
  const shortMessage = userMessage.trim().length < 20;
  const shouldShowSources = strongContext && isKnowledgeIntent && !shortMessage && cleaned.length > 120;

  const htmlResponse = shouldShowSources
    ? appendReadMoreSection(cleaned, sources)
    : cleaned;
  tHtml.end();

  tTotal.end();
  console.groupEnd();

  return {
    response: text,
    htmlResponse,
    knowledgeContext,
    logicContext,
    conversationId,
    sourcesUsed: sources.length,
    sourceUrls: sources
  };
}


// ─── executeSearchChain ───────────────────────────────────────────────────────
export async function executeSearchChain(config: SearchChainConfig): Promise<SearchChainResult> {
  console.group('⛓️ executeSearchChain');
  const tTotal = timer('executeSearchChain [total]');

  const {
    chatbotId,
    conversationId,
    userMessage,
    chatbot: preloadedChatbot,
    language = 'en',  // ← destructure with default
  } = config;

  const realtimeIntent = detectRealtimeIntent(userMessage);
  // Greetings are generated fresh each time (persona + variety) — never cache them,
  // otherwise every "hi" returns the identical stored reply.
  const isGreeting = detectIntent(userMessage) === 'GREETING';
  // Short / follow-up messages ("why?", "tell me more") depend on conversation context,
  // but the cache is keyed only by question text — caching them would serve one
  // conversation's answer to a different conversation. Skip caching those.
  const trimmedMsg = userMessage.trim();
  const isContextDependent = trimmedMsg.length <= 18 || SHORT_FOLLOWUP_RE.test(trimmedMsg);
  const cacheable = !realtimeIntent.isRealtime && !isGreeting && !isContextDependent;

   // 2. Only check cache for non-realtime, non-greeting questions
  if (cacheable) {
    const cached = await getCachedResponse(chatbotId, userMessage, language);
    if (cached) {
      console.log('⚡ Cache hit — skipping LLM');
      return {
        response: cached,
        htmlResponse: cached,
        conversationId: config.conversationId || '',
        sourcesUsed: 0,
        sourceUrls: [],
      };
    }
  }
  
  let chatbot = preloadedChatbot ?? null;
  if (!chatbot) {
    const tChatbot = timer('prisma: fetch chatbot + relations (no preload)');
    chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        knowledgeBases: { select: { id: true, name: true } },
        logic: true,
        form: true
      }
    });
    tChatbot.end();
  } else {
    console.log('✅ [executeSearchChain] using pre-fetched chatbot — skipped DB call');
  }

  if (!chatbot) throw new Error('Chatbot not found');

  const tConv = timer('prisma: find or create conversation');
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { chatbotId, title: userMessage.substring(0, 50) }
      });
    }
  } else {
    conversation = await prisma.conversation.create({
      data: { chatbotId, title: userMessage.substring(0, 50) }
    });
  }
  tConv.end();

  const tParallel = timer('prisma: store user message + fetch chatbotLogic (parallel)');
  const [, chatbotLogicRecord] = await Promise.all([
    prisma.message.create({
      data: { content: userMessage, senderType: 'USER', conversationId: conversation.id }
    }),
    prisma.chatbotLogic.findUnique({ where: { chatbotId } })
  ]);
  tParallel.end();

  const tLogic = timer('checkLogicTriggers (reusing prefetched logic)');
  const triggeredLogics = await checkLogicTriggers(chatbot, userMessage, chatbotLogicRecord);
  tLogic.end();

  const { response, htmlResponse, knowledgeContext, logicContext, sourcesUsed, sourceUrls } =
    await generateRAGResponse(
      chatbot,
      userMessage,
      conversation.id,
      chatbotLogicRecord,
      language  // ← forwarded
    );

    if (cacheable) {
      await setCachedResponse(chatbotId, userMessage, htmlResponse, language);
      console.log('💾 Response cached for future identical questions');
    }

  prisma.message.create({
    data: { content: htmlResponse, senderType: 'BOT', conversationId: conversation.id }
  }).then(() => {
    console.log('✅ [search-chain] bot message stored (background)');
  }).catch(err => {
    console.error('❌ Failed to store bot message:', err);
  });

  tTotal.end();
  console.groupEnd();

  return {
    response: htmlResponse,
    htmlResponse,
    knowledgeContext,
    logicContext,
    triggeredLogics,
    conversationId: conversation.id,
    sourcesUsed,
    sourceUrls
  };
}

// ─── simpleSearch ─────────────────────────────────────────────────────────────
export async function simpleSearch(
  chatbotId: string,
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    includeKnowledgeBaseNames?: boolean;
  }
): Promise<Array<{ content: string; score: number; metadata?: any; kbName?: string }>> {
  const t = timer('simpleSearch [total]');

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: { knowledgeBases: true }
  });
  if (!chatbot) throw new Error('Chatbot not found');

  const allResults: any[] = [];
  const seenContent = new Set<string>();

  for (const kb of chatbot.knowledgeBases || []) {
    const tKb = timer(`  simpleSearch KB: "${kb.name}"`);
    try {
      const results = await searchSimilar({
        query,
        chatbotId: chatbot.id,
        knowledgeBaseId: kb.id,
        limit: options?.limit || 8,
        threshold: options?.threshold || 0.3,
      });
      tKb.end();

      for (const result of results) {
        const contentHash = result.content.substring(0, 100);
        if (!seenContent.has(contentHash)) {
          seenContent.add(contentHash);
          allResults.push(options?.includeKnowledgeBaseNames ? { ...result, kbName: kb.name } : result);
        }
      }
    } catch (error) {
      tKb.end();
      console.error(`Knowledge base ${kb.name} search error:`, error);
    }
  }

  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  t.end();
  return allResults.slice(0, options?.limit || 10);
}

// ─── streamRAGResponse ────────────────────────────────────────────────────────
export async function streamRAGResponse(
  chatbot: any,
  userMessage: string,
  conversationId: string,
  onChunk?: (chunk: string) => void,
  language = 'en',
  clientContext?: { timezone?: string; pageUrl?: string; isReturning?: boolean }
): Promise<ReadableStream<string>> {
  console.group('🌊 streamRAGResponse');
  const tTotal = timer('streamRAGResponse setup [total before stream starts]');

  const langDirective = languageDirective(language);

  const tHistory = timer('prisma: fetch recent history');
  const history = await prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'asc' },
    take: 10
  });
  tHistory.end();

  const formattedHistory = formatHistory(history);
  const intent = detectIntent(userMessage);

  // ── GREETING FAST PATH ────────────────────────────────────────────────────
  if (intent === 'GREETING') {
    const greetingText = await generateGreetingResponse(chatbot, language);

    tTotal.end();
    console.groupEnd();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(greetingText);
        controller.close();
      }
    });
  }

  // Same follow-up enrichment as the non-streaming path so short replies ("why?",
  // "tell me more") stay in context instead of going generic.
  const enrichedUserMessage = enrichFollowUp(userMessage, history);

  const tRewrite = timer('rewriteQuery');
  const queries = await rewriteQuery(userMessage);
  tRewrite.end();

  const tSearch = timer('searchKnowledgeBases');
  const { context: knowledgeContext, sources, bestScore } = await searchKnowledgeBases(chatbot, queries);
  tSearch.end();
  console.log(`   └─ knowledgeContext length: ${knowledgeContext.length} chars, sources: ${sources.length}, best score: ${bestScore.toFixed(3)}`);

  const tLogic = timer('getLogicContext');
  const logicContext = await getLogicContext(chatbot, userMessage);
  tLogic.end();

  // Language directive injected into both prompt branches
  const systemPrompt = generateSystemPrompt(chatbot, clientContext);
  const prompt = knowledgeContext
    ? RAG_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', systemPrompt)
        .replace('{context}', knowledgeContext)
        .replace('{history}', formattedHistory)
        .replace('{question}', enrichedUserMessage)
    : GENERAL_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', systemPrompt)
        .replace('{history}', formattedHistory)
        .replace('{logicContext}', logicContext)
        .replace('{question}', enrichedUserMessage);

  const tStreamInit = timer('streamText init (LLM call start)');
  const streamResult = await ai.models.generateContentStream({
    model: chatbot.model || 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: chatbot.max_tokens || 1200,
      temperature: chatbot.temperature ?? 0.4,
    },
  });
  tStreamInit.end();

  tTotal.end();
  console.log('📡 Stream open — chunks will arrive asynchronously');
  console.groupEnd();

  let fullText = '';
  let chunkCount = 0;
  const tStreamRead = timer('streamRAGResponse: reading all chunks');

  const stream = new ReadableStream<string>({
    async start(controller) {
      for await (const chunk of streamResult) {
        const piece = chunk.text ?? '';
        if (!piece) continue;
        chunkCount++;
        fullText += piece;
        controller.enqueue(piece);
        onChunk?.(piece);
      }

      tStreamRead.end();
      console.log(`   └─ chunks: ${chunkCount}, total chars: ${fullText.length}`);

      const tPersist = timer('streamRAGResponse: persist bot message to DB');
      const htmlResponse = cleanHtmlResponse(ensureHtmlFormat(fullText));
      const finalHtml = sources.length > 0
        ? appendReadMoreSection(htmlResponse, sources)
        : htmlResponse;

      await prisma.message.create({
        data: { content: finalHtml, senderType: 'BOT', conversationId }
      });
      tPersist.end();

      controller.close();
    }
  });

  return stream;
}