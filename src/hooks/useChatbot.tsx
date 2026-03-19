'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConversationalLead, ConversationalLeadConfig } from './useConversationalLead';
import { Message } from '@/types/chat';

export type MultilingualSuggestion = Partial<Record<string, string>>

interface ChatbotData {
  id: string;
  name: string;
  description?: string;
  // Only the two image URL fields remain on the Chatbot model.
  // All sizing, shape, border and color styling lives in ChatbotTheme.
  avatar?: string | null;
  icon?: string | null;
  greeting?: MultilingualSuggestion | string | MultilingualSuggestion[] | null;
  suggestions?: MultilingualSuggestion[] | string[];
  popup_onload?: boolean;
  theme?: {
    // Widget / toggle button
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
    // Chat window colors
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
}: UseChatbotProps): UseChatbotReturn {
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
  }, []);

  // ── loadConversationMessages ──────────────────────────────────────────────

  const loadConversationMessages = useCallback(async (convId: string) => {
    const t = timer('loadConversationMessages');
    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

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
        } else {
          showWelcomeMessage();
        }
      } else {
        throw new Error('Failed to load conversation');
      }
    } catch (err) {
      console.error('Error loading conversation messages:', err);
      localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
      setConversationId(null);
      showWelcomeMessage();
    } finally {
      t.end();
      setHasLoadedInitialMessages(true);
    }
  }, [chatbotId, showWelcomeMessage]);

  // ── fetchChatbotData ──────────────────────────────────────────────────────

  const fetchChatbotData = useCallback(async () => {
    if (!chatbotId) return;
    const t = timer('fetchChatbotData');
    setIsLoadingChatbot(true);
    setChatbotError(null);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/chatbots/${chatbotId}`,
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error(`Failed to fetch chatbot: ${response.status}`);
      const data = await response.json();
      setChatbot(data);

      // Normalise suggestions — only multilingual objects now, no plain strings
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
  }, [chatbotId]);

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
    if (!chatbot) return;
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
    const container = chatContainerRef.current;
    if (!container) return;

    if (forceScrollRef.current) {
      forceScrollRef.current = false;
      requestAnimationFrame(() => {
        scrollContainerToBottom(chatContainerRef.current, false);
      });
      return;
    }

    requestAnimationFrame(() => {
      scrollToElement(chatContainerRef.current, lastBotMessageRef.current, 12);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, hasLoadedInitialMessages]);

  useEffect(() => {
    if (inputRef.current && hasLoadedInitialMessages) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [hasLoadedInitialMessages]);

  // ─── Streaming submit ─────────────────────────────────────────────────────

  const handleStreamingSubmit = async (searchQuery: string) => {
    const tTotal = timer('handleStreamingSubmit [total]');

    setMessages(prev => [...prev, {
      senderType: 'BOT',
      content: '...',
      createdAt: new Date(),
    }]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: searchQuery,
          conversationId,
          chatbotId,
          language: languageRef.current,
        }),
      });

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
      setStatus('error');
      setLoading(false);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          senderType: 'BOT',
          content:    'Sorry, I encountered an error. Please try again.',
          createdAt:  new Date(),
        };
        return updated;
      });
      setError(err instanceof Error ? err.message : 'Failed to send message.');
      setTimeout(() => setStatus('ready'), 3000);
    } finally {
      tTotal.end();
    }
  };

  // ─── Standard submit ──────────────────────────────────────────────────────

  const handleStandardSubmit = async (searchQuery: string) => {
    const tTotal = timer('handleStandardSubmit [total]');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: searchQuery,
          conversationId,
          chatbotId,
          language: languageRef.current,
        }),
      });

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
      setStatus('error');
      setLoading(false);
      setMessages(prev => [...prev, {
        senderType: 'BOT',
        content:    'Sorry, I encountered an error. Please try again.',
        createdAt:  new Date(),
      }]);
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
      setTimeout(() => setStatus('ready'), 3000);
    } finally {
      tTotal.end();
    }
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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

  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
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
  };

  const handleQuickQuestion = async (question: string) => {
    if (loading) return;
    setText(question);
    await handleSubmit(undefined, question);
  };

  const handleNewChat = () => {
    localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
    setConversationId(null);
    setText('');
    setError('');
    setStatus('ready');
    setMessages([]);
    showWelcomeMessage();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const refetchChatbot = async () => { await fetchChatbotData(); };

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