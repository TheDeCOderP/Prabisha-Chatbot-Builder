"use client";

import DOMPurify from 'dompurify';

import { useState, useRef, useEffect } from "react";

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RefreshCw, Monitor, Smartphone, Send, Loader2, Lightbulb } from "lucide-react"
import { MultilingualSuggestion, getLocalizedText } from "@/providers/chatbot-provider";

interface Message {
  role: "user" | "assistant"
  content: string
}

interface ChatProps {
  id: string
  name?: string
  // greeting accepts multilingual object, legacy string, or undefined
  greeting?: MultilingualSuggestion | string
  directive?: string
  initialMessages?: Message[]
  onSendMessage?: (message: string, messages: Message[]) => Promise<string | void>
  showPreviewControls?: boolean

  // Suggestions — accepts legacy string[] or new multilingual object[]
  suggestions?: MultilingualSuggestion[]

  // Theme object — all visual styling lives here
  theme?: any

  // Simple image overrides (no size/shape/border — those come from theme)
  avatar?: string | null
  icon?: string | null

  autoOpenChat?: boolean
  autoGreeting?: boolean

  // Optional: disable database fetching
  useDbConfig?: boolean
}

const sanitizedHTML = (html: string) => DOMPurify.sanitize(html);

// ─── Phone dimensions (natural / unscaled) ────────────────────────────────
const PHONE_W = 375;
const PHONE_H = 667;

// ─── Localisation helpers ─────────────────────────────────────────────────

const getBrowserLang = (): string =>
  typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en'

const resolveGreeting = (
  value: MultilingualSuggestion | string | undefined | null,
  lang: string
): string => {
  if (!value) return 'How can I help you today?'
  if (typeof value === 'string') return value

  return (
    (value as MultilingualSuggestion)[lang]?.trim() ||
    (value as MultilingualSuggestion)['en']?.trim() ||
    Object.values(value as MultilingualSuggestion).find(v => v?.trim()) ||
    'How can I help you today?'
  )
}

const resolveLocalizedSuggestion = (
  suggestion: string | MultilingualSuggestion,
  lang: string
): string => {
  if (typeof suggestion === 'string') return suggestion
  return (
    suggestion[lang] ||
    suggestion['en'] ||
    Object.values(suggestion).find(v => typeof v === 'string' && v.trim()) ||
    ''
  )
}

const normaliseDbGreeting = (
  raw: any
): MultilingualSuggestion | string | null => {
  if (!raw) return null
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null
    const first = raw[0]
    if (typeof first === 'object' && first !== null) return first as MultilingualSuggestion
    if (typeof first === 'string') return first
    return null
  }
  if (typeof raw === 'object') return raw as MultilingualSuggestion
  if (typeof raw === 'string') return raw
  return null
}

