"use client";
import DOMPurify from 'dompurify';
import { useState, useRef, useEffect } from "react";

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RefreshCw, Monitor, Smartphone, Send, Loader2, Lightbulb } from "lucide-react"
import { Chatbot, ShapeType, BorderType } from "../../../generated/prisma/browser";

interface Message {
  role: "user" | "assistant"
  content: string
}

interface ChatProps {
  id: string
  name?: string
  greeting?: string
  directive?: string
  initialMessages?: Message[]
  onSendMessage?: (message: string, messages: Message[]) => Promise<string | void>
  showPreviewControls?: boolean
  
  // New props for suggestions
  suggestions?: string[]
  
  // Theme object prop
  theme?: any
  
  // Legacy theme props that can override database values
  avatar?: string | null
  icon?: string | null
  iconShape?: string
  iconSize?: number
  iconColor?: string
  iconBorder?: string
  iconBgColor?: string
  avatarSize?: number
  avatarColor?: string
  avatarBorder?: string
  avatarBgColor?: string
  color?: string
  borderRadius?: string
  autoOpenChat?: boolean
  autoGreeting?: boolean
  
  // Optional: If you want to disable database fetching
  useDbConfig?: boolean
}

const sanitizedHTML = (html: string) => DOMPurify.sanitize(html);

