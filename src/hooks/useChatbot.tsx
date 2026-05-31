"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useConversationalLead, ConversationalLeadConfig } from './useConversationalLead';
import { Message } from '@/types/chat';

// ─── Retry configuration ─────────────────────────────────────────────────────

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,    // 1 second
  maxDelayMs: 16000,    // 16 seconds
  backoffFactor: 2,     // exponential: 1s, 2s, 4s, 8s, 16s
  retryableStatuses: [429, 503],
};

// Helper: sleep with exponential backoff
async function sleepWithBackoff(attempt: number, config: RetryConfig): Promise<void> {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffFactor, attempt),
    config.maxDelayMs
  );
  // Add jitter (±20%) to avoid thundering herd
  const jitter = delay * (0.8 + Math.random() * 0.4);
  await new Promise(resolve => setTimeout(resolve, jitter));
}

// Helper: check if error is retryable
function isRetryableError(status: number, config: RetryConfig): boolean {
  return config.retryableStatuses.includes(status);
}

// Helper: fetch with retry logic
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If response is OK or not retryable, return it
      if (response.ok || !isRetryableError(response.status, retryConfig)) {
        return response;
      }
      
      // Retryable error (429 or 503)
      if (attempt < retryConfig.maxRetries) {
        console.warn(`🔄 Retryable error ${response.status}, attempt ${attempt + 1}/${retryConfig.maxRetries + 1}. Retrying...`);
        await sleepWithBackoff(attempt, retryConfig);
        continue;
      }
      
      // Max retries reached, return the error response
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Network errors are also retryable
      if (attempt < retryConfig.maxRetries) {
        console.warn(`🔄 Network error, attempt ${attempt + 1}/${retryConfig.maxRetries + 1}. Retrying...`, lastError.message);
        await sleepWithBackoff(attempt, retryConfig);
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

export type MultilingualSuggestion = Partial<Record<string, string>>

interface ChatbotData {
  id: string;
  name: string;
  description?: string;
  avatar?: string | null;
  icon?: string | null;
  greeting?: MultilingualSuggestion | string | MultilingualSuggestion[] | null;
  suggestions?: MultilingualSuggestion[] | string[];
  popup_onload?: boolean;
  theme?: {
    widgetSize?: number;
    widgetSizeMobile?: number;
    widgetColor?: string;
    widgetBgColor?: string;
    widgetShape?: string;
    widgetBorder?: string;
    widgetPosition?: string;
    widgetPadding?: number;
    widgetMargin?: number;
    widgetIcon?: string;
    widgetIconType?: string;
    widgetText?: string;
    popup_onload?: boolean;
    headerBgColor?: string;
    headerTextColor?: string;
    botMessageBgColor?: string;
    botMessageTextColor?: string;
    userMessageBgColor?: string;
    userMessageTextColor?: string;
    inputBgColor?: string;
    inputBorderColor?: string;
    inputButtonColor?: string;
    closeButtonColor?: string;
    closeButtonBgColor?: string;
    quickSuggestionBgColor?: string;
    quickSuggestionTextColor?: string;
    [key: string]: any;
  };
  workspace?: {
    logo?: string;
    name?: string;
  };
  [key: string]: any;
}

interface UseChatbotProps {
  chatbotId: string;
  initialChatbotData?: ChatbotData;
  conversationalLeadConfig?: ConversationalLeadConfig | null;
  onLeadCollected?: (data: Record<string, string>) => void;
  language?: string;
  retryConfig?: Partial<RetryConfig>;
}

interface UseChatbotReturn {
  chatbot: ChatbotData | null;
  isLoadingChatbot: boolean;
  chatbotError: string | null;
  text: string;
  setText: (text: string) => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  messages: Message[];
  loading: boolean;
  error: string;
  conversationId: string | null;
  hasLoadedInitialMessages: boolean;
  quickQuestions: MultilingualSuggestion[];
  mode: 'streaming' | 'standard';
  setMode: (mode: 'streaming' | 'standard') => void;
  handleSubmit: (e?: React.FormEvent, overrideText?: string) => Promise<void>;
  startLeadCollection: () => void;
  isAwaitingLeadAnswer: boolean;
  leadCollectionStatus: 'idle' | 'collecting' | 'submitting' | 'done' | 'error';
  handleQuickQuestion: (question: string) => Promise<void>;
  handleNewChat: () => void;
  formatTime: (date?: Date) => string;
  refetchChatbot: () => Promise<void>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  lastBotMessageRef: React.RefObject<HTMLDivElement | null>;
}

// ─── Greeting helpers ─────────────────────────────────────────────────────────

const FALLBACK_GREETING = '👋 Hello! How can I help you today?';

function normaliseGreeting(
  raw: ChatbotData['greeting']
): MultilingualSuggestion | string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const first = raw[0];
    if (typeof first === 'object' && first !== null) return first as MultilingualSuggestion;
    if (typeof first === 'string') return first;
    return null;
  }
  if (typeof raw === 'object') return raw as MultilingualSuggestion;
  if (typeof raw === 'string') return raw;
  return null;
}

