// lib/langchain/search-graph.ts
//
// Drop-in replacement for `executeSearchChain` and `streamRAGResponse` from
// search-chain.ts. Same control flow, same prompts, same caching — but as a
// single graph instead of two hand-maintained copies of the pipeline.
//
// PREREQUISITES (in search-chain.ts):
//   1. Add `export` to: RAG_ANSWER_PROMPT, GENERAL_ANSWER_PROMPT, detectIntent,
//      detectRealtimeIntent, RealtimeIntent (the interface), generateSystemPrompt,
//      languageDirective, cleanHtmlResponse, ensureHtmlFormat, appendReadMoreSection,
//      getCachedResponse, setCachedResponse.
//   2. In `searchKnowledgeBases`, add `bestScore: allResults[0]?.score ?? 0` to
//      the returned object (allResults is already sorted desc by score).
//
// What this fixes vs. the original:
//   - generateRAGResponse only searched with queries[0] — the rewritten query
//     variations were computed and discarded. searchKnowledge below uses all of them.
//   - generateRAGResponse and streamRAGResponse built prompts independently and
//     had already drifted (clientContext only reached one of them). Now there's
//     one generateAnswer node for both.
//   - detectRealtimeIntent classified price/weather/stock questions but never
//     called anything. callRealtimeTool below is the actual extension point —
//     wire a real API into REALTIME_TOOLS and it's used; until then it tells the
//     model plainly that it doesn't have live data, instead of guessing.

import { GoogleGenAI } from '@google/genai';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { prisma } from '@/lib/prisma';
import {
  RAG_ANSWER_PROMPT,
  GENERAL_ANSWER_PROMPT,
  detectIntent,
  detectRealtimeIntent,
  type RealtimeIntent,
  generateSystemPrompt,
  languageDirective,
  cleanHtmlResponse,
  ensureHtmlFormat,
  appendReadMoreSection,
  getCachedResponse,
  setCachedResponse,
  withRetry,
  formatHistory,
  getLogicContext,
  checkLogicTriggers,
  rewriteQuery,
  searchKnowledgeBases,
  type SearchChainConfig,
  type SearchChainResult,
} from './search-chain';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ─── State ─────────────────────────────────────────────────────────────────

const SearchState = Annotation.Root({
  // input
  chatbotId: Annotation<string>,
  conversationId: Annotation<string | undefined>,
  userMessage: Annotation<string>,
  language: Annotation<string>({ reducer: (_, y) => y, default: () => 'en' }),
  clientContext: Annotation<SearchChainConfig['clientContext']>(),

  // resolved along the way
  chatbot: Annotation<any>(),
  conversation: Annotation<any>(),
  chatbotLogic: Annotation<any>(),
  history: Annotation<any[]>({ reducer: (_, y) => y, default: () => [] }),
  formattedHistory: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),

  realtimeIntent: Annotation<RealtimeIntent>({
    reducer: (_, y) => y,
    default: () => ({ isRealtime: false, type: null }),
  }),
  intent: Annotation<'GREETING' | 'FEATURE' | 'GENERAL'>({
    reducer: (_, y) => y,
    default: () => 'GENERAL',
  }),
  queries: Annotation<string[]>({ reducer: (_, y) => y, default: () => [] }),

  knowledgeContext: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  sources: Annotation<Array<{ title: string; url: string; score?: number }>>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  logicContext: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  triggeredLogics: Annotation<any[]>({ reducer: (_, y) => y, default: () => [] }),
  strongContext: Annotation<boolean>({ reducer: (_, y) => y, default: () => false }),

  rawText: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  htmlResponse: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  cacheHit: Annotation<boolean>({ reducer: (_, y) => y, default: () => false }),
});

type State = typeof SearchState.State;

// ─── small local helper (was inlined in generateRAGResponse) ───────────────

const SHORT_FOLLOWUP_PATTERN = /^(why|how|pricing|cost|tell me more|more|what about that|and that|so)\b/i;

function enrichFollowUp(userMessage: string, history: any[]): string {
  if (history.length === 0) return userMessage;
  const trimmed = userMessage.trim();
  if (trimmed.length > 18 && !SHORT_FOLLOWUP_PATTERN.test(trimmed)) return userMessage;

  const lastAssistant = [...history].reverse().find((m) => m.senderType === 'BOT');
  if (!lastAssistant) return userMessage;

  return `\nUser follow-up question:\n"${userMessage}"\n\nThis refers to the previous assistant response:\n${lastAssistant.content}\n`;
}

// ─── real-time tool extension point ─────────────────────────────────────────
// Plug actual integrations in here. Each one returns a string of fresh,
// factual context that gets treated exactly like retrieved KB chunks.
//   PRICE:    async (state) => fetchLivePricing(state.chatbotId)
//   STOCK:    async (state) => fetchQuote(extractTicker(state.userMessage))
//   WEATHER:  async (state) => fetchWeather(state.clientContext?.timezone)
type RealtimeToolFn = (state: State) => Promise<string>;
const REALTIME_TOOLS: Partial<Record<NonNullable<RealtimeIntent['type']>, RealtimeToolFn>> = {
  // none wired up yet — see comment above
};

