// hooks/useChatbot.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Message } from '@/types/chat';

interface ChatbotData {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  icon?: string;
  greeting?: string;
  suggestions?: string[];
  workspace?: {
    logo?: string;
    name?: string;
  };
  [key: string]: any;
}

interface UseChatbotProps {
  chatbotId: string;
  initialChatbotData?: ChatbotData;
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
  quickQuestions: string[];
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleQuickQuestion: (question: string) => Promise<void>;
  handleNewChat: () => void;
  formatTime: (date?: Date) => string;
  refetchChatbot: () => Promise<void>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useChatbot({ chatbotId, initialChatbotData }: UseChatbotProps): UseChatbotReturn {
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
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Function to load existing conversation messages
  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log("Load conversation response status:", response.status);
      
      if (response.status === 404) {
        console.log('Conversation not found in DB');
        localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
        setConversationId(null);
        showWelcomeMessage();
        return;
      }
      
      if (response.ok) {
        const messages = await response.json();
        console.log("Loaded conversation messages:", messages);
        
        if (Array.isArray(messages) && messages.length > 0) {
          // Format messages from API response
          const formattedMessages = messages.map((msg: any) => ({
            senderType: msg.senderType,
            content: msg.content,
            createdAt: new Date(msg.createdAt),
          }));
          
          setMessages(formattedMessages);
          console.log(`Loaded ${formattedMessages.length} existing messages`);
        } else {
          // Empty conversation - show welcome message
          console.log('Conversation exists but is empty');
          showWelcomeMessage();
        }
      } else {
        throw new Error('Failed to load conversation');
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
      setConversationId(null);
      showWelcomeMessage();
    } finally {
      setHasLoadedInitialMessages(true);
    }
  }, [chatbotId]);

  // Function to show welcome message
  const showWelcomeMessage = useCallback(() => {
    if (!chatbot) return;
    
    const welcomeMessage: Message = {
      senderType: 'BOT',
      content: chatbot.greeting || "👋 Hello! How can I help you today?",
      createdAt: new Date(),
    };
    setMessages([welcomeMessage]);
    setHasLoadedInitialMessages(true);
  }, [chatbot]);

  // Fetch chatbot data
  const fetchChatbotData = useCallback(async () => {
    if (!chatbotId) return;
    
    setIsLoadingChatbot(true);
    setChatbotError(null);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/chatbots/${chatbotId}`,
        { cache: 'no-store' }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chatbot: ${response.status}`);
      }
      
      const data = await response.json();
      setChatbot(data);
      
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setQuickQuestions(data.suggestions);
      } else {
        setQuickQuestions([
          "How can you help me?",
          "What are your features?",
          "Tell me about pricing",
          "How do I get started?",
        ]);
      }
    } catch (error) {
      console.error('Error fetching chatbot:', error);
      setChatbotError(error instanceof Error ? error.message : 'Failed to load chatbot');
    } finally {
      setIsLoadingChatbot(false);
    }
  }, [chatbotId]);

  useEffect(() => {
    if (!initialChatbotData && chatbotId) {
      fetchChatbotData();
    } else if (initialChatbotData) {
      setChatbot(initialChatbotData);
      if (initialChatbotData.suggestions) {
        setQuickQuestions(initialChatbotData.suggestions);
      }
      setIsLoadingChatbot(false);
    }
  }, [chatbotId, initialChatbotData, fetchChatbotData]);

  // Initialize chat - load existing conversation if it exists
  useEffect(() => {
    if (!chatbot) return;
    
    // Check if there's an existing conversation in localStorage
    const savedConversationId = localStorage.getItem(`chatbot_${chatbotId}_conversation`);
    
    if (savedConversationId) {
      console.log('Found existing conversation, loading messages:', savedConversationId);
      setConversationId(savedConversationId);
      // Load existing conversation messages
      loadConversationMessages(savedConversationId);
    } else {
      // No existing conversation - show welcome message
      console.log('No existing conversation, showing welcome message');
      showWelcomeMessage();
    }
    
  }, [chatbot, chatbotId, loadConversationMessages, showWelcomeMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (hasLoadedInitialMessages) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'nearest'
        });
      }, 100);
    }
  }, [messages, loading, hasLoadedInitialMessages]);

  // Focus input when chat opens
  useEffect(() => {
    if (inputRef.current && hasLoadedInitialMessages) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [hasLoadedInitialMessages]);

  // Handle form submission - Conversation created automatically by API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const searchQuery = text.trim();
    if (!searchQuery) {
      setError('Please enter a message');
      return;
    }

    // Add user message
    const userMessage: Message = { 
      senderType: 'USER', 
      content: searchQuery,
      createdAt: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    setLoading(true);
    setStatus('submitted');
    setError('');
    setText('');
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    try {
      const requestData = {
        message: searchQuery,
        conversationId, // Might be null - that's fine!
        chatbotId,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Update conversationId from response (it might be newly created)
      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(`chatbot_${chatbotId}_conversation`, data.conversationId);
        console.log('Created/updated conversation:', data.conversationId);
      }
      
      setStatus('streaming');
      
      const assistantMessage: Message = {
        senderType: 'BOT',
        content: data.message || data.response,
        createdAt: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      setTimeout(() => {
        setStatus('ready');
        setLoading(false);
      }, 500);

    } catch (error) {
      console.error('Chat error:', error);
      setStatus('error');
      setLoading(false);
      
      const errorMessage: Message = {
        senderType: 'BOT',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      setError(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
      
      setTimeout(() => {
        setStatus('ready');
      }, 3000);
    }
  };

  // Handle quick question
  const handleQuickQuestion = async (question: string) => {
    if (loading) return;
    
    setText(question);
    
    const fakeEvent = {
      preventDefault: () => {},
    } as React.FormEvent<HTMLFormElement>;
    
    await handleSubmit(fakeEvent);
  };

  // Handle new chat - Just reset UI, don't create conversation yet
  const handleNewChat = () => {
    // Clear localStorage
    localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
    
    // Reset state
    setConversationId(null);
    setText('');
    setError('');
    setStatus('ready');
    setMessages([]);
    
    // Show welcome message again
    showWelcomeMessage();
    
    // Focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const refetchChatbot = async () => {
    await fetchChatbotData();
  };

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
    handleSubmit,
    handleQuickQuestion,
    handleNewChat,
    formatTime,
    refetchChatbot,
    messagesEndRef,
    inputRef,
    chatContainerRef,
  };
}