export default function ChatPreview({
  id,
  name: propName,
  greeting: propGreeting,
  directive: propDirective,
  initialMessages = [],
  onSendMessage,
  showPreviewControls = false,
  
  // New suggestions prop
  suggestions: propSuggestions = [],
  
  // Theme object prop
  theme: propTheme,
  
  // Legacy theme props with default values
  avatar: propAvatar,
  icon: propIcon,
  iconShape: propIconShape,
  iconSize: propIconSize,
  iconColor: propIconColor,
  iconBorder: propIconBorder,
  iconBgColor: propIconBgColor,
  avatarSize: propAvatarSize,
  avatarColor: propAvatarColor,
  avatarBorder: propAvatarBorder,
  avatarBgColor: propAvatarBgColor,
  color: propColor,
  borderRadius: propBorderRadius,
  autoOpenChat: propAutoOpenChat,
  autoGreeting: propAutoGreeting,
  
  // Database config
  useDbConfig = true,
}: ChatProps) {
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(useDbConfig);
  const [message, setMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [liveTheme, setLiveTheme] = useState<any>(null)
  
  // Colors mapping for default colors
  const colorMap: Record<string, string> = {
    blue: "#3b82f6",
    black: "#000000",
    purple: "#a855f7",
    green: "#16a34a",
    red: "#dc2626",
    orange: "#ea580c",
  }
  
  // Get effective values (props override database)
  const name = propName || chatbot?.name || "Chatbot";
  const greeting = propGreeting || chatbot?.greeting || "How can I help you today?";
  const directive = propDirective || chatbot?.directive || "You are a helpful assistant.";
  const avatar = propAvatar ?? chatbot?.avatar ?? null;
  const icon = propIcon ?? chatbot?.icon ?? null;
  const iconSize = propIconSize || chatbot?.iconSize || 50;
  const iconColor = propIconColor || chatbot?.iconColor || "blue";
  const iconShape = propIconShape || getShapeTypeValue(chatbot?.iconShape) || "circle";
  const iconBorder = propIconBorder || getBorderTypeValue(chatbot?.iconBorder) || "flat";
  const iconBgColor = propIconBgColor || chatbot?.iconBgColor || undefined;
  const avatarSize = propAvatarSize || chatbot?.avatarSize || 50;
  const avatarColor = propAvatarColor || chatbot?.avatarColor || "blue";
  const avatarBorder = propAvatarBorder || getBorderTypeValue(chatbot?.avatarBorder) || "flat";
  const avatarBgColor = propAvatarBgColor || chatbot?.avatarBgColor || undefined;
  const color = propColor || iconColor || avatarColor || "blue";
  const borderRadius = propBorderRadius || getBorderRadiusFromBorderType(iconBorder) || "regular";
  const autoOpenChat = propAutoOpenChat ?? chatbot?.popup_onload ?? false;
  const autoGreeting = propAutoGreeting || false;
  
  // Get theme colors from theme object (prioritize liveTheme for live updates)
  const themeColors = liveTheme || propTheme || chatbot?.theme || {};
  const headerBgColor = themeColors.headerBgColor || "#1320AA";
  const headerTextColor = themeColors.headerTextColor || "#ffffff";
  const botMessageBgColor = themeColors.botMessageBgColor || "#f1f5f9";
  const botMessageTextColor = themeColors.botMessageTextColor || "#0f172a";
  const userMessageBgColor = themeColors.userMessageBgColor || "#1320AA";
  const userMessageTextColor = themeColors.userMessageTextColor || "#ffffff";
  const closeButtonBgColor = themeColors.closeButtonBgColor || "#DD692E";
  const closeButtonColor = themeColors.closeButtonColor || "#000000";
  const quickSuggestionBgColor = themeColors.quickSuggestionBgColor || "#ffffff";
  const quickSuggestionTextColor = themeColors.quickSuggestionTextColor || "#0f172a";
  
  // Get widget size from live theme
  const widgetSize = themeColors.widgetSize || 70;
  const widgetSizeMobile = themeColors.widgetSizeMobile || 60;
  
  // Get suggestions (props override database)
  const suggestions = propSuggestions.length > 0 ? propSuggestions : (chatbot?.suggestions as string[] || []);

  // Helper function to convert ShapeType to string
  function getShapeTypeValue(shape: ShapeType | null | undefined): string {
    if (!shape) return "circle";
    switch (shape) {
      case ShapeType.ROUND: return "circle";
      case ShapeType.SQUARE: return "square";
      case ShapeType.ROUNDED_SQUARE: return "rounded";
      default: return "circle";
    }
  }

  // Helper function to convert BorderType to string
  function getBorderTypeValue(border: BorderType | null | undefined): string {
    if (!border) return "flat";
    switch (border) {
      case BorderType.FLAT: return "flat";
      case BorderType.ROUND: return "rounded";
      case BorderType.ROUNDED_FLAT: return "very-rounded";
      default: return "flat";
    }
  }

  // Helper function to convert BorderType to borderRadius
  function getBorderRadiusFromBorderType(borderType: string): string {
    switch (borderType) {
      case "flat": return "regular";
      case "rounded": return "rounded";
      case "very-rounded": return "very-rounded";
      default: return "regular";
    }
  }
  
  // Get color value from name or hex code
  const getColorValue = (colorName?: string) => {
    const col = colorName || color;
    return colorMap[col] || col || colorMap.blue;
  }
  
  // Get border radius value
  const getBorderRadiusValue = (borderRadiusType?: string) => {
    const br = borderRadiusType || borderRadius;
    switch (br) {
      case "regular": return "0.375rem";
      case "rounded": return "0.75rem";
      case "very-rounded": return "1.5rem";
      default: return "0.375rem";
    }
  }
  
  // Get shape class
  const getShapeClass = (shape?: string, borderType?: string) => {
    const shp = shape || iconShape;
    const border = borderType || iconBorder;
    
    // If border type is flat, use simpler shapes
    if (border === "flat") {
      switch (shp) {
        case "circle": return "rounded-full";
        case "square": return "rounded-none";
        case "rounded": return "rounded-lg";
        default: return "rounded-full";
      }
    }
    
    // For rounded borders, always use rounded styles
    switch (border) {
      case "rounded": return "rounded-full";
      case "very-rounded": return "rounded-3xl";
      default: return "rounded-lg";
    }
  }
  
  // Calculate dimensions
  const getDimensions = (size?: number) => {
    const baseSize = size || iconSize;
    return Math.max(30, Math.min(100, baseSize)); // Clamp between 30-100px
  }

  // Fetch chatbot data from database
  useEffect(() => {
    if (!useDbConfig) {
      setIsLoadingChatbot(false);
      return;
    }

    fetch(`/api/chatbots/${id}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setChatbot(data);
        setIsLoadingChatbot(false);
      })
      .catch(err => {
        console.error("Error fetching chatbot data:", err);
        setIsLoadingChatbot(false);
      });
  }, [id, useDbConfig]);

  // Listen for live theme updates from parent
  useEffect(() => {
    if (propTheme) {
      setLiveTheme(propTheme);
    }
  }, [propTheme]);

  // Initialize messages with greeting
  useEffect(() => {
    if (greeting && messages.length === 0) {
      setMessages([{ role: "assistant", content: greeting }]);
      setShowSuggestions(true);
    }
  }, [greeting, messages.length]);

  // Auto greeting on mount if enabled
  useEffect(() => {
    if (autoGreeting && greeting && messages.length === 0) {
      setMessages([{ role: "assistant", content: greeting }]);
      setShowSuggestions(true);
    }
  }, [autoGreeting, greeting, messages.length]);

  useEffect(() => {
    scrollToBottom()
  }, [])

  // Auto open chat if enabled (simulated by focusing input)
  useEffect(() => {
    if (autoOpenChat && !showPreviewControls) {
      const input = document.querySelector('input[placeholder="Ask me anything"]') as HTMLInputElement;
      if (input) {
        setTimeout(() => input.focus(), 500);
      }
    }
  }, [autoOpenChat, showPreviewControls])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || message.trim();
    if (!textToSend || isLoading) return

    // Clear the input if using the regular input field
    if (!messageText) {
      setMessage("")
    }
    
    // Hide suggestions when user sends a message
    setShowSuggestions(false);
    
    // Add user message to chat
    const newMessages: Message[] = [...messages, { role: "user", content: textToSend }]
    setMessages(newMessages)
    
    setIsLoading(true)

    try {
      if (onSendMessage) {
        // Use custom message handler if provided
        const response = await onSendMessage(textToSend, newMessages.slice(0, -1))
        if (response) {
          setMessages(prev => [...prev, { 
            role: "assistant", 
            content: response
          }])
        }
      } else {
        // Default behavior - call API with directive
        const res = await fetch(`/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: textToSend,
            prompt: directive,
            messages: newMessages.slice(0, -1),
            chatbotId: id,
          }),
        })

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }

        const data = await res.json()
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.message || "I'm sorry, I couldn't process that request." 
        }])
      }
      
    } catch (error) {
      console.error("Error while sending message:", error)
      
      // Add error message to chat
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  }

  const handleRestartChat = () => {
    setMessages([{ role: "assistant", content: greeting }]);
    setShowSuggestions(true);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Render avatar/icon component
  const renderAvatarIcon = ({
    type = "icon",
    size,
    shape,
    border,
    bgColor,
    colorValue,
  }: {
    type?: "avatar" | "icon";
    size?: number;
    shape?: string;
    border?: string;
    bgColor?: string;
    colorValue: string;
  }) => {
    const dim = getDimensions(size);
    const shapeClass = getShapeClass(shape, border);
    const imageSrc = type === "avatar" ? avatar : icon;
    
    return (
      <div 
        className={`shrink-0 overflow-hidden flex items-center justify-center border border-border`}
        style={{
          width: `${dim}px`,
          height: `${dim}px`,
          backgroundColor: bgColor || colorValue,
        }}
      >
        {imageSrc ? (
          <img 
            src={imageSrc} 
            alt={`${name} ${type}`} 
            className={`w-full h-full object-cover ${shapeClass}`}
          />
        ) : (
          <div 
            className={`w-full h-full flex items-center justify-center ${shapeClass}`}
            style={{ backgroundColor: colorValue }}
          >
            <span className="text-white font-bold text-lg">
              {name?.charAt(0) || "C"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Show loading skeleton while fetching chatbot data
  if (isLoadingChatbot && useDbConfig) {
    return (
      <div className="h-full max-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Loading chatbot...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Preview Header */}
      {showPreviewControls && (
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Preview</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-sm"
              onClick={handleRestartChat}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart Chat
            </Button>
            <Button variant="ghost" size="icon" className="w-9 h-9">
              <Monitor className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-9 h-9">
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div 
        ref={chatAreaRef}
        className="flex-1 overflow-y-auto no-scrollbar p-6 bg-background"
      >
        {/* Greeting/Initial Message */}
        {messages.length > 0 && (
          <div className="mb-4">
            {showPreviewControls && (
              <p className="text-xs text-muted-foreground mb-3">{name}</p>
            )}
            <div className="flex gap-3">
              {renderAvatarIcon({
                type: "icon",
                size: avatar ? avatarSize : iconSize,
                shape: avatar ? getShapeTypeValue(chatbot?.iconShape) : iconShape,
                border: avatar ? avatarBorder : iconBorder,
                bgColor: avatar ? avatarBgColor : iconBgColor,
                colorValue: getColorValue(avatar ? avatarColor : iconColor),
              })}
              
              <Card 
                className="p-4 max-w-md border"
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

        {/* Suggestions Section - Only show when chat is new/restarted */}
        {showSuggestions && suggestions.length > 0 && messages.length === 1 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">Quick suggestions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
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
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Display all messages (except first greeting message) */}
        {messages.slice(1).map((msg, index) => (
          <div 
            key={index} 
            className={`mb-4 ${msg.role === "user" ? "flex justify-end" : "flex gap-3"}`}
          >
            {msg.role === "assistant" && (
              renderAvatarIcon({
                type: avatar ? "avatar" : "icon",
                size: avatar ? avatarSize : iconSize,
                shape: avatar ? getShapeTypeValue(chatbot?.iconShape) : iconShape,
                border: avatar ? avatarBorder : iconBorder,
                bgColor: avatar ? avatarBgColor : iconBgColor,
                colorValue: getColorValue(avatar ? avatarColor : iconColor),
              })
            )}
            <Card 
              className="p-4 max-w-md border"
              style={{ 
                borderRadius: getBorderRadiusValue(),
                backgroundColor: msg.role === "user" ? userMessageBgColor : botMessageBgColor,
                color: msg.role === "user" ? userMessageTextColor : botMessageTextColor,
              }}
            >
              <div className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: sanitizedHTML(msg.content).replace(/<a /g, `<a target="_blank" rel="noopener noreferrer" `)
                }}
              />
            </Card>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="mb-4 flex gap-3">
            {renderAvatarIcon({
              type: avatar ? "avatar" : "icon",
              size: avatar ? avatarSize : iconSize,
              shape: avatar ? getShapeTypeValue(chatbot?.iconShape) : iconShape,
              border: avatar ? avatarBorder : iconBorder,
              bgColor: avatar ? avatarBgColor : iconBgColor,
              colorValue: getColorValue(avatar ? avatarColor : iconColor),
            })}
            <Card 
              className="p-4 max-w-md border"
              style={{ 
                borderRadius: getBorderRadiusValue(),
                backgroundColor: botMessageBgColor,
                color: botMessageTextColor,
              }}
            >
              <div className="flex items-center space-x-3">
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
                <p className="text-sm font-medium bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent animate-pulse">Thinking...</p>
              </div>
            </Card>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-6 border-t bg-background">
        <div className="flex items-center gap-3">
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
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}