// ─── nodes ───────────────────────────────────────────────────────────────────

async function checkCache(state: State): Promise<Partial<State>> {
  const realtimeIntent = detectRealtimeIntent(state.userMessage);
  if (realtimeIntent.isRealtime) return { realtimeIntent };

  const cached = await getCachedResponse(state.chatbotId, state.userMessage, state.language);
  if (cached) return { realtimeIntent, cacheHit: true, htmlResponse: cached };

  return { realtimeIntent };
}

function routeAfterCache(state: State): 'loadChatbot' | typeof END {
  return state.cacheHit ? END : 'loadChatbot';
}

async function loadChatbot(state: State): Promise<Partial<State>> {
  let chatbot = state.chatbot;
  if (!chatbot) {
    chatbot = await prisma.chatbot.findUnique({
      where: { id: state.chatbotId },
      include: {
        knowledgeBases: { select: { id: true, name: true } },
        logic: true,
        form: true,
      },
    });
  }
  if (!chatbot) throw new Error('Chatbot not found');

  let conversation = state.conversationId
    ? await prisma.conversation.findUnique({ where: { id: state.conversationId } })
    : null;
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { chatbotId: state.chatbotId, title: state.userMessage.substring(0, 50) },
    });
  }

  const [, chatbotLogic] = await Promise.all([
    prisma.message.create({
      data: { content: state.userMessage, senderType: 'USER', conversationId: conversation.id },
    }),
    prisma.chatbotLogic.findUnique({ where: { chatbotId: state.chatbotId } }),
  ]);

  return { chatbot, conversation, chatbotLogic };
}

async function prepareContext(state: State): Promise<Partial<State>> {
  const [history, queries, logicContext, triggeredLogics] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: state.conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 6,
    }),
    rewriteQuery(state.userMessage),
    getLogicContext(state.chatbot, state.userMessage, state.chatbotLogic),
    checkLogicTriggers(state.chatbot, state.userMessage, state.chatbotLogic),
  ]);

  return {
    history,
    formattedHistory: formatHistory(history),
    queries,
    logicContext,
    triggeredLogics,
    intent: detectIntent(state.userMessage),
  };
}

function routeByIntent(state: State): 'generateGreeting' | 'callRealtimeTool' | 'searchKnowledge' {
  if (state.intent === 'GREETING') return 'generateGreeting';
  if (state.realtimeIntent.isRealtime) return 'callRealtimeTool';
  return 'searchKnowledge';
}

async function generateGreeting(state: State): Promise<Partial<State>> {
  let text: string;

  if (state.language === 'en') {
    text = `<p>Hi there 👋 How can I help you today?</p>`;
  } else {
    const langDirective = languageDirective(state.language);
    try {
      const response = await ai.models.generateContent({
        model: state.chatbot.model || 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `${langDirective}Reply to a friendly greeting in one short sentence wrapped in a <p> tag. Output only the HTML.` }],
        }],
        config: { maxOutputTokens: 60, temperature: 0.5 },
      });
      text = response.text?.trim() || `<p>👋</p>`;
    } catch {
      text = `<p>👋</p>`;
    }
  }

  return { htmlResponse: `<div style="line-height:1.6;color:#1f2937;">${text}</div>` };
}

async function callRealtimeTool(state: State): Promise<Partial<State>> {
  const tool = state.realtimeIntent.type ? REALTIME_TOOLS[state.realtimeIntent.type] : undefined;

  if (!tool) {
    // No integration wired up for this type yet. Tell the model plainly
    // rather than letting it guess at a price/weather/availability answer.
    return {
      logicContext: `${state.logicContext}\nNote: live data isn't available for this request — say so plainly rather than guessing.`,
    };
  }

  const liveContext = await tool(state);
  return { knowledgeContext: liveContext, strongContext: true };
}

async function searchKnowledge(state: State): Promise<Partial<State>> {
  const { context, sources, bestScore } = await searchKnowledgeBases(state.chatbot, state.queries);
  const strongContext = bestScore >= 0.35 && context.length > 0;
  return { knowledgeContext: context, sources, strongContext };
}