function resolveGreetingText(
  greeting: MultilingualSuggestion | string | null,
  lang: string
): string {
  if (!greeting) return FALLBACK_GREETING;
  if (typeof greeting === 'string') return greeting || FALLBACK_GREETING;
  return (
    greeting[lang]?.trim() ||
    greeting['en']?.trim() ||
    Object.values(greeting).find(v => v?.trim()) ||
    FALLBACK_GREETING
  );
}

function timer(label: string) {
  const start = performance.now();
  return {
    end: () => {
      const ms = (performance.now() - start).toFixed(1);
      console.log(`⏱️ [${label}]: ${ms}ms`);
      return parseFloat(ms);
    }
  };
}

// ─── Scroll helpers ───────────────────────────────────────────────────────────

function scrollContainerToBottom(el: HTMLDivElement | null, smooth = true) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

function scrollToElement(
  container: HTMLDivElement | null,
  el: HTMLDivElement | null,
  padding = 12
) {
  if (!container || !el) return;
  container.scrollTo({
    top: el.offsetTop - padding,
    behavior: 'smooth',
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export function useChatbot({
  chatbotId,
  initialChatbotData,
  conversationalLeadConfig,
  onLeadCollected,
  language = 'en',
  retryConfig: customRetryConfig,
}: UseChatbotProps): UseChatbotReturn {
  // useMemo prevents a new object reference each render, which would re-trigger fetchChatbotData in a loop.
  const retryConfig = useMemo<RetryConfig>(
    () => ({ ...DEFAULT_RETRY_CONFIG, ...customRetryConfig }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  
  const [chatbot, setChatbot] = useState<ChatbotData | null>(initialChatbotData || null);
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(!initialChatbotData);
  const [chatbotError, setChatbotError] = useState<string | null>(null);

  const [text, setText] = useState<string>('');
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasLoadedInitialMessages, setHasLoadedInitialMessages] = useState<boolean>(false);
  const [quickQuestions, setQuickQuestions] = useState<MultilingualSuggestion[]>([]);
  const [mode, setMode] = useState<'streaming' | 'standard'>('standard');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);

  const chatbotRef = useRef<ChatbotData | null>(chatbot);
  useEffect(() => { chatbotRef.current = chatbot; }, [chatbot]);

  const forceScrollRef = useRef(false);
  const hasInitializedRef = useRef(false); // Prevent double initialization

  const messagesEndRef     = useRef<HTMLDivElement>(null);
  const inputRef           = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef   = useRef<HTMLDivElement>(null);
  const lastBotMessageRef  = useRef<HTMLDivElement>(null);

  // ── Conversational lead ───────────────────────────────────────────────────

  const onBotMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      senderType: 'BOT',
      content,
      createdAt: new Date(),
    }]);
  }, []);

  const conversationalLead = useConversationalLead({
    chatbotId,
    conversationId,
    config: conversationalLeadConfig ?? null,
    onBotMessage,
    onLeadCollected,
  });

  // ── showWelcomeMessage ────────────────────────────────────────────────────

  const showWelcomeMessage = useCallback(() => {
    const current = chatbotRef.current;
    if (!current) return;
    const normalised   = normaliseGreeting(current.greeting);
    const greetingText = resolveGreetingText(normalised, languageRef.current);
    setMessages([{ senderType: 'BOT', content: greetingText, createdAt: new Date() }]);
    setHasLoadedInitialMessages(true);
  }, []); // No dependencies needed as it uses refs

  // ── loadConversationMessages ──────────────────────────────────────────────

  const loadConversationMessages = useCallback(async (convId: string) => {
    const t = timer('loadConversationMessages');
    try {
      const response = await fetchWithRetry(
        `/api/conversations/${convId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        retryConfig
      );

      if (response.status === 404) {
        localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
        setConversationId(null);
        showWelcomeMessage();
        return;
      }

      if (response.ok) {
        const msgs = await response.json();
        if (Array.isArray(msgs) && msgs.length > 0) {
          setMessages(msgs.map((msg: any) => ({
            senderType: msg.senderType,
            content:    msg.content,
            createdAt:  new Date(msg.createdAt),
          })));
          setHasLoadedInitialMessages(true);
        } else {
          showWelcomeMessage();
        }
      } else {
        throw new Error(`Failed to load conversation: ${response.status}`);
      }
    } catch (err) {
      console.error('Error loading conversation messages:', err);
      localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
      setConversationId(null);
      showWelcomeMessage();
    } finally {
      t.end();
    }
  }, [chatbotId, showWelcomeMessage, retryConfig]);

  // ── fetchChatbotData ──────────────────────────────────────────────────────

  const fetchChatbotData = useCallback(async () => {
    if (!chatbotId) return;
    const t = timer('fetchChatbotData');
    setIsLoadingChatbot(true);
    setChatbotError(null);
    try {
      const response = await fetchWithRetry(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/chatbots/${chatbotId}`,
        { cache: 'no-store' },
        retryConfig
      );
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Chatbot service is currently busy. Please try again in a moment.');
        }
        if (response.status === 503) {
          throw new Error('Chatbot service is temporarily unavailable. Please try again.');
        }
        throw new Error(`Failed to fetch chatbot: ${response.status}`);
      }
      
      const data = await response.json();
      setChatbot(data);

      const rawSuggestions = data.suggestions;
      let parsed: MultilingualSuggestion[] = [];

      if (typeof rawSuggestions === 'string') {
        try {
          const arr = JSON.parse(rawSuggestions);
          parsed = Array.isArray(arr)
            ? arr.map((s: any) => typeof s === 'string' ? { en: s } : s)
            : [];
        } catch { parsed = []; }
      } else if (Array.isArray(rawSuggestions) && rawSuggestions.length > 0) {
        parsed = rawSuggestions.map((s: any) => typeof s === 'string' ? { en: s } : s);
      }

      setQuickQuestions(parsed.length ? parsed : []);
    } catch (err) {
      console.error('Error fetching chatbot:', err);
      setChatbotError(err instanceof Error ? err.message : 'Failed to load chatbot');
    } finally {
      t.end();
      setIsLoadingChatbot(false);
    }
  }, [chatbotId, retryConfig]);

  // ── Init: load chatbot ────────────────────────────────────────────────────

  useEffect(() => {
    if (!initialChatbotData && chatbotId) {
      fetchChatbotData();
    } else if (initialChatbotData) {
      setChatbot(initialChatbotData);
      if (initialChatbotData.suggestions) {
        const normalized = (initialChatbotData.suggestions as any[]).map((s: any) =>
          typeof s === 'string' ? { en: s } : s
        );
        setQuickQuestions(normalized);
      }
      setIsLoadingChatbot(false);
    }
  }, [chatbotId, initialChatbotData, fetchChatbotData]);

  // ── Init: load conversation or show welcome ───────────────────────────────

  useEffect(() => {
    // Prevent double initialization
    if (hasInitializedRef.current) return;
    if (!chatbot) return;
    
    hasInitializedRef.current = true;
    
    const savedConversationId = localStorage.getItem(`chatbot_${chatbotId}_conversation`);
    if (savedConversationId) {
      setConversationId(savedConversationId);
      loadConversationMessages(savedConversationId);
    } else {
      showWelcomeMessage();
    }
  }, [chatbot, chatbotId, loadConversationMessages, showWelcomeMessage]);

  // ── Re-render greeting when language changes ──────────────────────────────

  useEffect(() => {
    setMessages(prev => {
      if (prev.length !== 1 || prev[0].senderType !== 'BOT') return prev;
      const current = chatbotRef.current;
      if (!current) return prev;
      const normalised   = normaliseGreeting(current.greeting);
      const greetingText = resolveGreetingText(normalised, language);
      if (prev[0].content === greetingText) return prev;
      return [{ ...prev[0], content: greetingText }];
    });
  }, [language]);

  // ── Smart scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasLoadedInitialMessages) return;

    if (forceScrollRef.current) {
      forceScrollRef.current = false;
      requestAnimationFrame(() => {
        scrollToElement(chatContainerRef.current, lastBotMessageRef.current, 12);
      });
      return;
    }

    requestAnimationFrame(() => {
      scrollToElement(chatContainerRef.current, lastBotMessageRef.current, 12);
    });
  }, [messages, loading, hasLoadedInitialMessages]);

  useEffect(() => {
    if (inputRef.current && hasLoadedInitialMessages) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [hasLoadedInitialMessages]);

  // ─── Streaming submit with retry ─────────────────────────────────────────────

  const handleStreamingSubmit = useCallback(async (searchQuery: string) => {
    const tTotal = timer('handleStreamingSubmit [total]');

    setMessages(prev => [...prev, {
      senderType: 'BOT',
      content: '',
      createdAt: new Date(),
    }]);

    try {
      const response = await fetchWithRetry(
        '/api/chat/stream',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: searchQuery,
            conversationId,
            chatbotId,
            language: languageRef.current,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            pageUrl: window.location.href,
            isReturning: !!conversationId,
          }),
        },
        retryConfig
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId && newConversationId !== conversationId) {
        setConversationId(newConversationId);
        localStorage.setItem(`chatbot_${chatbotId}_conversation`, newConversationId);
      }

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      setStatus('streaming');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            senderType: 'BOT',
            content:    accumulated,
            createdAt:  new Date(),
          };
          return updated;
        });
      }

      setStatus('ready');
      setLoading(false);
    } catch (err) {
      console.error('Streaming error:', err);
      
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('resource')) {
          errorMessage = 'The chatbot is experiencing high demand. Please wait a moment and try again.';
        } else if (err.message.includes('503') || err.message.includes('unavailable')) {
          errorMessage = 'The chatbot service is temporarily unavailable. Please try again in a few seconds.';
        }
      }
      
      setStatus('error');
      setLoading(false);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          senderType: 'BOT',
          content:    errorMessage,
          createdAt:  new Date(),
        };
        return updated;
      });
      setError(err instanceof Error ? err.message : 'Failed to send message.');
      setTimeout(() => setStatus('ready'), 3000);
    } finally {
      tTotal.end();
    }
  }, [chatbotId, conversationId, retryConfig]);

  // ─── Standard submit with retry ──────────────────────────────────────────────

  const handleStandardSubmit = useCallback(async (searchQuery: string) => {
    const tTotal = timer('handleStandardSubmit [total]');

    try {
      const response = await fetchWithRetry(
        '/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: searchQuery,
            conversationId,
            chatbotId,
            language: languageRef.current,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            pageUrl: window.location.href,
            isReturning: !!conversationId,
          }),
        },
        retryConfig
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Chat response:', data);

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(`chatbot_${chatbotId}_conversation`, data.conversationId);
      }

      setStatus('streaming');
      setMessages(prev => [...prev, {
        senderType: 'BOT',
        content:    data.message || data.response,
        createdAt:  new Date(),
      }]);

      setTimeout(() => {
        setStatus('ready');
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error('Chat error:', err);
      
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('resource')) {
          errorMessage = 'The chatbot is experiencing high demand. Please wait a moment and try again.';
        } else if (err.message.includes('503') || err.message.includes('unavailable')) {
          errorMessage = 'The chatbot service is temporarily unavailable. Please try again in a few seconds.';
        }
      }
      
      setStatus('error');
      setLoading(false);
      setMessages(prev => [...prev, {
        senderType: 'BOT',
        content:    errorMessage,
        createdAt:  new Date(),
      }]);
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
      setTimeout(() => setStatus('ready'), 3000);
    } finally {
      tTotal.end();
    }
  }, [chatbotId, conversationId, retryConfig]);

  // ─── sendMessage ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (searchQuery: string) => {
    console.group(`🚀 sendMessage [mode=${mode}] — "${searchQuery.substring(0, 40)}"`);
    const tSubmit = timer('sendMessage [total]');

    forceScrollRef.current = true;

    setMessages(prev => [...prev, { senderType: 'USER', content: searchQuery, createdAt: new Date() }]);
    setLoading(true);
    setStatus('submitted');
    setError('');
    setText('');
    setTimeout(() => inputRef.current?.focus(), 50);

    if (mode === 'streaming') {
      await handleStreamingSubmit(searchQuery);
    } else {
      await handleStandardSubmit(searchQuery);
    }

    tSubmit.end();
    console.groupEnd();
  }, [mode, handleStreamingSubmit, handleStandardSubmit]);

  // ─── Handle pending message after lead collection ─────────────────────────

  useEffect(() => {
    if (conversationalLead.status === 'done' && pendingMessage) {
      const t = setTimeout(() => {
        sendMessage(pendingMessage);
        setPendingMessage(null);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [conversationalLead.status, pendingMessage, sendMessage]);

  // ─── handleSubmit ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const searchQuery = (overrideText || text).trim();
    if (!searchQuery) { setError('Please enter a message'); return; }

    if (conversationalLead.isAwaitingLeadAnswer) {
      forceScrollRef.current = true;
      setMessages(prev => [...prev, { senderType: 'USER', content: searchQuery, createdAt: new Date() }]);
      setText('');
      setTimeout(() => inputRef.current?.focus(), 50);
      await conversationalLead.handleUserMessage(searchQuery);
      return;
    }

    if (conversationalLeadConfig && conversationalLead.status === 'idle') {
      setPendingMessage(searchQuery);
      setText('');
      setTimeout(() => inputRef.current?.focus(), 50);
      conversationalLead.startLeadCollection();
      return;
    }

    await sendMessage(searchQuery);
  }, [text, conversationalLead, conversationalLeadConfig, sendMessage]);

  const handleQuickQuestion = useCallback(async (question: string) => {
    if (loading) return;
    setText(question);
    await handleSubmit(undefined, question);
  }, [loading, handleSubmit]);

  const handleNewChat = useCallback(() => {
    localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
    setConversationId(null);
    setText('');
    setError('');
    setStatus('ready');
    setMessages([]);
    showWelcomeMessage();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [chatbotId, showWelcomeMessage]);

  const formatTime = useCallback((date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const refetchChatbot = useCallback(async () => { 
    await fetchChatbotData(); 
  }, [fetchChatbotData]);

  return {
    chatbot,
    isLoadingChatbot,
    chatbotError,
    text,
    setText,
    status,
    messages,
    loading,
    error,
    conversationId,
    hasLoadedInitialMessages,
    quickQuestions,
    mode,
    setMode,
    handleSubmit,
    handleQuickQuestion,
    handleNewChat,
    startLeadCollection: conversationalLead.startLeadCollection,
    isAwaitingLeadAnswer: conversationalLead.isAwaitingLeadAnswer,
    leadCollectionStatus: conversationalLead.status,
    formatTime,
    refetchChatbot,
    messagesEndRef,
    inputRef,
    chatContainerRef,
    lastBotMessageRef,
  };
}