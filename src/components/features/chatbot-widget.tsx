'use client';
import Image from 'next/image';
import DOMPurify from 'dompurify';
import { useEffect, useState } from 'react';
import { 
  Loader2, 
  Zap,
  XIcon,
  MicIcon, 
  MicOffIcon, 
  RefreshCw, 
  Send,
  UserPlus,
  CheckCircle2,
  VolumeX,
  Volume2,
  Gauge,        // ✅ new icon for mode toggle
  Radio,        // ✅ new icon for streaming indicator
} from 'lucide-react';
import { Message } from '@/types/chat';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from '@/components/ui/shadcn-io/ai/prompt-input';
import { useChatbot } from '@/hooks/useChatbot';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useLeadGeneration } from '@/hooks/useLeadGeneration';
import { LeadForm } from '@/components/forms/lead-form';
import { Button } from '@/components/ui/button';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface ChatbotWidgetProps {
  chatbotId: string;
  initialChatbotData?: any;
}

// ====================
// Reusable Components
// ====================

const LoadingSpinner = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex flex-col h-full min-h-[400px] bg-background">
    {/* Header Skeleton */}
    <div className="max-h-24 rounded-t-xl flex items-stretch p-4 border-b">
      <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse shrink-0" />
      <div className="flex-1 ml-3 space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>

    {/* Messages Skeleton */}
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      
      <div className="space-y-2 mt-6">
        <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>

    {/* Input Skeleton */}
    <div className="border-t p-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

const ErrorDisplay = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center p-4">
      <p className="text-destructive">{error}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-2">
          Retry
        </Button>
      )}
    </div>
  </div>
);

const ChatContainer = ({ 
  children, 
  isEmbedded, 
  isMobile, 
  isOpen 
}: { 
  children: React.ReactNode;
  isEmbedded: boolean;
  isMobile: boolean;
  isOpen: boolean;
}) => (
  <div className={`${isEmbedded ? 'w-full h-full' : `fixed ${isMobile ? 'inset-0' : 'bottom-6 right-6'} z-50`} ${isMobile && !isOpen ? 'hidden' : ''}`}>
    {children}
  </div>
);

const LeadFormOverlay = ({
  activeLeadForm,
  chatbotId,
  conversationId,
  onClose,
  onSuccess,
  onSubmitLead,
}: {
  activeLeadForm: any;
  chatbotId: string;
  conversationId: string;
  onClose: () => void;
  onSuccess: () => void;
  onSubmitLead: (formData: Record<string, string>) => Promise<boolean>;
}) => (
  <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
      <LeadForm
        config={activeLeadForm}
        chatbotId={chatbotId}
        conversationId={conversationId}
        onClose={onClose}
        onSuccess={onSuccess}
        onSubmitLead={onSubmitLead}
      />
    </div>
  </div>
);

const ErrorBanner = ({ error }: { error: string }) => (
  <div className="mx-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg animate-in slide-in-from-bottom">
    <p className="text-sm text-destructive flex items-center gap-2">
      <XIcon className="h-3 w-3" />
      {error}
    </p>
  </div>
);

// ====================
// Main Chatbot Widget
// ====================