async function generateAnswer(
  state: State,
  config: LangGraphRunnableConfig
): Promise<Partial<State>> {
  const langDirective = languageDirective(state.language);
  const systemPrompt = generateSystemPrompt(state.chatbot, state.clientContext);
  const enrichedUserMessage = enrichFollowUp(state.userMessage, state.history);

  const prompt = state.strongContext
    ? RAG_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', systemPrompt)
        .replace('{context}', state.knowledgeContext)
        .replace('{history}', state.formattedHistory)
        .replace('{question}', enrichedUserMessage)
    : GENERAL_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', systemPrompt)
        .replace('{history}', state.formattedHistory)
        .replace('{logicContext}', state.logicContext)
        .replace('{question}', enrichedUserMessage);

  const writer = config?.writer;

  // Streaming path — only active when invoked via `.stream(..., { streamMode: "custom" })`
  if (writer) {
    const streamResult = await ai.models.generateContentStream({
      model: state.chatbot.model || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: state.chatbot.max_tokens || 1200,
        temperature: state.chatbot.temperature ?? 0.4,
      },
    });

    let fullText = '';
    for await (const chunk of streamResult) {
      const piece = chunk.text ?? '';
      if (!piece) continue;
      fullText += piece;
      writer(piece);
    }
    return { rawText: fullText };
  }

  // Non-streaming path
  const response = await withRetry(() =>
    ai.models.generateContent({
      model: state.chatbot.model || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: state.chatbot.max_tokens || 1200,
        temperature: state.chatbot.temperature ?? 0.4,
      },
    })
  );

  return { rawText: response.text ?? '' };
}

async function postProcess(state: State): Promise<Partial<State>> {
  const cleaned = cleanHtmlResponse(ensureHtmlFormat(state.rawText));

  const isKnowledgeIntent = state.intent === 'FEATURE' || state.intent === 'GENERAL';
  const shortMessage = state.userMessage.trim().length < 20;
  const shouldShowSources = state.strongContext && isKnowledgeIntent && !shortMessage && cleaned.length > 120;

  return { htmlResponse: shouldShowSources ? appendReadMoreSection(cleaned, state.sources) : cleaned };
}

async function persist(state: State): Promise<Partial<State>> {
  if (!state.realtimeIntent.isRealtime) {
    await setCachedResponse(state.chatbotId, state.userMessage, state.htmlResponse, state.language);
  }

  // Fire-and-forget, matching the original's background write.
  prisma.message
    .create({
      data: {
        content: state.htmlResponse,
        senderType: 'BOT',
        conversationId: state.conversation.id,
      },
    })
    .catch((err: unknown) => console.error('Failed to store bot message:', err));

  return {};
}

// ─── graph wiring ────────────────────────────────────────────────────────────

const graph = new StateGraph(SearchState)
  .addNode('checkCache', checkCache)
  .addNode('loadChatbot', loadChatbot)
  .addNode('prepareContext', prepareContext)
  .addNode('generateGreeting', generateGreeting)
  .addNode('callRealtimeTool', callRealtimeTool)
  .addNode('searchKnowledge', searchKnowledge)
  .addNode('generateAnswer', generateAnswer)
  .addNode('postProcess', postProcess)
  .addNode('persist', persist)
  .addEdge(START, 'checkCache')
  .addConditionalEdges('checkCache', routeAfterCache, { loadChatbot: 'loadChatbot', [END]: END })
  .addEdge('loadChatbot', 'prepareContext')
  .addConditionalEdges('prepareContext', routeByIntent, {
    generateGreeting: 'generateGreeting',
    callRealtimeTool: 'callRealtimeTool',
    searchKnowledge: 'searchKnowledge',
  })
  .addEdge('generateGreeting', 'persist')
  .addEdge('callRealtimeTool', 'generateAnswer')
  .addEdge('searchKnowledge', 'generateAnswer')
  .addEdge('generateAnswer', 'postProcess')
  .addEdge('postProcess', 'persist')
  .addEdge('persist', END);

const compiledGraph = graph.compile();

// ─── public API — same shapes as the functions you're replacing ────────────

export async function executeSearchGraph(cfg: SearchChainConfig): Promise<SearchChainResult> {
  const result = await compiledGraph.invoke({
    chatbotId: cfg.chatbotId,
    conversationId: cfg.conversationId,
    userMessage: cfg.userMessage,
    language: cfg.language ?? 'en',
    clientContext: cfg.clientContext,
    chatbot: cfg.chatbot,
  });

  return {
    response: result.htmlResponse,
    htmlResponse: result.htmlResponse,
    knowledgeContext: result.knowledgeContext,
    logicContext: result.logicContext,
    triggeredLogics: result.triggeredLogics,
    conversationId: result.conversation?.id ?? cfg.conversationId ?? '',
    sourcesUsed: result.sources?.length ?? 0,
    sourceUrls: result.sources,
  };
}

// Async generator of HTML chunks — wrap in a ReadableStream in your route
// handler the same way you already do for streamRAGResponse.
export async function* streamSearchGraph(cfg: SearchChainConfig): AsyncGenerator<string> {
  const stream = await compiledGraph.stream(
    {
      chatbotId: cfg.chatbotId,
      conversationId: cfg.conversationId,
      userMessage: cfg.userMessage,
      language: cfg.language ?? 'en',
      clientContext: cfg.clientContext,
      chatbot: cfg.chatbot,
    },
    { streamMode: 'custom' }
  );

  for await (const chunk of stream) {
    yield chunk as string;
  }
}