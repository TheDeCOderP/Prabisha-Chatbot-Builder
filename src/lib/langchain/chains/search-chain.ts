// lib/langchain/search-chain.ts
import { searchSimilar } from '@/lib/langchain/vector-store';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { prisma } from '@/lib/prisma';

export interface SearchChainConfig {
  chatbotId: string;
  conversationId?: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
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

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? '',
});

// Enhanced query rewriting with multi-angle approach
const QUERY_REWRITE_PROMPT = `Generate 2-3 search variations for this question to capture different angles.
Keep each variation focused and 5-15 words.

User question: {question}

Output format (one per line):
1. [variation]
2. [variation]
3. [variation]`;

// Improved RAG prompt with STRICT HTML formatting instructions
const RAG_ANSWER_PROMPT = `You are a knowledgeable assistant. Use the CONTEXT below to answer the user's question.

IMPORTANT RULES:
1. Synthesize information from ALL relevant context chunks
2. If context has PARTIAL information, provide what you know and acknowledge gaps
3. Be specific - mention features, services, pricing, timelines when available
4. Connect related information across different context sources
5. Only say "I don't have information" if context is completely irrelevant
6. Use a helpful, conversational tone

CRITICAL FORMATTING RULES - FOLLOW EXACTLY:
- Wrap each paragraph in <p> tags with NO extra newlines
- Use <ul><li> for bullet lists (NO newlines between items)
- Use <strong> only for truly important keywords
- DO NOT add extra <br> tags or newlines
- DO NOT add blank lines between elements
- Keep HTML compact and clean
- DO NOT mention sources or URLs

FOLLOW-UP RULE:
- After your complete answer, ask EXACTLY ONE short follow-up question
- The question must be relevant to what the user just asked
- Wrap it in: <p class="follow-up-question">...</p>
- It must be the LAST element in your response
- Do NOT ask more than one question

CONTEXT (from knowledge base):
{context}

CONVERSATION HISTORY:
{history}

USER QUESTION: {question}

Provide a complete answer first, then ONE follow-up question at the end. Output ONLY clean, compact HTML:`;

// Fallback prompt when no knowledge base context found
const GENERAL_ANSWER_PROMPT = `{systemPrompt}

You're having a conversation with a user. They may ask about services, features, or general questions.

CRITICAL FORMATTING RULES - FOLLOW EXACTLY:
- Wrap each paragraph in <p> tags with NO extra newlines
- Use <ul><li> for bullet lists (NO newlines between items)
- Use <strong> only for truly important keywords
- DO NOT add extra <br> tags or newlines
- DO NOT add blank lines between elements
- Keep HTML compact and clean

CONVERSATION HISTORY:
{history}

{logicContext}

USER: {question}

ASSISTANT - Output ONLY clean, compact HTML with no extra spacing:`;

export async function rewriteQuery(userMessage: string): Promise<string[]> {
  try {
    const { text } = await generateText({
      model: googleAI('gemini-2.5-flash'), // Latest stable Gemini 2.5 model
      prompt: QUERY_REWRITE_PROMPT.replace('{question}', userMessage),
      maxOutputTokens: 150,
      temperature: 0.4,
    });
    
    const variations = text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(v => v.length > 0);
    
    // Always include original query
    const queries = [userMessage, ...variations].slice(0, 3);
    console.log('🔄 Query variations:', queries);
    return queries;
  } catch (error) {
    console.error('Query rewrite error:', error);
    return [userMessage];
  }
}