export default function ChatbotWidget({ chatbotId, initialChatbotData }: ChatbotWidgetProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [liveTheme, setLiveTheme] = useState<any>(null);

  const {
    chatbot,
    isLoadingChatbot,
    chatbotError,
    text,
    setText,
    status,
    messages,
    loading,
    error,
    hasLoadedInitialMessages,
    quickQuestions,
    conversationId,
    mode,          // ✅ pulled from hook
    setMode,       // ✅ pulled from hook
    handleSubmit,
    handleQuickQuestion,
    handleNewChat,
    formatTime,
    messagesEndRef,
    inputRef,
    chatContainerRef,
  } = useChatbot({
    chatbotId,
    initialChatbotData,
  });

  // Listen for theme updates from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'theme-update') {
        setLiveTheme(event.data.theme)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const {
    activeLeadForm,
    isLeadFormVisible,
    shouldShowLeadForm,
    isLoadingLeadConfig,
    leadFormError,
    hasSubmittedLead,
    showLeadForm,
    hideLeadForm,
    submitLeadForm,
    checkLeadRequirements,
    markLeadAsSubmitted,
  } = useLeadGeneration({
    chatbotId,
    conversationId,
    onLeadCollected: (leadData) => {
      console.log('Lead collected:', leadData);
    },
  });

  useEffect(() => {
    if (!chatbotId) return;
    const sessionId = localStorage.getItem(`chatbot_session_${chatbotId}`) || 
                      `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(sessionId);
    localStorage.setItem(`chatbot_session_${chatbotId}`, sessionId);
    setIsInitialized(true);
    window.parent.postMessage({ type: 'chatbot-loaded', chatbotId }, '*');
  }, [chatbotId]);

  useEffect(() => {
    if (messages.length > 0 && !hasSubmittedLead && conversationId) {
      checkLeadRequirements();
    }
  }, [messages, hasSubmittedLead, conversationId, checkLeadRequirements]);

  useEffect(() => {
    if (shouldShowLeadForm && activeLeadForm && !isLeadFormVisible && !loading) {
      setTimeout(() => showLeadForm(), 1000);
    }
  }, [shouldShowLeadForm, activeLeadForm, isLeadFormVisible, loading, showLeadForm]);

  // Loading states
  if (!isInitialized || isLoadingChatbot) {
    return <LoadingSpinner message="Loading chatbot..." />;
  }

  if (chatbotError) {
    return <ErrorDisplay error="Failed to load chatbot" onRetry={() => window.location.reload()} />;
  }

  if (!chatbot) {
    return null;
  }

  // Merge live theme with chatbot theme
  const effectiveChatbot = liveTheme ? {
    ...chatbot,
    theme: { ...chatbot.theme, ...liveTheme }
  } : chatbot;

  return (
    <ChatBot 
      chatbot={effectiveChatbot} 
      onClose={() => {
        window.parent.postMessage({ 
          type: 'chatbot-close',
          chatbotId: chatbotId 
        }, '*');
      }}
      // Chat state
      text={text}
      setText={setText}
      status={status}
      messages={messages}
      loading={loading}
      error={error}
      hasLoadedInitialMessages={hasLoadedInitialMessages}
      quickQuestions={quickQuestions}
      conversationId={conversationId}
      mode={mode}        // ✅ passed down
      setMode={setMode}  // ✅ passed down
      handleSubmit={handleSubmit}
      handleQuickQuestion={handleQuickQuestion}
      handleNewChat={handleNewChat}
      formatTime={formatTime}
      messagesEndRef={messagesEndRef}
      inputRef={inputRef}
      chatContainerRef={chatContainerRef}
      activeLeadForm={activeLeadForm}
      isLeadFormVisible={isLeadFormVisible}
      shouldShowLeadForm={shouldShowLeadForm}
      isLoadingLeadConfig={isLoadingLeadConfig}
      leadFormError={leadFormError}
      hasSubmittedLead={hasSubmittedLead}
      showLeadForm={showLeadForm}
      hideLeadForm={hideLeadForm}
      submitLeadForm={submitLeadForm}
      markLeadAsSubmitted={markLeadAsSubmitted}
    />
  );
}

// ====================
// ChatBot Component
// ====================

interface ChatBotProps {
  chatbot: any;
  onClose: () => void;
  text: string;
  setText: (text: string) => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  messages: Message[];
  loading: boolean;
  error: string;
  hasLoadedInitialMessages: boolean;
  quickQuestions: string[];
  conversationId: string | null;
  mode: 'streaming' | 'standard';          // ✅ added
  setMode: (mode: 'streaming' | 'standard') => void; // ✅ added
  handleSubmit: (e?: React.FormEvent, overrideText?: string) => Promise<void>;
  handleQuickQuestion: (question: string) => Promise<void>;
  handleNewChat: () => void;
  formatTime: (date?: Date) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  activeLeadForm: any;
  isLeadFormVisible: boolean;
  shouldShowLeadForm: boolean;
  isLoadingLeadConfig: boolean;
  leadFormError: string | null;
  hasSubmittedLead: boolean;
  showLeadForm: () => void;
  hideLeadForm: () => void;
  submitLeadForm: (formData: Record<string, string>) => Promise<boolean>;
  markLeadAsSubmitted: () => void;
}

function ChatBot({
  chatbot,
  onClose,
  text,
  setText,
  status,
  messages,
  loading,
  error,
  hasLoadedInitialMessages,
  quickQuestions,
  conversationId,
  mode,
  setMode,
  handleSubmit,
  handleQuickQuestion,
  handleNewChat,
  formatTime,
  messagesEndRef,
  inputRef,
  chatContainerRef,
  activeLeadForm,
  isLeadFormVisible,
  shouldShowLeadForm,
  isLoadingLeadConfig,
  leadFormError,
  hasSubmittedLead,
  showLeadForm,
  hideLeadForm,
  submitLeadForm,
  markLeadAsSubmitted,
}: ChatBotProps) {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  const { transcript, startListening, stopListening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechToText({ continuous: true, lang: "en-US" });
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false);

  useEffect(() => {
    if (isEmbedded) {
      document.body.style.overflow = 'hidden';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.height = '100vh';
      document.documentElement.style.height = '100vh';
      document.documentElement.style.overflow = 'hidden';
    }
  }, [isEmbedded]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (transcript) { setText(transcript); resetTranscript(); }
  }, [transcript, resetTranscript, setText]);

  useEffect(() => {
    if (isMicrophoneOn) { startListening(); } 
    else { stopListening(); resetTranscript(); }
  }, [isMicrophoneOn, startListening, stopListening, resetTranscript]);

  const handleToggleMicrophone = () => {
    if (!browserSupportsSpeechRecognition) return;
    setIsMicrophoneOn(!isMicrophoneOn);
  };

  const handleLeadFormSuccess = () => {
    markLeadAsSubmitted();
  };

  const handleClose = () => {
    if (isEmbedded) {
      onClose();
    } else {
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 300); // Match animation duration
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  if (!hasLoadedInitialMessages) {
    return (
      <ChatContainer isEmbedded={isEmbedded} isMobile={isMobile} isOpen={true}>
        <div className={`${isMobile || isEmbedded ? 'w-full h-full rounded-none' : 'w-[95vw] sm:w-96 md:w-[480px] h-150 rounded-xl bottom-6 right-6'} bg-background flex flex-col border shadow-2xl relative overflow-hidden`}>
          {/* Header Skeleton */}
          <div className="max-h-24 rounded-t-xl flex items-stretch p-4 border-b">
            <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse shrink-0" />
            <div className="flex-1 ml-3 space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Messages Skeleton */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2 mt-6">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>

          {/* Input Skeleton */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse" />
              <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </ChatContainer>
    );
  }

  return (
    <ChatContainer isEmbedded={isEmbedded} isMobile={isMobile} isOpen={isOpen}>
      {isOpen ? (
        <div 
          className={`${isMobile || isEmbedded ? 'w-full h-full rounded-none' : 'w-[95vw] sm:w-96 md:w-[480px] h-150 rounded-xl bottom-6 right-6'} bg-background flex flex-col border shadow-2xl relative overflow-hidden transition-all duration-300 ease-out ${
            isClosing 
              ? 'animate-out slide-out-to-bottom-full' 
              : 'animate-in slide-in-from-bottom-full'
          }`}
        >
          <ChatHeader 
            onClose={handleClose} 
            chatbot={chatbot}
            isMobile={isMobile}
            isEmbedded={isEmbedded}
          />

          {isLeadFormVisible && activeLeadForm && (
            <LeadFormOverlay 
              activeLeadForm={activeLeadForm}
              chatbotId={chatbot.id}
              conversationId={conversationId || ''}
              onClose={hideLeadForm}
              onSuccess={markLeadAsSubmitted}
              onSubmitLead={submitLeadForm}
            />
          )}

          <ChatMessages
            messages={messages}
            loading={loading}
            status={status}
            error={error}
            quickQuestions={quickQuestions}
            onQuickQuestion={handleQuickQuestion}
            chatContainerRef={chatContainerRef}
            messagesEndRef={messagesEndRef}
            formatTime={formatTime}
            chatbot={chatbot}
            showLeadForm={!hasSubmittedLead && activeLeadForm ? showLeadForm : undefined}
            hasSubmittedLead={hasSubmittedLead}
          />

          {error && <ErrorBanner error={error} />}

            <ChatInput
              text={text}
              setText={setText}
              loading={loading}
              isMicrophoneOn={isMicrophoneOn}
              browserSupportsSpeechRecognition={browserSupportsSpeechRecognition}
              onSubmit={handleSubmit}
              onNewChat={handleNewChat}
              status={status}
              inputRef={inputRef}
              onToggleMicrophone={handleToggleMicrophone}
              hasLeadForm={!hasSubmittedLead && !!activeLeadForm}
              onShowLeadForm={showLeadForm}
              isLoadingLeadConfig={isLoadingLeadConfig}
              chatbot={chatbot}
            />
        </div>
      ) : (
        !isEmbedded && (
          <ChatToggleButton 
            onClick={handleOpen} 
            isMobile={isMobile} 
            chatbot={chatbot}
          />
        )
      )}
    </ChatContainer>
  );
}

// ====================
// Sub-Components
// ====================

function ChatToggleButton({ onClick, isMobile, chatbot }: { onClick: () => void; isMobile: boolean; chatbot: any }) {
  if (isMobile) return null;
  
  const widgetSize = chatbot.theme?.widgetSize || 70;
  const widgetSizeMobile = chatbot.theme?.widgetSizeMobile || 60;
  const widgetColor = chatbot.theme?.widgetColor || "#3b82f6";
  const widgetBgColor = chatbot.theme?.widgetBgColor || "#FFFFFF";
  
  // Use mobile size on small screens
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobileScreen(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const effectiveSize = isMobileScreen ? widgetSizeMobile : widgetSize;
  
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group animate-bounce-slow cursor-pointer"
      aria-label="Open chatbot"
      style={{
        width: `${effectiveSize}px`,
        height: `${effectiveSize}px`,
        backgroundColor: widgetBgColor,
        border: `3px solid ${widgetColor}`,
      }}
    >
      <div className="relative w-full h-full">
        <Image
          src={chatbot.avatar || chatbot.icon || "/character1.png"}
          height={effectiveSize}
          width={effectiveSize}
          alt={chatbot.name || "Chat Assistant"}
          className="rounded-full w-full h-full object-contain"
        />
      </div>
      <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full font-bold animate-pulse">Chat</div>
    </button>
  );
}

interface ChatHeaderProps {
  onClose: () => void;
  chatbot: any;
  isMobile?: boolean;
  isEmbedded?: boolean;
}

function ChatHeader({ onClose, chatbot, isMobile, isEmbedded }: ChatHeaderProps) {
  const theme = chatbot.theme;
  const headerBg = theme?.headerBgColor || "#1320AA";
  const headerText = theme?.headerTextColor || "#ffffff";
  const closeBtnBg = theme?.closeButtonBgColor || "#DD692E";
  const closeBtnColor = theme?.closeButtonColor || "#ffffff";

  return (
    <div 
      className={`max-h-24 ${isMobile || isEmbedded ? 'rounded-none' : 'rounded-t-xl'} flex items-stretch overflow-visible z-10 relative`}
      style={{ backgroundColor: headerBg, color: headerText }}
    >
      
      {/* 1. Avatar - With padding */}
      <div className="max-w-20 shrink-0 p-3"> 
        <Image 
          src={chatbot.avatar || "/icons/logo.png"}
          height={64}
          width={64}
          alt={chatbot.name || "Assistant"}
          className="h-full w-full object-contain" 
          unoptimized 
        />
      </div>

      {/* 2. Text Content - Padding applied here instead of parent */}
      <div className="grow flex flex-col justify-center py-4 pr-12 min-w-0">
        <h3 className="font-semibold text-base truncate leading-tight">
          {chatbot.name || "Property Assistant"}
        </h3>
        <p className="text-[11px] opacity-90 truncate">
          {chatbot.description || "I am here to help you."}
        </p>
      </div>

      {/* 3. Close Button - Inside header, top-right corner */}
      <button 
        onClick={onClose}
        className="absolute top-3 right-3 z-50 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
        aria-label="Close chat"
      >
        <div 
          className="rounded-full p-1.5 shadow-lg border-2 border-white flex items-center justify-center w-7 h-7"
          style={{ backgroundColor: closeBtnBg, color: closeBtnColor }}
        >
          <XIcon size={14} strokeWidth={3} />
        </div>
      </button>  
    </div>
  );
}

// (ChatMessages is unchanged — omitted for brevity, keep your existing one)

// ====================
// ChatMessages - unchanged from your original
// ====================

const sanitizedHTML = (html: string) => DOMPurify.sanitize(html);

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  error: string;
  quickQuestions: string[];
  onQuickQuestion: (question: string) => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  formatTime: (date?: Date) => string;
  chatbot: any;
  showLeadForm?: () => void;
  hasSubmittedLead: boolean;
}

function ChatMessages({
  messages,
  loading,
  status,
  error,
  quickQuestions,
  onQuickQuestion,
  chatContainerRef,
  messagesEndRef,
  formatTime,
  chatbot,
  showLeadForm,
  hasSubmittedLead,
}: ChatMessagesProps) {
  const { speak, stop, isPlaying } = useTextToSpeech();
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);

  const theme = chatbot.theme;
  const botBgColor = theme?.botMessageBgColor || "#f1f5f9";
  const botTextColor = theme?.botMessageTextColor || "#0f172a";
  const userBgColor = theme?.userMessageBgColor || "#1320AA";
  const userTextColor = theme?.userMessageTextColor || "#ffffff";
  const quickSuggestionBg = theme?.quickSuggestionBgColor || "#ffffff";
  const quickSuggestionText = theme?.quickSuggestionTextColor || "#0f172a";

  const hasUserMessages = messages.filter(m => m.senderType === 'USER').length > 0;
  const hasMultipleMessages = messages.length >= 2;

  const handleSpeak = async (messageId: string, content: string) => {
    if (activeSpeakingId === messageId && isPlaying) {
      stop();
      setActiveSpeakingId(null);
    } else {
      setActiveSpeakingId(messageId);
      await speak(content);
    }
  };

  const ChatbotAvatar = ({ size = "default", showName = true, className = "" }: { size?: "small" | "default"; showName?: boolean; className?: string }) => (
    <div className={`shrink-0 flex flex-col items-center ${size === "default" ? "w-12.5" : ""} ${className}`}>
      <Image src={chatbot.icon || "/icons/logo1.png"} height={size === "default" ? 50 : 32} width={size === "default" ? 50 : 32} alt={chatbot.name || "Assistant"} className={`${size === "default" ? 'p-1' : 'p-0.5'} rounded-full bg-primary/10 flex items-center justify-center`} />
      {showName && size === "default" && (
        <span className="text-[10px] text-center break-words w-full leading-tight mt-1">
          {chatbot.name || "Assistant"}
        </span>
      )}
    </div>
  );

  const SmallChatbotAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
      <Image src={chatbot.avatar || chatbot.icon || "/character1.png"} height={16} width={16} alt={chatbot.name || "Assistant"} className="rounded-full" />
    </div>
  );

  const MessageBubble = ({ message, isUser, index }: { message: Message; isUser: boolean; index: number; showAvatar?: boolean; avatarSize?: "small" | "default" }) => {
    const messageId = `msg-${index}`;
    const isThisMessageSpeaking = activeSpeakingId === messageId && isPlaying;
    return (
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && <ChatbotAvatar />}
        <div className={`relative group ${isUser ? 'ml-auto' : ''}`}>
          <div 
            className={`
              rounded-2xl p-4 shadow-sm animate-in fade-in duration-200
              ${isUser 
                ? 'rounded-tr-none' 
                : 'border rounded-tl-none'}
            `}
            style={{
              backgroundColor: isUser ? userBgColor : botBgColor,
              color: isUser ? userTextColor : botTextColor,
            }}
          >
            <div 
              className="prose prose-sm max-w-none text-[13px]"
              style={{ color: isUser ? userTextColor : botTextColor }}
              dangerouslySetInnerHTML={{ 
                __html: sanitizedHTML(message.content).replace(/<a /g, `<a target="_blank" rel="noopener noreferrer" `)
              }}
            />
            <div className="flex items-center justify-between mt-2 gap-4">
              {message.createdAt && (
                <div className="text-[10px] opacity-70">
                  {formatTime(message.createdAt)}
                </div>
              )}
              {!isUser && (
                <button
                  onClick={() => handleSpeak(messageId, message.content)}
                  className={`p-1.5 rounded-full transition-all duration-200 ${isThisMessageSpeaking ? 'bg-primary/20 text-primary scale-110' : 'hover:bg-primary/10 text-muted-foreground opacity-0 group-hover:opacity-100'}`}
                  title={isThisMessageSpeaking ? "Stop reading" : "Read message"}
                >
                  {isThisMessageSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LoadingState = ({ statusType, text = "Thinking", showSmallAvatar = false }: { statusType: 'submitted' | 'streaming'; text?: string; showSmallAvatar?: boolean }) => (
    <div className="flex items-center gap-3 animate-in fade-in">
      {showSmallAvatar ? <SmallChatbotAvatar /> : <ChatbotAvatar />}
      <div className="bg-card border rounded-2xl rounded-tl-none p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          {statusType === 'submitted' ? (
            <div className="flex items-center gap-2">
              <div className="flex space-x-1.5">
                {[0, 150, 300].map((delay, i) => (
                  <div 
                    key={delay} 
                    className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-primary/80 to-primary animate-bounce" 
                    style={{ 
                      animationDelay: `${delay}ms`,
                      animationDuration: '1s',
                      animationIterationCount: 'infinite'
                    }} 
                  />
                ))}
              </div>
              <p className="text-sm font-medium bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent animate-pulse">{text}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="absolute inset-0 h-4 w-4 animate-ping opacity-20">
                  <Loader2 className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium">{text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto bg-linear-to-b from-background to-muted/30 relative">
      <div className="p-4 space-y-6">
        {messages.map((message, index) => (
          <MessageBubble key={index} index={index} message={message} isUser={message.senderType === 'USER'} />
        ))}
        
        {showLeadForm && hasMultipleMessages && !hasSubmittedLead && !loading && (
          <div className="flex justify-center animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 max-w-md w-full">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">Ready to get started?</h4>
                  <p className="text-xs text-muted-foreground mb-3">Share your details and we'll help you get the best solution.</p>
                  <button 
                    onClick={showLeadForm} 
                    className="w-full py-2 px-4 rounded-lg hover:opacity-90 transition-colors text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
                    style={{
                      backgroundColor: theme?.inputButtonColor || "#DD692E",
                      color: "#ffffff"
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Get Started Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && status === 'submitted' && <LoadingState statusType="submitted" text="Thinking" />}
        {loading && status === 'streaming' && <LoadingState statusType="streaming" text="Searching..." showSmallAvatar />}
        
        {!hasUserMessages && quickQuestions.length > 0 && (
          <div className="mt-8 animate-in fade-in delay-300">
            <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Zap className="h-3 w-3" /> Quick suggestions
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => onQuickQuestion(question)}
                  disabled={loading}
                  className="group text-left p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    backgroundColor: quickSuggestionBg,
                    color: quickSuggestionText,
                  }}
                >
                  <span className="text-sm font-medium group-hover:opacity-80">{question}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>
  );
}

// ====================
// ChatInput — updated with mode toggle
// ====================

interface ChatInputProps {
  text: string;
  setText: (text: string) => void;
  loading: boolean;
  isMicrophoneOn: boolean;
  browserSupportsSpeechRecognition: boolean;
  onSubmit: (e?: React.FormEvent, overrideText?: string) => Promise<void>;
  onNewChat: () => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onToggleMicrophone: () => void;
  hasLeadForm?: boolean;
  onShowLeadForm?: () => void;
  isLoadingLeadConfig?: boolean;
  chatbot?: any;
}

function ChatInput({
  text,
  setText,
  loading,
  isMicrophoneOn,
  browserSupportsSpeechRecognition,
  onSubmit,
  onNewChat,
  status,
  inputRef,
  onToggleMicrophone,
  hasLeadForm,
  onShowLeadForm,
  isLoadingLeadConfig,
  chatbot,
}: ChatInputProps) {

  const theme = chatbot?.theme;
  const inputButtonColor = theme?.inputButtonColor || "#DD692E";

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(e);
  };

  return (
    <div className="border-t bg-background p-3">
      <PromptInput onSubmit={async (e: React.FormEvent) => { e.preventDefault(); await onSubmit(e); }}>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <PromptInputTextarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here..."
              disabled={loading || isMicrophoneOn}
              className="min-h-12 max-h-32 text-[13px]"
              rows={1}
            />
            <PromptInputToolbar>
              <PromptInputTools>

                {/* Lead Form Button */}
                {hasLeadForm && onShowLeadForm && !isLoadingLeadConfig && (
                  <PromptInputButton
                    size="sm"
                    variant="ghost"
                    onClick={onShowLeadForm}
                    title="Get started"
                    className="text-[11px] hover:opacity-80 cursor-pointer"
                    style={{ color: inputButtonColor }}
                    disabled={loading}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Get Started</span>
                  </PromptInputButton>
                )}

                {/* Microphone Button */}
                {browserSupportsSpeechRecognition && (
                  <PromptInputButton
                    size="sm"
                    variant="ghost"
                    onClick={onToggleMicrophone}
                    title={isMicrophoneOn ? "Stop voice input" : "Start voice input"}
                    className={`cursor-pointer ${isMicrophoneOn ? "bg-destructive/10 text-destructive" : ""}`}
                    disabled={loading}
                  >
                    {isMicrophoneOn ? (
                      <><MicOffIcon className="h-4 w-4" /><span className="hidden sm:inline">Listening...</span></>
                    ) : (
                      <><MicIcon className="h-4 w-4" /><span className="hidden sm:inline">Voice</span></>
                    )}
                  </PromptInputButton>
                )}

                {/* New Chat Button */}
                <PromptInputButton
                  size="sm"
                  variant="ghost"
                  onClick={onNewChat}
                  title="New chat"
                  className="text-[11px] hover:bg-primary/10 cursor-pointer"
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">New Chat</span>
                </PromptInputButton>
              </PromptInputTools>
            </PromptInputToolbar>
          </div>

          <PromptInputSubmit
            size="icon"
            disabled={(!text.trim() && !isMicrophoneOn) || loading}
            status={status}
            className="h-12 w-12 rounded-xl cursor-pointer"
            style={{ backgroundColor: inputButtonColor, color: '#ffffff' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </PromptInputSubmit>
        </div>
      </PromptInput>

      {isLoadingLeadConfig && (
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading form configuration...
        </div>
      )}
    </div>
  );
}