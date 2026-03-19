"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MultilingualSuggestion {
  en?: string
  ja?: string
  hi?: string
  fr?: string
  es?: string
  ar?: string
  [key: string]: string | undefined
}

export const SUPPORTED_LANGUAGES = [
  { name: 'English',  code: 'en', img: '/flags/en.svg', placeholder: 'e.g. How can I help you today?',          dir: 'ltr' },
  { name: 'Japanese', code: 'ja', img: '/flags/ja.svg', placeholder: 'e.g. 何かお手伝いできることはありますか？',  dir: 'ltr' },
  { name: 'Hindi',    code: 'hi', img: '/flags/hi.svg', placeholder: 'e.g. मैं आपकी कैसे मदद कर सकता हूँ?',   dir: 'ltr' },
  { name: 'French',   code: 'fr', img: '/flags/fr.svg', placeholder: 'e.g. Comment puis-je vous aider ?',       dir: 'ltr' },
  { name: 'Spanish',  code: 'es', img: '/flags/es.svg', placeholder: 'e.g. ¿En qué puedo ayudarte?',            dir: 'ltr' },
  { name: 'Arabic',   code: 'ar', img: '/flags/ar.svg', placeholder: 'e.g. كيف يمكنني مساعدتك؟',               dir: 'rtl' },
] as const

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code']

interface ChatbotConfig {
  id: string;
  name: string;
  greeting: MultilingualSuggestion;
  directive: string;
  theme: any;
  avatar: string | null;
  icon: string | null;
  popup_onload: boolean;
  suggestions: MultilingualSuggestion[];
  description?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

interface ChatbotContextType {
  config: ChatbotConfig;
  updateConfig: (updates: Partial<ChatbotConfig>) => void;
  refreshConfig: () => Promise<void>;
  // Suggestion helpers
  addSuggestion: (suggestion?: Partial<MultilingualSuggestion>) => void;
  removeSuggestion: (index: number) => void;
  updateSuggestionField: (index: number, langCode: string, value: string) => void;
  clearSuggestions: () => void;
  // Greeting helpers
  updateGreetingField: (langCode: string, value: string) => void;
  // Active language for quick-add UI
  activeLang: LanguageCode;
  setActiveLang: (code: LanguageCode) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise DB data: legacy string[] → MultilingualSuggestion[] */
const normaliseSuggestions = (raw: any[]): MultilingualSuggestion[] => {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return { en: item }
    if (typeof item === 'object' && item !== null) return item as MultilingualSuggestion
    return {}
  })
}

/**
 * Normalise the greeting from the DB.
 * DB stores Json[] → take index [0].
 * Legacy string → wrap as { en: value }.
 * Fallback → default English greeting.
 */
const normaliseGreeting = (raw: any): MultilingualSuggestion => {
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0]
    if (typeof first === 'object' && first !== null) return first as MultilingualSuggestion
    if (typeof first === 'string') return { en: first }
  }
  if (typeof raw === 'string' && raw.trim()) return { en: raw }
  return { en: 'How can I help you today?' }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultConfig: ChatbotConfig = {
  id: '',
  name: '',
  greeting: { en: 'How can I help you today?' },
  directive: '',
  theme: null,
  avatar: null,
  icon: null,
  popup_onload: false,
  suggestions: [],
  description: '',
  model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  max_tokens: 500,
  temperature: 0.7,
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({
  children,
  initialId,
}: {
  children: ReactNode;
  initialId: string;
}) {
  const [config, setConfig] = useState<ChatbotConfig>({ ...defaultConfig, id: initialId });
  const [activeLang, setActiveLang] = useState<LanguageCode>('en');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (initialId && !hasFetchedRef.current) {
      refreshConfig();
      hasFetchedRef.current = true;
    }
  }, [initialId]);

  // ─── Config ────────────────────────────────────────────────────────────────

  const updateConfig = (updates: Partial<ChatbotConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const refreshConfig = async () => {
    try {
      const response = await fetch(`/api/chatbots/${initialId}`);
      if (!response.ok) return;
      const data = await response.json();

      const transformed: ChatbotConfig = {
        id:           data.id           || '',
        name:         data.name         || '',
        greeting:     normaliseGreeting(data.greeting),
        directive:    data.directive    || '',
        theme:        data.theme        || null,
        avatar:       data.avatar       ?? null,
        icon:         data.icon         ?? null,
        popup_onload: data.popup_onload ?? data.theme?.popup_onload ?? false,
        suggestions:  normaliseSuggestions(data.suggestions || []),
        description:  data.description  || '',
        model:        data.model        || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        max_tokens:   data.max_tokens   || 500,
        temperature:  data.temperature  || 0.7,
      };

      setConfig(prev => ({ ...prev, ...transformed }));
    } catch (error) {
      console.error('Failed to refresh config:', error);
    }
  };

  // ─── Suggestion helpers ────────────────────────────────────────────────────

  const addSuggestion = (suggestion: Partial<MultilingualSuggestion> = {}) => {
    setConfig(prev => ({
      ...prev,
      suggestions: [...prev.suggestions, suggestion],
    }));
  };

  const removeSuggestion = (index: number) => {
    setConfig(prev => ({
      ...prev,
      suggestions: prev.suggestions.filter((_, i) => i !== index),
    }));
  };

  const updateSuggestionField = (index: number, langCode: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      suggestions: prev.suggestions.map((s, i) =>
        i === index ? { ...s, [langCode]: value } : s
      ),
    }));
  };

  const clearSuggestions = () => {
    setConfig(prev => ({ ...prev, suggestions: [] }));
  };

  // ─── Greeting helpers ──────────────────────────────────────────────────────

  const updateGreetingField = (langCode: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      greeting: { ...prev.greeting, [langCode]: value },
    }));
  };

  // ─── Provider ─────────────────────────────────────────────────────────────

  return (
    <ChatbotContext.Provider value={{
      config,
      updateConfig,
      refreshConfig,
      addSuggestion,
      removeSuggestion,
      updateSuggestionField,
      clearSuggestions,
      updateGreetingField,
      activeLang,
      setActiveLang,
    }}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbot() {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
}

// ─── Utility: resolve greeting/suggestion for a given user language ───────────

/**
 * Given a multilingual object (or legacy string), return the best text for
 * `userLang`, falling back to English, then the first non-empty value.
 */
export function getLocalizedText(
  value: MultilingualSuggestion | string | undefined | null,
  userLang: LanguageCode = 'en'
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return (
    value[userLang]?.trim() ||
    value['en']?.trim() ||
    Object.values(value).find(v => v?.trim()) ||
    ''
  )
}