// Enhanced search with multiple queries and source URL collection
export async function searchKnowledgeBases(
  chatbot: any, 
  queries: string[]
): Promise<{ 
  context: string; 
  sources: Array<{ title: string; url: string; score: number }> 
}> {
  if (!chatbot.knowledgeBases?.length) return { context: '', sources: [] };

  const allResults: any[] = [];
  const seenContent = new Set<string>();
  const sourceUrls = new Map<string, { title: string; url: string; score: number }>();
  
  // Search with each query variation
  for (const query of queries) {
    for (const kb of chatbot.knowledgeBases) {
      try {
        const results = await searchSimilar({
          query,
          chatbotId: chatbot.id,
          knowledgeBaseId: kb.id,
          limit: 12,
          threshold: 0.3,
        });
        
        console.log(`📊 ${kb.name} (query: "${query}"): ${results.length} results`);
        
        // Log scores for debugging
        if (results.length > 0) {
          const topScores = results.slice(0, 3).map(r => r.score.toFixed(3)).join(', ');
          console.log(`   Top scores: ${topScores}`);
        }
        
        // Deduplicate by content hash and collect URLs
        for (const result of results) {
          const contentHash = result.content.substring(0, 100);
          if (!seenContent.has(contentHash)) {
            seenContent.add(contentHash);
            allResults.push({ 
              ...result, 
              kbName: kb.name,
              query: query
            });
            
            // Extract URL and title from metadata
            let sourceUrl = result.metadata?.source || result.metadata?.url;
            let sourceTitle = result.metadata?.title || result.metadata?.filename || kb.name;
            
            console.log(`   📄 Result metadata:`, {
              hasSource: !!result.metadata?.source,
              hasUrl: !!result.metadata?.url,
              title: result.metadata?.title,
              source: result.metadata?.source?.substring(0, 50)
            });
            
            // Collect source URLs (must be valid HTTP/HTTPS URLs)
            if (sourceUrl && (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://'))) {
              const existingSource = sourceUrls.get(sourceUrl);
              if (!existingSource || result.score > existingSource.score) {
                sourceUrls.set(sourceUrl, {
                  title: sourceTitle || 'Untitled Source',
                  url: sourceUrl,
                  score: result.score
                });
                console.log(`   ✅ Collected source: ${sourceTitle} (${sourceUrl.substring(0, 50)}...)`);
              }
            } else {
              console.log(`   ⚠️ Skipped invalid source URL:`, sourceUrl);
            }
          }
        }
      } catch (error) {
        console.error(`❌ ${kb.name}:`, error);
      }
    }
  }

  if (!allResults.length) {
    console.log('❌ No results found');
    return { context: '', sources: [] };
  }

  // Sort by score
  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Take top results with diversity
  const top = selectDiverseResults(allResults, 15);
  
  console.log(`✅ Selected ${top.length} diverse results for context`);
  console.log(`   Score range: ${top[0]?.score.toFixed(3)} - ${top[top.length-1]?.score.toFixed(3)}`);

  // Format with more structure
  const formatted = top.map((r, i) => {
    const scorePercent = (r.score * 100).toFixed(1);
    const source = r.metadata?.title || r.kbName || 'Knowledge Base';
    return `[Chunk ${i + 1} | Relevance: ${scorePercent}% | Source: ${source}]\n${r.content}`;
  }).join('\n\n---\n\n');

  const context = `KNOWLEDGE BASE CONTEXT:\n\n${formatted}\n\n(Total sources: ${top.length})`;
  
  // Get top 5 unique source URLs sorted by score
  const sources = Array.from(sourceUrls.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  console.log(`🔗 Found ${sources.length} unique source URLs`);
  sources.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.title} (${s.score.toFixed(3)})`);
  });

  return { context, sources };
}

// Select diverse results to avoid redundancy
function selectDiverseResults(results: any[], limit: number): any[] {
  const selected: any[] = [];
  const keywords = new Set<string>();
  
  for (const result of results) {
    if (selected.length >= limit) break;
    
    // Extract key terms from content
    const terms = result.content
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 4);
    
    // Calculate novelty (how many new terms this adds)
    const newTerms = terms.filter((t: string) => !keywords.has(t));
    const novelty = newTerms.length / Math.max(terms.length, 1);
    
    // Include if high score OR adds novelty
    if (result.score > 0.5 || novelty > 0.3 || selected.length < 5) {
      selected.push(result);
      newTerms.forEach((t: string) => keywords.add(t));
    }
  }
  
  return selected;
}

export function formatHistory(messages: any[]): string {
  if (!messages.length) return "This is the start of the conversation.";
  
  const recent = messages.slice(-6);
  return recent.map(m => 
    `${m.senderType === 'USER' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n');
}

export async function getLogicContext(chatbot: any, message: string): Promise<string> {
  let ctx = '';
  
  // Get chatbot logic configuration
  const chatbotLogic = await prisma.chatbotLogic.findUnique({
    where: { chatbotId: chatbot.id }
  });
  
  if (!chatbotLogic || !chatbotLogic.triggers) {
    return ctx;
  }
  
  try {
    // Triggers is already an object from Prisma, not a string
    const triggers = typeof chatbotLogic.triggers === 'string' 
      ? JSON.parse(chatbotLogic.triggers) 
      : chatbotLogic.triggers;
    if (!Array.isArray(triggers)) return ctx;
    
    // Check each trigger for keyword matches
    for (const trigger of triggers) {
      const keywords = trigger.keywords || [];
      const feature = trigger.feature || trigger.type;
      
      // Check if message contains any keyword
      const hasKeyword = keywords.some((k: string) => 
        message.toLowerCase().includes(k.toLowerCase())
      );
      
      if (hasKeyword) {
        switch (feature) {
          case 'linkButton':
          case 'LINK_BUTTON':
            // Parse link button config
            let buttonText = 'this link';
            if (chatbotLogic.linkButtonConfig) {
              try {
                const linkConfig = JSON.parse(chatbotLogic.linkButtonConfig as string);
                buttonText = linkConfig.buttonText || 'this link';
              } catch (e) {
                console.error('Error parsing link button config:', e);
              }
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
  
  return ctx;
}

function generateSystemPrompt(chatbot: any): string {
  const base = chatbot.directive || "You are a helpful, knowledgeable assistant.";
  const personality = chatbot.description ? `\n\nYour personality: ${chatbot.description}` : "";
  const guidelines = `\n\nGuidelines:
- Be conversational and helpful
- Provide specific details when available
- If you're unsure, say so clearly
- Stay professional but friendly
- Format responses in HTML for better readability`;
  
  return `${base}${personality}${guidelines}`;
}

export async function checkLogicTriggers(chatbot: any, message: string) {
  const triggered: any[] = [];
  
  // Get chatbot logic configuration
  const chatbotLogic = await prisma.chatbotLogic.findUnique({
    where: { chatbotId: chatbot.id }
  });
  
  if (!chatbotLogic || !chatbotLogic.triggers || !chatbotLogic.isActive) {
    return triggered;
  }
  
  try {
    // Triggers is already an object from Prisma, not a string
    const triggers = typeof chatbotLogic.triggers === 'string' 
      ? JSON.parse(chatbotLogic.triggers) 
      : chatbotLogic.triggers;
    if (!Array.isArray(triggers)) return triggered;
    
    // Check each trigger
    for (const trigger of triggers) {
      const keywords = trigger.keywords || [];
      const hasKeyword = keywords.some((k: string) => 
        message.toLowerCase().includes(k.toLowerCase())
      );
      
      if (hasKeyword) {
        // Construct a logic object similar to the old structure
        const logic = {
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
          // Include feature-specific configurations if available
          config: {}
        };
        
        // Add feature-specific config
        switch (trigger.feature || trigger.type) {
          case 'linkButton':
          case 'LINK_BUTTON':
            if (chatbotLogic.linkButtonConfig) {
              try {
                logic.config = {
                  linkButton: JSON.parse(chatbotLogic.linkButtonConfig as string)
                };
              } catch (e) {
                console.error('Error parsing link button config:', e);
              }
            }
            break;
            
          case 'meetingSchedule':
          case 'SCHEDULE_MEETING':
            if (chatbotLogic.meetingScheduleConfig) {
              try {
                logic.config = {
                  meetingSchedule: JSON.parse(chatbotLogic.meetingScheduleConfig as string)
                };
              } catch (e) {
                console.error('Error parsing meeting schedule config:', e);
              }
            }
            break;
            
          case 'leadCollection':
          case 'COLLECT_LEADS':
            if (chatbotLogic.leadCollectionConfig) {
              try {
                logic.config = {
                  leadCollection: JSON.parse(chatbotLogic.leadCollectionConfig as string)
                };
              } catch (e) {
                console.error('Error parsing lead collection config:', e);
              }
            }
            break;
        }
        
        triggered.push(logic);
      }
    }
  } catch (e) {
    console.error('Error checking logic triggers:', e);
  }
  
  return triggered;
}

// Clean and normalize HTML output
function cleanHtmlResponse(html: string): string {
  let cleaned = html;
  
  // Remove excessive newlines and whitespace between tags
  cleaned = cleaned.replace(/>\s+</g, '><');
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Ensure proper spacing after closing tags
  cleaned = cleaned.replace(/<\/p>/g, '</p>');
  cleaned = cleaned.replace(/<\/li>/g, '</li>');
  cleaned = cleaned.replace(/<\/ul>/g, '</ul>');
  cleaned = cleaned.replace(/<\/ol>/g, '</ol>');
  
  // Remove multiple consecutive <br> tags
  cleaned = cleaned.replace(/(<br\s*\/?>){2,}/gi, '<br>');
  
  // Remove <br> at the start or end
  cleaned = cleaned.replace(/^<br\s*\/?>/i, '');
  cleaned = cleaned.replace(/<br\s*\/?>$/i, '');
  
  // Add consistent spacing between paragraphs
  cleaned = cleaned.replace(/<\/p><p>/g, '</p><p style="margin-top: 12px;">');
  
  // Add consistent spacing for lists
  cleaned = cleaned.replace(/<ul>/g, '<ul style="margin: 12px 0; padding-left: 24px;">');
  cleaned = cleaned.replace(/<ol>/g, '<ol style="margin: 12px 0; padding-left: 24px;">');
  cleaned = cleaned.replace(/<li>/g, '<li style="margin-bottom: 6px;">');
  
  // Ensure first paragraph has no top margin
  cleaned = cleaned.replace(/^<p style="margin-top: 12px;">/, '<p>');
  
  // Wrap in container if not already wrapped
  if (!cleaned.startsWith('<div') && !cleaned.startsWith('<p')) {
    cleaned = `<div style="line-height: 1.6; color: #1f2937;">${cleaned}</div>`;
  } else if (cleaned.startsWith('<p')) {
    cleaned = `<div style="line-height: 1.6; color: #1f2937;">${cleaned}</div>`;
  }
  
  return cleaned;
}

// Convert plain text to HTML if needed
function ensureHtmlFormat(text: string): string {
  // If already has HTML tags, just clean it
  if (/<[^>]+>/.test(text)) {
    return text;
  }
  
  // Convert plain text to basic HTML
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  return paragraphs.map(p => {
    // Check if it's a list
    if (p.includes('\n- ') || p.includes('\n• ')) {
      const lines = p.split('\n').filter(line => line.trim());
      const listItems = lines
        .filter(item => item.trim().startsWith('- ') || item.trim().startsWith('• '))
        .map(item => {
          const content = item.replace(/^[-•]\s*/, '').trim();
          return `<li style="margin-bottom: 6px;">${content}</li>`;
        })
        .join('');
      return `<ul style="margin: 12px 0; padding-left: 24px;">${listItems}</ul>`;
    }
    
    // Regular paragraph
    return `<p style="margin-top: 12px;">${p.trim()}</p>`;
  }).join('');
}

// Enhanced "Read More" section with better styling
function appendReadMoreSection(
  htmlResponse: string, 
  sources: Array<{ title: string; url: string }>
): string {
  if (!sources.length) return htmlResponse;
  
  const readMoreSection = `
<div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <div style="font-weight: 600; color: #374151; margin-bottom: 10px; font-size: 14px; display: flex; align-items: center; gap: 6px;">
    <span>📚</span>
    <span>Learn More</span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    ${sources.map(source => `
    <a href="${source.url}" 
       target="_blank" 
       rel="noopener noreferrer"
       style="color: #2563eb; text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 6px; padding: 4px 0; transition: opacity 0.2s;">
      <span style="opacity: 0.6;">🔗</span>
      <span style="border-bottom: 1px solid transparent; transition: border-color 0.2s; flex: 1;">${source.title}</span>
      <span style="font-size: 11px; opacity: 0.5;">↗</span>
    </a>`).join('')}
  </div>
</div>`;

  return htmlResponse + readMoreSection;
}

export async function generateRAGResponse(
  chatbot: any, 
  userMessage: string, 
  conversationId: string
): Promise<{ 
  response: string;
  htmlResponse: string;
  knowledgeContext?: string; 
  logicContext?: string;
  sourcesUsed?: number;
  sourceUrls?: Array<{ title: string; url: string }>;
}> {
  try {
    // Get conversation history
    const history = await prisma.message.findMany({
      where: { 
        conversationId, 
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    });

    const formattedHistory = formatHistory(history);
    
    // Generate multiple query variations
    const queries = await rewriteQuery(userMessage);
    
    // Search with all variations and get sources
    const { context: knowledgeContext, sources } = await searchKnowledgeBases(chatbot, queries);
    const logicContext = await getLogicContext(chatbot, userMessage);

    let prompt: string;
    let mode: string;
    
    if (knowledgeContext) {
      // RAG mode with knowledge base
      prompt = RAG_ANSWER_PROMPT
        .replace('{context}', knowledgeContext)
        .replace('{history}', formattedHistory)
        .replace('{question}', userMessage);
      mode = 'RAG with knowledge base';
    } else {
      // Fallback to general conversation
      prompt = GENERAL_ANSWER_PROMPT
        .replace('{systemPrompt}', generateSystemPrompt(chatbot))
        .replace('{history}', formattedHistory)
        .replace('{logicContext}', logicContext)
        .replace('{question}', userMessage);
      mode = 'General conversation (no relevant knowledge found)';
    }

    console.log(`✅ Mode: ${mode}`);

    // Use latest Gemini 2.5 Flash model (stable)
    const { text } = await generateText({
      model: googleAI('gemini-2.5-flash'), // Latest stable Gemini 2.5 model
      prompt,
      maxOutputTokens: chatbot.max_tokens || 600,
      temperature: chatbot.temperature || 0.7,
    });

    const response = text.trim();
    
    // Ensure HTML formatting and clean it
    let htmlResponse = ensureHtmlFormat(response);
    htmlResponse = cleanHtmlResponse(htmlResponse);
    
    // Add "Read More" section with source URLs
    if (sources.length > 0) {
      htmlResponse = appendReadMoreSection(htmlResponse, sources);
      console.log(`✅ Added ${sources.length} source links to response`);
    }
    
    console.log('🤖 Response length:', response.length, 'chars');
    console.log('🔗 Source URLs:', sources.length);

    // Count sources used
    const sourcesUsed = knowledgeContext 
      ? (knowledgeContext.match(/\[Chunk \d+/g) || []).length 
      : 0;

    return {
      response,
      htmlResponse,
      knowledgeContext: knowledgeContext || undefined,
      logicContext: logicContext || undefined,
      sourcesUsed,
      sourceUrls: sources.length > 0 ? sources : undefined
    };

  } catch (error) {
    console.error('RAG error:', error);
    throw error;
  }
}

export async function executeSearchChain(config: SearchChainConfig): Promise<SearchChainResult> {
  const {
    chatbotId,
    conversationId,
    userMessage,
  } = config;

  // Fetch chatbot with relations
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: {
      knowledgeBases: { include: { documents: true }},
      logic: true, // Changed from logics (array) to logic (single)
      form: true
    }
  });

  if (!chatbot) {
    throw new Error('Chatbot not found');
  }

  // Handle conversation (create or retrieve)
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({ where: { id: conversationId }});
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

  // Store user message
  await prisma.message.create({
    data: { content: userMessage, senderType: 'USER', conversationId: conversation.id }
  });

  // Check for logic triggers
  const triggeredLogics = await checkLogicTriggers(chatbot, userMessage);

  // Generate AI response with RAG
  const { 
    response, 
    htmlResponse, 
    knowledgeContext, 
    logicContext, 
    sourcesUsed,
    sourceUrls 
  } = await generateRAGResponse(
    chatbot,
    userMessage,
    conversation.id
  );

  // Store bot response (store HTML version)
  await prisma.message.create({
    data: { 
      content: htmlResponse, 
      senderType: 'BOT', 
      conversationId: conversation.id 
    }
  });

  return {
    response: htmlResponse, // Return HTML response
    htmlResponse,
    knowledgeContext,
    logicContext,
    triggeredLogics,
    conversationId: conversation.id,
    sourcesUsed,
    sourceUrls
  };
}

// Enhanced simple search with query variations
export async function simpleSearch(
  chatbotId: string,
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    includeKnowledgeBaseNames?: boolean;
  }
): Promise<Array<{
  content: string;
  score: number;
  metadata?: any;
  kbName?: string;
}>> {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: { knowledgeBases: true }
  });

  if (!chatbot) {
    throw new Error('Chatbot not found');
  }

  const allResults: any[] = [];
  const seenContent = new Set<string>();
  
  for (const kb of chatbot.knowledgeBases || []) {
    try {
      const results = await searchSimilar({
        query,
        chatbotId: chatbot.id,
        knowledgeBaseId: kb.id,
        limit: options?.limit || 8,
        threshold: options?.threshold || 0.3,
      });
      
      for (const result of results) {
        const contentHash = result.content.substring(0, 100);
        if (!seenContent.has(contentHash)) {
          seenContent.add(contentHash);
          if (options?.includeKnowledgeBaseNames) {
            allResults.push({ ...result, kbName: kb.name });
          } else {
            allResults.push(result);
          }
        }
      }
    } catch (error) {
      console.error(`Knowledge base ${kb.name} search error:`, error);
    }
  }

  // Sort by score
  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));

  return allResults.slice(0, options?.limit || 10);
}

export async function streamRAGResponse(
  chatbot: any,
  userMessage: string,
  conversationId: string,
  onChunk?: (chunk: string) => void
): Promise<ReadableStream<string>> {
  // Get conversation history
  const history = await prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'asc' },
    take: 10
  });

  const formattedHistory = formatHistory(history);
  const queries = await rewriteQuery(userMessage);
  const { context: knowledgeContext, sources } = await searchKnowledgeBases(chatbot, queries);
  const logicContext = await getLogicContext(chatbot, userMessage);

  const prompt = knowledgeContext
    ? RAG_ANSWER_PROMPT
        .replace('{context}', knowledgeContext)
        .replace('{history}', formattedHistory)
        .replace('{question}', userMessage)
    : GENERAL_ANSWER_PROMPT
        .replace('{systemPrompt}', generateSystemPrompt(chatbot))
        .replace('{history}', formattedHistory)
        .replace('{logicContext}', logicContext)
        .replace('{question}', userMessage);

  const result = await streamText({
    model: googleAI('gemini-3-flash-preview'),
    prompt,
    maxOutputTokens: chatbot.max_tokens || 600,
    temperature: chatbot.temperature || 0.7,
  });

  // Collect full response for DB storage
  let fullText = '';

  const stream = new ReadableStream<string>({
    async start(controller) {
      for await (const chunk of result.textStream) {
        fullText += chunk;
        controller.enqueue(chunk);
        onChunk?.(chunk);
      }

      // Persist the full message after streaming completes
      const htmlResponse = cleanHtmlResponse(ensureHtmlFormat(fullText));
      const finalHtml = sources.length > 0
        ? appendReadMoreSection(htmlResponse, sources)
        : htmlResponse;

      await prisma.message.create({
        data: {
          content: finalHtml,
          senderType: 'BOT',
          conversationId
        }
      });

      controller.close();
    }
  });

  return stream;
}