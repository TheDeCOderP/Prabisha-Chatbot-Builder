"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

// Update the interface to match database field names
interface ChatbotConfig {
  id: string;
  name: string;
  greeting: string;
  directive: string;
  theme: any; // Changed from string to any to hold theme object
  avatar: string | null;
  avatarSize: number;
  avatarColor: string;
  avatarBorder: string; 
  avatarBgColor: string;
  icon: string | null;
  iconSize: number;
  iconColor: string;
  iconShape: string; 
  iconBorder: string;
  iconBgColor: string;
  popup_onload: boolean;
  suggestions: string[]; // Added suggestions array
  description?: string; // Added description (optional)
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

interface ChatbotContextType {
  config: ChatbotConfig;
  updateConfig: (updates: Partial<ChatbotConfig>) => void;
  refreshConfig: () => Promise<void>;
  addSuggestion: (suggestion: string) => void;
  removeSuggestion: (index: number) => void;
  updateSuggestion: (index: number, suggestion: string) => void;
  clearSuggestions: () => void;
}

const defaultConfig: ChatbotConfig = {
  id: '',
  name: '',
  greeting: 'How can I help you today?',
  directive: '',
  theme: null, // Changed from '' to null
  avatar: null,
  avatarSize: 50,
  avatarColor: '',
  avatarBorder: '',
  avatarBgColor: '',
  icon: null,
  iconSize: 50,
  iconColor: '',
  iconShape: '',
  iconBorder: '',
  iconBgColor: '',
  popup_onload: false,
  suggestions: [], // Default empty suggestions array
  description: '',
  model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  max_tokens: 500,
  temperature: 0.7,
};

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ 
  children, 
  initialId 
}: { 
  children: ReactNode; 
  initialId: string;
}) {
  const [config, setConfig] = useState<ChatbotConfig>({
    ...defaultConfig,
    id: initialId,
  });

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const initializeConfig = async () => {
      if (initialId && !hasFetchedRef.current) {
        await refreshConfig();
        hasFetchedRef.current = true;
      }
    };
    
    initializeConfig();
  }, [initialId]);

  const updateConfig = (updates: Partial<ChatbotConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const refreshConfig = async () => {
    try {
      const response = await fetch(`/api/chatbots/${initialId}`);
      if (response.ok) {
        const data = await response.json();
        
        const transformedData: ChatbotConfig = {
          id: data.id || '',
          name: data.name || '',
          greeting: data.greeting || 'How can I help you today?',
          directive: data.directive || '',
          theme: data.theme || null, // Changed from '' to null
          avatar: data.avatar,
          avatarSize: data.avatarSize || 50,
          avatarColor: data.avatarColor || '',
          avatarBorder: data.avatarBorder?.toLowerCase() || '',
          avatarBgColor: data.avatarBgColor || '',
          icon: data.icon,
          iconSize: data.iconSize || 50,
          iconColor: data.iconColor || '',
          iconShape: data.iconShape?.toLowerCase() || '',
          iconBorder: data.iconBorder?.toLowerCase() || '',
          iconBgColor: data.iconBgColor || '',
          popup_onload: data.popup_onload || false,
          suggestions: data.suggestions || [], // Add suggestions from API
          description: data.description || '',
          model: data.model || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
          max_tokens: data.max_tokens || 500,
          temperature: data.temperature || 0.7,
        };
        
        setConfig(prev => ({ ...prev, ...transformedData }));
      }
    } catch (error) {
      console.error('Failed to refresh config:', error);
    }
  };

  // Suggestion management methods
  const addSuggestion = (suggestion: string) => {
    if (suggestion.trim()) {
      setConfig(prev => ({
        ...prev,
        suggestions: [...prev.suggestions, suggestion.trim()]
      }));
    }
  };

  const removeSuggestion = (index: number) => {
    setConfig(prev => ({
      ...prev,
      suggestions: prev.suggestions.filter((_, i) => i !== index)
    }));
  };

  const updateSuggestion = (index: number, suggestion: string) => {
    if (suggestion.trim()) {
      setConfig(prev => ({
        ...prev,
        suggestions: prev.suggestions.map((s, i) => 
          i === index ? suggestion.trim() : s
        )
      }));
    }
  };

  const clearSuggestions = () => {
    setConfig(prev => ({
      ...prev,
      suggestions: []
    }));
  };

  return (
    <ChatbotContext.Provider value={{ 
      config, 
      updateConfig, 
      refreshConfig,
      addSuggestion,
      removeSuggestion,
      updateSuggestion,
      clearSuggestions
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