export default function ChatPreview({
  id,
  name: propName,
  greeting: propGreeting,
  directive: propDirective,
  initialMessages = [],
  onSendMessage,
  showPreviewControls = false,
  suggestions: propSuggestions = [],
  theme: propTheme,
  avatar: propAvatar,
  icon: propIcon,
  autoOpenChat: propAutoOpenChat,
  autoGreeting: propAutoGreeting,
  useDbConfig = true,
}: ChatProps) {
  const [chatbot, setChatbot] = useState<any | null>(null);
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(useDbConfig);
  const [message, setMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [liveTheme, setLiveTheme] = useState<any>(null)
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")

  const phoneWrapRef = useRef<HTMLDivElement>(null);

  const userLang = getBrowserLang()

  useEffect(() => {
    if (previewMode !== "mobile") return;

    const el = phoneWrapRef.current;
    if (!el) return;

    const applyScale = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const availW = parent.clientWidth - 32;
      const availH = parent.clientHeight - 32;
      const scale = Math.min(availW / PHONE_W, availH / PHONE_H, 1);
      el.style.transform = `scale(${scale})`;
      const shrinkX = (PHONE_W * scale - PHONE_W) / 2;
      const shrinkY = (PHONE_H * scale - PHONE_H) / 2;
      el.style.margin = `${shrinkY}px ${shrinkX}px`;
    };

    applyScale();
    const ro = new ResizeObserver(applyScale);
    const parent = el.parentElement;
    if (parent) ro.observe(parent);

    return () => {
      ro.disconnect();
      if (el) { el.style.transform = ""; el.style.margin = ""; }
    };
  }, [previewMode]);

  // ─── Resolved config values ───────────────────────────────────────────────

  const name        = propName      || chatbot?.name      || "Chatbot";
  const directive   = propDirective || chatbot?.directive || "You are a helpful assistant.";
  const avatar      = propAvatar    ?? chatbot?.avatar    ?? null;
  const icon        = propIcon      ?? chatbot?.icon      ?? null;
  const autoOpenChat = propAutoOpenChat ?? chatbot?.popup_onload ?? chatbot?.theme?.popup_onload ?? false;
  const autoGreeting = propAutoGreeting || false;

  // ─── Resolve greeting ─────────────────────────────────────────────────────

  const rawGreeting: MultilingualSuggestion | string | null =
    propGreeting
      ? propGreeting
      : normaliseDbGreeting((chatbot as any)?.greeting)

  const greetingText: string = resolveGreeting(rawGreeting, userLang)

  // ─── Normalise suggestions ────────────────────────────────────────────────

  const suggestions: MultilingualSuggestion[] =
    propSuggestions.length > 0
      ? propSuggestions
      : ((chatbot?.suggestions as MultilingualSuggestion[]) || [])

  // ─── Theme colours (all visual styling from theme) ────────────────────────

  const themeColors             = liveTheme || propTheme || chatbot?.theme || {};
  const headerBgColor           = themeColors.headerBgColor           || "#1320AA";
  const headerTextColor         = themeColors.headerTextColor         || "#ffffff";
  const botMessageBgColor       = themeColors.botMessageBgColor       || "#f1f5f9";
  const botMessageTextColor     = themeColors.botMessageTextColor     || "#0f172a";
  const userMessageBgColor      = themeColors.userMessageBgColor      || "#1320AA";
  const userMessageTextColor    = themeColors.userMessageTextColor    || "#ffffff";
  const quickSuggestionBgColor  = themeColors.quickSuggestionBgColor  || "#ffffff";
  const quickSuggestionTextColor= themeColors.quickSuggestionTextColor|| "#0f172a";
  const widgetBgColor           = themeColors.widgetBgColor           || "#ffffff";
  const widgetColor             = themeColors.widgetColor             || "#1320AA";
  const widgetSize              = themeColors.widgetSize              || 70;
  const widgetSizeMobile        = themeColors.widgetSizeMobile        || 60;

  // Border radius — derived from theme widgetBorder or sensible default
  const getBorderRadiusValue = (): string => {
    const border = themeColors.widgetBorder?.toLowerCase() || '';
    switch (border) {
      case 'flat':         return '0.375rem';
      case 'rounded':      return '0.75rem';
      case 'very-rounded': return '1.5rem';
      default:             return '0.375rem';
    }
  };

  // Widget/icon shape — derived from theme widgetShape
  const getWidgetShapeClass = (): string => {
    const shape = themeColors.widgetShape?.toLowerCase() || 'circle';
    switch (shape) {
      case 'circle':  return 'rounded-full';
      case 'square':  return 'rounded-none';
      case 'rounded': return 'rounded-lg';
      default:        return 'rounded-full';
    }
  };

  // ─── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!useDbConfig) { setIsLoadingChatbot(false); return; }

    fetch(`/api/chatbots/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => { setChatbot(data); setIsLoadingChatbot(false); })
      .catch(err => { console.error("Error fetching chatbot data:", err); setIsLoadingChatbot(false); });
  }, [id, useDbConfig]);

  useEffect(() => {
    if (propTheme) setLiveTheme(propTheme);
  }, [propTheme]);

  useEffect(() => {
    if (greetingText && messages.length === 0) {
      setMessages([{ role: "assistant", content: greetingText }]);
      setShowSuggestions(true);
    }
  }, [greetingText, messages.length]);

  useEffect(() => {
    if (autoGreeting && greetingText && messages.length === 0) {
      setMessages([{ role: "assistant", content: greetingText }]);
      setShowSuggestions(true);
    }
  }, [autoGreeting, greetingText, messages.length]);

  useEffect(() => { scrollToBottom() }, [])

  useEffect(() => {
    if (autoOpenChat && !showPreviewControls) {
      const input = document.querySelector('input[placeholder="Ask me anything"]') as HTMLInputElement;
      if (input) setTimeout(() => input.focus(), 500);
    }
  }, [autoOpenChat, showPreviewControls])

  useEffect(() => { scrollToBottom() }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // ─── Message handlers ─────────────────────────────────────────────────────

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || message.trim();
    if (!textToSend || isLoading) return

    if (!messageText) setMessage("")
    setShowSuggestions(false);

    const newMessages: Message[] = [...messages, { role: "user", content: textToSend }]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      if (onSendMessage) {
        const response = await onSendMessage(textToSend, newMessages.slice(0, -1))
        if (response) {
          setMessages(prev => [...prev, { role: "assistant", content: response }])
        }
      } else {
        const res = await fetch(`/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: textToSend,
            prompt: directive,
            messages: newMessages.slice(0, -1),
            chatbotId: id,
          }),
        })

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const data = await res.json()
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message || "I'm sorry, I couldn't process that request."
        }])
      }
    } catch (error) {
      console.error("Error while sending message:", error)
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (text: string) => handleSendMessage(text)

  const handleRestartChat = () => {
    setMessages([{ role: "assistant", content: greetingText }]);
    setShowSuggestions(true);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage() }
  }

  // ─── Avatar / icon renderer ───────────────────────────────────────────────
  // Size and shape now come entirely from theme

  const renderAvatarIcon = () => {
    const imageSrc = avatar || icon;
    const size = themeColors.widgetSize || 50;
    const shapeClass = getWidgetShapeClass();
    const bgColor = themeColors.widgetBgColor || widgetColor;

    return (
      <div
        className={`shrink-0 overflow-hidden flex items-center justify-center border border-border ${shapeClass}`}
        style={{ width: `${size}px`, height: `${size}px`, backgroundColor: bgColor }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={`${name} icon`} className={`w-full h-full object-cover ${shapeClass}`} />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${shapeClass}`}
            style={{ backgroundColor: widgetColor }}
          >
            <span className="text-white font-bold text-lg">{name?.charAt(0) || "C"}</span>
          </div>
        )}
      </div>
    );
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoadingChatbot && useDbConfig) {
    return (
      <div className="h-full flex flex-col">
        {showPreviewControls && (
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
              <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 bg-background space-y-4">
          <div className="flex gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-3 mt-6">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="flex flex-wrap gap-2">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-36 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="p-6 border-t bg-background">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Shared chat content ──────────────────────────────────────────────────

  const chatContent = (
    <div className="h-full flex flex-col">
      <div ref={chatAreaRef} className="flex-1 overflow-y-auto no-scrollbar p-4 bg-background">

        {/* First greeting message */}
        {messages.length > 0 && (
          <div className="mb-4">
            {showPreviewControls && previewMode === "desktop" && (
              <p className="text-xs text-muted-foreground mb-3">{name}</p>
            )}
            <div className="flex gap-3">
              {renderAvatarIcon()}
              <Card
                className="p-3 max-w-[80%] border"
                style={{
                  borderRadius: getBorderRadiusValue(),
                  backgroundColor: botMessageBgColor,
                  color: botMessageTextColor,
                }}
              >
                <p className="text-sm">{messages[0]?.content}</p>
              </Card>
            </div>
          </div>
        )}

        {/* Quick suggestions */}
        {showSuggestions && suggestions.length > 0 && messages.length === 1 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">Quick suggestions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => {
                const text = resolveLocalizedSuggestion(suggestion, userLang)
                if (!text) return null
                return (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 px-3 whitespace-normal text-left hover:opacity-80 cursor-pointer"
                    style={{
                      borderRadius: getBorderRadiusValue(),
                      backgroundColor: quickSuggestionBgColor,
                      color: quickSuggestionTextColor,
                      borderColor: quickSuggestionTextColor + '20',
                    }}
                    onClick={() => handleSuggestionClick(text)}
                    disabled={isLoading}
                  >
                    {text}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Remaining messages (skip the first greeting) */}
        {messages.slice(1).map((msg, index) => (
          <div
            key={index}
            className={`mb-4 ${msg.role === "user" ? "flex justify-end" : "flex gap-3"}`}
          >
            {msg.role === "assistant" && renderAvatarIcon()}
            <Card
              className="p-3 max-w-[80%] border"
              style={{
                borderRadius: getBorderRadiusValue(),
                backgroundColor: msg.role === "user" ? userMessageBgColor : botMessageBgColor,
                color: msg.role === "user" ? userMessageTextColor : botMessageTextColor,
              }}
            >
              <div
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: sanitizedHTML(msg.content).replace(
                    /<a /g,
                    `<a target="_blank" rel="noopener noreferrer" `
                  )
                }}
              />
            </Card>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="mb-4 flex gap-3">
            {renderAvatarIcon()}
            <Card
              className="p-3 max-w-[80%] border"
              style={{
                borderRadius: getBorderRadiusValue(),
                backgroundColor: botMessageBgColor,
                color: botMessageTextColor,
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1.5">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-primary/80 to-primary animate-bounce"
                      style={{ animationDelay: `${delay}ms`, animationDuration: '1s', animationIterationCount: 'infinite' }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent animate-pulse">
                  Thinking...
                </p>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="p-3 border-t bg-background">
        <div className="flex items-center gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything"
            className="flex-1 bg-card"
            style={{ borderRadius: getBorderRadiusValue() }}
            disabled={isLoading || isLoadingChatbot}
          />
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !message.trim() || isLoadingChatbot}
            style={{ borderRadius: getBorderRadiusValue() }}
          >
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Send className="w-5 h-5" />
            }
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Root render ──────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Preview controls */}
      {showPreviewControls && (
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Preview</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-sm" onClick={handleRestartChat}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart Chat
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`w-9 h-9 ${previewMode === "desktop" ? "bg-accent text-accent-foreground" : ""}`}
              onClick={() => setPreviewMode("desktop")}
              title="Desktop view"
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`w-9 h-9 ${previewMode === "mobile" ? "bg-accent text-accent-foreground" : ""}`}
              onClick={() => setPreviewMode("mobile")}
              title="Mobile view"
            >
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Desktop */}
      {previewMode === "desktop" || !showPreviewControls ? (
        <div className="flex-1 overflow-hidden">{chatContent}</div>
      ) : (
        /* Mobile phone frame */
        <div className="flex-1 flex items-center justify-center bg-muted/30 overflow-hidden">
          <div
            ref={phoneWrapRef}
            style={{ width: `${PHONE_W}px`, height: `${PHONE_H}px`, transformOrigin: "center center", flexShrink: 0 }}
          >
            <div
              className="relative flex flex-col"
              style={{
                width: `${PHONE_W}px`, height: `${PHONE_H}px`,
                borderRadius: "44px", background: "#1a1a1a", padding: "12px",
                boxShadow: "0 0 0 1px #333, 0 25px 60px rgba(0,0,0,0.5), inset 0 0 0 2px #444",
              }}
            >
              {/* Buttons */}
              <div className="absolute" style={{ left: "-3px", top: "100px", width: "3px", height: "32px", background: "#333", borderRadius: "2px 0 0 2px" }} />
              <div className="absolute" style={{ left: "-3px", top: "144px", width: "3px", height: "32px", background: "#333", borderRadius: "2px 0 0 2px" }} />
              <div className="absolute" style={{ right: "-3px", top: "130px", width: "3px", height: "60px", background: "#333", borderRadius: "0 2px 2px 0" }} />

              {/* Screen */}
              <div className="flex-1 flex flex-col overflow-hidden bg-background" style={{ borderRadius: "34px" }}>
                {/* Status bar */}
                <div
                  className="shrink-0 flex items-center justify-between px-6 pt-2 pb-1"
                  style={{ background: headerBgColor }}
                >
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ top: "20px", width: "120px", height: "34px", background: "#1a1a1a", borderRadius: "20px", zIndex: 10 }}
                  />
                  <span className="text-xs font-semibold" style={{ color: headerTextColor }}>9:41</span>
                  <div className="flex items-center gap-1.5">
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <rect x="0"    y="6" width="3"   height="6"  rx="1" fill={headerTextColor} fillOpacity="0.5" />
                      <rect x="4.5"  y="4" width="3"   height="8"  rx="1" fill={headerTextColor} fillOpacity="0.7" />
                      <rect x="9"    y="2" width="3"   height="10" rx="1" fill={headerTextColor} fillOpacity="0.9" />
                      <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill={headerTextColor} />
                    </svg>
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <path d="M8 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill={headerTextColor} />
                      <path d="M4.5 7C5.8 5.7 6.8 5 8 5s2.2.7 3.5 2" stroke={headerTextColor} strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M2 4.5C3.8 2.6 5.7 1.5 8 1.5s4.2 1.1 6 3" stroke={headerTextColor} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
                      <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke={headerTextColor} strokeOpacity="0.35" />
                      <rect x="2"   y="2"   width="15" height="8"  rx="2"   fill={headerTextColor} />
                      <path d="M23 4v4a2 2 0 000-4z" fill={headerTextColor} fillOpacity="0.4" />
                    </svg>
                  </div>
                </div>

                {/* Chat header */}
                <div
                  className="shrink-0 flex items-center gap-3 px-4 py-3"
                  style={{ background: headerBgColor, paddingTop: "16px" }}
                >
                  <div
                    className="shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: widgetColor }}
                  >
                    {(icon || avatar)
                      ? <img src={icon || avatar!} alt={name} className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-sm">{name?.charAt(0) || "C"}</span>
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none" style={{ color: headerTextColor }}>{name}</p>
                    <p className="text-xs mt-0.5 opacity-70" style={{ color: headerTextColor }}>Online</p>
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 overflow-hidden">{chatContent}</div>

                {/* Home indicator */}
                <div className="shrink-0 flex justify-center pb-2 pt-1 bg-background">
                  <div style={{ width: "120px", height: "4px", background: "#333", borderRadius: "2px", opacity: 0.3 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}