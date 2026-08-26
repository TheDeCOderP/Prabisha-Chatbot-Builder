"use client";

import { useRef, useState, useEffect } from "react";
import { 
  Monitor, 
  Smartphone, 
  RefreshCw, 
  MessageCircle, 
  X, 
  AlignJustify, 
  PanelRight, 
  Layers, 
  Bell, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Headset,
  MicOff
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatIframePreviewProps {
  chatbotId: string;
}

type EmbedMode = "FLOATING_BUTTON" | "INLINE" | "STICKY_BAR" | "TEASER_BUBBLE" | "SLIDE_DRAWER";

export default function ChatIframePreview({ chatbotId }: ChatIframePreviewProps) {
  const desktopRef = useRef<HTMLIFrameElement>(null);
  const mobileRef  = useRef<HTMLIFrameElement>(null);
  
  // States
  const [isMounted, setIsMounted]     = useState(false);
  const [mode, setMode]               = useState<"desktop" | "mobile">("desktop");
  const [key, setKey]                 = useState(0);
  const [isOpen, setIsOpen]           = useState(false);
  const [theme, setTheme]             = useState<any>(null);
  const [iconSrc, setIconSrc]         = useState<string | null>(null);
  const [botName, setBotName]         = useState<string>("Assistant");
  const [zoom, setZoom]               = useState(1);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);

  // 1. Fetch Chatbot Data
  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}`)
      .then(r => r.json())
      .then(data => {
        setTheme(data?.theme || null);
        setIconSrc(data?.icon || data?.avatar || null);
        if (data?.name) setBotName(data.name);
      })
      .catch(() => {});
  }, [chatbotId]);

  // 2. Load Saved User Preferences from Local Storage (Hydration Safe)
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedMode = localStorage.getItem(`preview_mode_${chatbotId}`);
      if (savedMode === "mobile" || savedMode === "desktop") setMode(savedMode);
      
      const savedZoom = localStorage.getItem(`preview_zoom_${chatbotId}`);
      if (savedZoom) setZoom(parseFloat(savedZoom));
      
      const savedMic = localStorage.getItem(`preview_handsfree_${chatbotId}`);
      if (savedMic === "true") setIsHandsFree(true);
    } catch (e) {
      console.warn("Failed to load local settings", e);
    }
  }, [chatbotId]);

  // 3. Save User Preferences automatically on change
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(`preview_mode_${chatbotId}`, mode);
      localStorage.setItem(`preview_zoom_${chatbotId}`, zoom.toString());
      localStorage.setItem(`preview_handsfree_${chatbotId}`, isHandsFree.toString());
    } catch (e) {
      console.warn("Failed to save local settings", e);
    }
  }, [mode, zoom, isHandsFree, isMounted, chatbotId]);

  // 4. Handle Iframe Messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "chatbot-close") { setIsOpen(false); return; }
      if (e.data?.type === "tts-playing") { setIsBotSpeaking(e.data.isPlaying); return; }
      if (e.data?.type === "theme-update") {
        if (e.data.theme) setTheme((prev: any) => ({ ...prev, ...e.data.theme }));
        const target = mode === "desktop" ? desktopRef.current : mobileRef.current;
        target?.contentWindow?.postMessage(e.data, "*");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [mode]);

  // 5. Privacy-First Hands-Free Voice Activation Loop
  useEffect(() => {
    // If Hands Free is off OR the bot is currently talking, completely turn off the mic!
    if (!isHandsFree || isBotSpeaking) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      setIsHandsFree(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let silenceTimer: NodeJS.Timeout;

    recognition.onresult = (e: any) => {
      let interim = "";
      let final = "";

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }

      const currentText = (final || interim).toLowerCase().trim();
      if (!currentText) return;

      const nameMatch = botName.toLowerCase();
      const target = mode === "desktop" ? desktopRef.current : mobileRef.current;

      const closePhrases = ["close chat", "close widget", "close assistant", `close ${nameMatch}`, "hide chat", "exit chat"];
      const isCloseCommand = closePhrases.some(p => currentText.includes(p));

      // Behavior A: Chat is Closed -> Listen for Wake Word ONLY to OPEN
      if (!isOpen) {
        const wakeWords = [nameMatch, "hello", "hey", "open chat", "open widget"];
        const detectedWakeWord = wakeWords.find(w => currentText.includes(w));
        
        if (detectedWakeWord) {
          setIsOpen(true);
          recognition.stop(); 
        }
      } 
      // Behavior B: Chat is Open -> Hands Free Mode (Auto Submit / Close)
      else {
        target?.contentWindow?.postMessage({ type: "voice-interim", transcript: currentText }, "*");
        
        if (isCloseCommand) {
          setIsOpen(false);
          target?.contentWindow?.postMessage({ type: "voice-interim", transcript: "" }, "*");
          recognition.stop();
          return;
        }

        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          target?.contentWindow?.postMessage({ type: "voice-activation", transcript: currentText }, "*");
          recognition.stop();
        }, 2000); // 2 second pause for hands-free auto submit
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) recognition.stop();
      else if (isHandsFree && !isBotSpeaking) { try { recognition.start(); } catch (err) {} }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    recognition.onend = () => {
      if (isHandsFree && !document.hidden && !isBotSpeaking) {
        try { recognition.start(); } catch (err) {}
      }
    };

    try { recognition.start(); } catch (err) { console.error("Mic initialization failed:", err); }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      recognition.onend = null;
      recognition.stop();
      clearTimeout(silenceTimer);
    };
  }, [isHandsFree, mode, isOpen, botName, isBotSpeaking]);

  const embedMode: EmbedMode = (theme?.embedMode as EmbedMode) || "FLOATING_BUTTON";
  const src = `/embed/widget/${chatbotId}`;

  const modeBadgeLabel: Record<EmbedMode, { label: string; icon: React.ReactNode }> = {
    FLOATING_BUTTON: { label: "Floating Button", icon: <MessageCircle className="h-3 w-3" /> },
    TEASER_BUBBLE:   { label: "Teaser Bubble",   icon: <Bell className="h-3 w-3" /> },
    STICKY_BAR:      { label: "Sticky Bar",      icon: <AlignJustify className="h-3 w-3" /> },
    SLIDE_DRAWER:    { label: "Slide Drawer",    icon: <PanelRight className="h-3 w-3" /> },
    INLINE:          { label: "Inline Embed",    icon: <Layers className="h-3 w-3" /> },
  };

  const handleReload = () => {
    setKey(k => k + 1);
    setIsOpen(false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(Math.round((z + 0.1) * 10) / 10, 2));
  const handleZoomOut = () => setZoom(z => Math.max(Math.round((z - 0.1) * 10) / 10, 0.5));
  const handleZoomReset = () => setZoom(1);

  if (!isMounted) return <div className="h-full bg-background" />;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {modeBadgeLabel[embedMode].icon}
            <span className="text-[10px] font-semibold">{modeBadgeLabel[embedMode].label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono w-8 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomReset} disabled={zoom === 1} title="Reset Zoom">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Voice controls */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1 mr-1">
            <Button 
              variant={isHandsFree ? "secondary" : "ghost"} 
              size="icon" 
              className={`h-7 w-7 transition-all ${isHandsFree ? "bg-purple-100 text-purple-600 hover:bg-purple-200" : ""}`} 
              onClick={() => setIsHandsFree(!isHandsFree)} 
              title={isHandsFree ? "Hands-Free Mode Active" : "Start Hands-Free Mode"}
            >
              {isHandsFree ? (
                <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <Headset className="relative inline-flex h-3.5 w-3.5" />
                </span>
              ) : (
                <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>

          {/* Platform controls */}
          <Button variant={mode === "desktop" ? "secondary" : "ghost"} size="icon" className="h-7 w-7"
            onClick={() => setMode("desktop")} title="Desktop">
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button variant={mode === "mobile" ? "secondary" : "ghost"} size="icon" className="h-7 w-7"
            onClick={() => setMode("mobile")} title="Mobile">
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={handleReload} title="Reload">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-hidden relative bg-muted/20">
        {mode === "desktop" ? (
          <DesktopPreview src={src} reloadKey={key} iframeRef={desktopRef}
            isOpen={isOpen} setIsOpen={setIsOpen} theme={theme} iconSrc={iconSrc} embedMode={embedMode} zoom={zoom} />
        ) : (
          <MobilePreview src={src} reloadKey={key} iframeRef={mobileRef}
            isOpen={isOpen} setIsOpen={setIsOpen} theme={theme} iconSrc={iconSrc} embedMode={embedMode} zoom={zoom} />
        )}
      </div>
    </div>
  );
}

// ─── Shared types ─────────────────────────────────────────────────────────────

interface PreviewProps {
  src: string;
  reloadKey: number;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  theme: any;
  iconSrc: string | null;
  embedMode: EmbedMode;
  zoom: number;
}

// ─── Launcher button ──────────────────────────────────────────────────────────

function LauncherButton({ theme, iconSrc, isOpen, onClick, size = 56 }: {
  theme: any; iconSrc: string | null; isOpen: boolean; onClick: () => void; size?: number;
}) {
  const bgColor      = theme?.widgetColor   || "#3b82f6";
  const widgetBg     = theme?.widgetBgColor || "#ffffff";
  const shapeRaw     = (theme?.widgetShape  || "ROUND").toLowerCase();
  const borderRadius = shapeRaw === "square" ? 0 : shapeRaw === "rounded_square" ? 12 : "50%";

  return (
    <button
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius,
        backgroundColor: isOpen ? "#6b7280" : widgetBg,
        border: `3px solid ${bgColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        position: "relative", flexShrink: 0, overflow: "hidden", padding: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
      title={isOpen ? "Close chat" : "Open chat"}
    >
      {isOpen ? (
        <div style={{ width: "100%", height: "100%", backgroundColor: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
          <X size={size * 0.4} color="#fff" strokeWidth={2.5} />
        </div>
      ) : iconSrc ? (
        <img src={iconSrc} alt="Chatbot" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", backgroundColor: bgColor, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
          <MessageCircle size={size * 0.45} color="#fff" fill="#fff" strokeWidth={1.5} />
        </div>
      )}
      {!isOpen && (
        <span style={{ position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: "#22c55e", border: "2px solid white", zIndex: 1 }} />
      )}
    </button>
  );
}

// ─── Chat window iframe wrapper ───────────────────────────────────────────────

function ChatWindow({ src, reloadKey, iframeRef, isOpen, top, bottom, left, right, width, height, borderR = 16 }: {
  src: string; reloadKey: number; iframeRef: React.RefObject<HTMLIFrameElement | null>;
  isOpen: boolean; top?: number | string; bottom?: number | string;
  left?: number | string; right?: number | string;
  width: number | string; height: number | string; borderR?: number;
}) {
  return (
    <div style={{
      position: "absolute",
      ...(top    !== undefined && { top }),
      ...(bottom !== undefined && { bottom }),
      ...(left   !== undefined && { left }),
      ...(right  !== undefined && { right }),
      width, height, borderRadius: borderR,
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      border: "1px solid rgba(0,0,0,0.08)",
      opacity: isOpen ? 1 : 0,
      pointerEvents: isOpen ? "auto" : "none",
      transform: isOpen ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
      transition: "opacity 0.3s cubic-bezier(0.34,1.2,0.64,1), transform 0.3s cubic-bezier(0.34,1.2,0.64,1)",
      transformOrigin: "bottom center",
    }}>
      <iframe
        key={`iframe-${reloadKey}`}
        ref={iframeRef}
        src={src}
        allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="Chatbot preview"
      />
    </div>
  );
}

// ─── Page background ──────────────────────────────────────────────────────────

function PageBackground({ children, zoom = 1 }: { children: React.ReactNode; zoom?: number }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0,
      width: `${100 / zoom}%`,
      height: `${100 / zoom}%`,
      transform: `scale(${zoom})`,
      transformOrigin: '0 0',
      backgroundImage: `linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px)`,
      backgroundSize: "24px 24px", backgroundColor: "#f9fafb",
      overflow: "hidden"
    }}>
      <div className="absolute inset-0 flex flex-col gap-3 p-6 pointer-events-none opacity-20">
        <div className="h-6 w-48 bg-gray-400 rounded" />
        <div className="h-3 w-full bg-gray-300 rounded" />
        <div className="h-3 w-5/6 bg-gray-300 rounded" />
        <div className="h-3 w-4/6 bg-gray-300 rounded" />
        <div className="h-3 w-full bg-gray-300 rounded mt-2" />
        <div className="h-3 w-3/4 bg-gray-300 rounded" />
      </div>
      {children}
    </div>
  );
}

// ─── Desktop preview ──────────────────────────────────────────────────────────

function DesktopPreview({ src, reloadKey, iframeRef, isOpen, setIsOpen, theme, iconSrc, embedMode, zoom }: PreviewProps) {
  const [teaserDismissed, setTeaserDismissed] = useState(false);

  useEffect(() => { setTeaserDismissed(false); }, [reloadKey]);
  useEffect(() => { if (!isOpen) setTeaserDismissed(false); }, [isOpen]);

  const borderR   = theme?.windowBorderRadius ?? 16;
  const btnSize   = Math.min(theme?.widgetSize || 56, 64);
  const margin    = theme?.widgetMargin ?? 20;
  const pos       = (theme?.widgetPosition || "BottomRight").toLowerCase();
  const onLeft    = theme?.widgetCustomPosition
    ? theme.widgetLeft != null && theme.widgetRight == null
    : pos.includes("left");
  const btnEdge   = theme?.widgetCustomPosition
    ? (onLeft ? (theme.widgetLeft ?? margin) : (theme.widgetRight ?? margin))
    : margin;
  const btnBottom = theme?.widgetCustomPosition ? (theme.widgetBottom ?? margin) : margin;
  const winW      = Math.min(theme?.windowWidth || 420, 400);
  const winH      = 420;

  // ── FLOATING BUTTON ────────────────────────────────────────────────────────
  if (embedMode === "FLOATING_BUTTON") {
    return (
      <PageBackground zoom={zoom}>
        <ChatWindow src={src} reloadKey={reloadKey} iframeRef={iframeRef} isOpen={isOpen}
          bottom={btnBottom + btnSize + 12}
          {...(onLeft ? { left: btnEdge } : { right: btnEdge })}
          width={winW} height={winH} borderR={borderR}
        />
        <div style={{ position: "absolute", bottom: btnBottom, ...(onLeft ? { left: btnEdge } : { right: btnEdge }) }}>
          <LauncherButton theme={theme} iconSrc={iconSrc} isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} size={btnSize} />
        </div>
      </PageBackground>
    );
  }

  // ── TEASER BUBBLE ──────────────────────────────────────────────────────────
  if (embedMode === "TEASER_BUBBLE") {
    const teaserBg   = theme?.teaserBgColor   || "#111CA8";
    const teaserText = theme?.teaserTextColor || "#ffffff";
    const teaserMsg  = theme?.teaserMessage   || "👋 Hi! Need help?";
    const ctaYes     = theme?.teaserCtaYes    || "Yes, help me";
    const ctaNo      = theme?.teaserCtaNo     || "Not now";

    const showTeaser = !isOpen && !teaserDismissed;

    return (
      <PageBackground zoom={zoom}>
        <ChatWindow src={src} reloadKey={reloadKey} iframeRef={iframeRef} isOpen={isOpen}
          bottom={btnBottom + btnSize + 12}
          {...(onLeft ? { left: btnEdge } : { right: btnEdge })}
          width={winW} height={winH} borderR={borderR}
        />

        {showTeaser && (
          <div style={{
            position: "absolute",
            bottom: btnBottom + btnSize + 10,
            ...(onLeft ? { left: btnEdge } : { right: btnEdge }),
            maxWidth: 230,
            backgroundColor: teaserBg, color: teaserText,
            padding: "10px 14px",
            borderRadius: onLeft ? "12px 12px 12px 0" : "12px 12px 0 12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            fontSize: 12, fontWeight: 500, lineHeight: 1.5,
            zIndex: 20,
            animation: "fadeInUp 0.4s ease",
          }}>
            <p style={{ margin: "0 0 8px", cursor: "default" }}>{teaserMsg}</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                style={{
                  flex: 1, padding: "5px 10px", borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.25)", color: teaserText,
                  fontSize: 11, fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.35)", cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onClick={(e) => { e.stopPropagation(); setIsOpen(true); setTeaserDismissed(true); }}
              >
                {ctaYes}
              </button>
              <button
                style={{
                  padding: "5px 10px", borderRadius: 20,
                  backgroundColor: "transparent", color: teaserText,
                  fontSize: 11,
                  border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setTeaserDismissed(true);
                }}
              >
                {ctaNo}
              </button>
            </div>
          </div>
        )}

        <div style={{ position: "absolute", bottom: btnBottom, ...(onLeft ? { left: btnEdge } : { right: btnEdge }) }}>
          <LauncherButton theme={theme} iconSrc={iconSrc} isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} size={btnSize} />
        </div>
        <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>
      </PageBackground>
    );
  }

  // ── STICKY BAR ─────────────────────────────────────────────────────────────
  if (embedMode === "STICKY_BAR") {
    const barBg    = theme?.stickyBarBgColor   || "#111CA8";
    const barText  = theme?.stickyBarTextColor || "#ffffff";
    const barLabel = theme?.stickyBarText      || "💬 Chat with us — we reply instantly";
    const barPos   = theme?.stickyBarPosition  || "bottom";
    const ctaText  = theme?.stickyBarCtaText   || "Start chat →";

    return (
      <PageBackground zoom={zoom}>
        <ChatWindow src={src} reloadKey={reloadKey} iframeRef={iframeRef} isOpen={isOpen}
          {...(barPos === "bottom" ? { bottom: 48, right: 16 } : { top: 48, right: 16 })}
          width={winW} height={winH} borderR={borderR}
        />
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: "absolute",
            ...(barPos === "bottom" ? { bottom: 0 } : { top: 0 }),
            left: 0, right: 0, height: 44,
            backgroundColor: barBg,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: "pointer",
            boxShadow: barPos === "bottom" ? "0 -2px 16px rgba(0,0,0,0.15)" : "0 2px 16px rgba(0,0,0,0.15)",
          }}
        >
          {isOpen
            ? <><X size={16} color={barText} /><span style={{ fontSize: 13, fontWeight: 600, color: barText }}>Close chat</span></>
            : <>
                <MessageCircle size={16} color={barText} fill={barText} />
                <span style={{ fontSize: 13, fontWeight: 600, color: barText }}>{barLabel}</span>
                <div style={{
                  padding: "3px 10px", borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  color: barText, fontSize: 11, fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.25)",
                }}>
                  {ctaText}
                </div>
              </>
          }
        </div>
      </PageBackground>
    );
  }

  // ── SLIDE DRAWER ───────────────────────────────────────────────────────────
  if (embedMode === "SLIDE_DRAWER") {
    const drawerW    = Math.min(theme?.drawerWidth || 380, 380);
    const drawerSide = theme?.drawerSide || "right";
    const tabText    = theme?.drawerTabText    || "Chat";
    const tabBg      = theme?.drawerTabBgColor || theme?.widgetBgColor || "#111CA8";

    return (
      <PageBackground zoom={zoom}>
        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.3)",
              zIndex: 9, cursor: "pointer",
              animation: "fadeIn 0.2s ease",
            }}
          />
        )}

        <div style={{
          position: "absolute", top: 0, bottom: 0,
          ...(drawerSide === "right" ? { right: 0 } : { left: 0 }),
          width: drawerW, backgroundColor: "#fff",
          boxShadow: drawerSide === "right" ? "-8px 0 32px rgba(0,0,0,0.15)" : "8px 0 32px rgba(0,0,0,0.15)",
          transform: isOpen ? "translateX(0)" : drawerSide === "right" ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          overflow: "hidden", zIndex: 10,
        }}>
          <iframe key={`drawer-${reloadKey}`} ref={iframeRef} src={src}
            allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Chatbot drawer"
          />
        </div>

        <div style={{
          position: "absolute", top: "50%",
          ...(drawerSide === "right"
            ? { right: isOpen ? drawerW : 0 }
            : { left:  isOpen ? drawerW : 0 }
          ),
          transform: "translateY(-50%)",
          transition: `${drawerSide} 0.35s cubic-bezier(0.32,0.72,0,1)`,
          zIndex: 11,
        }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 8px", backgroundColor: tabBg, color: "#fff",
              border: "none", cursor: "pointer",
              borderRadius: drawerSide === "right" ? "8px 0 0 8px" : "0 8px 8px 0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              writingMode: "vertical-rl", textOrientation: "mixed",
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}
          >
            {isOpen ? <X size={14} color="#fff" /> : <MessageCircle size={14} fill="#fff" />}
            {tabText}
          </button>
        </div>
        <style>{`@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }`}</style>
      </PageBackground>
    );
  }

  // ── INLINE ─────────────────────────────────────────────────────────────────
  if (embedMode === "INLINE") {
    return (
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: `${100 / zoom}%`,
        height: `${100 / zoom}%`,
        transform: `scale(${zoom})`,
        transformOrigin: '0 0',
        backgroundImage: `linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px)`,
        backgroundSize: "24px 24px", backgroundColor: "#f9fafb",
      }} className="p-4 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between pointer-events-none opacity-30">
          <div className="h-5 w-32 bg-gray-400 rounded" />
          <div className="flex gap-2">
            <div className="h-4 w-12 bg-gray-300 rounded" />
            <div className="h-4 w-12 bg-gray-300 rounded" />
          </div>
        </div>
        <div style={{ flex: 1, borderRadius: borderR, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.08)" }}>
          <iframe key={`inline-${reloadKey}`} ref={iframeRef} src={src}
            allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Chatbot inline"
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Mobile preview ───────────────────────────────────────────────────────────

function MobilePreview({ src, reloadKey, iframeRef, isOpen, setIsOpen, theme, iconSrc, embedMode, zoom }: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [teaserDismissed, setTeaserDismissed] = useState(false);
  
  useEffect(() => { setTeaserDismissed(false); }, [reloadKey]);
  useEffect(() => { if (!isOpen) setTeaserDismissed(false); }, [isOpen]);

  const PHONE_W = 320;
  const PHONE_H = 620;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const compute = () => {
      const aw = container.clientWidth  - 48;
      const ah = container.clientHeight - 48;
      if (aw > 0 && ah > 0) {
        const baseScale = Math.min(aw / PHONE_W, ah / PHONE_H, 1);
        setScale(baseScale * zoom);
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [zoom]);

  const barBg      = theme?.stickyBarBgColor   || "#111CA8";
  const barText    = theme?.stickyBarTextColor || "#ffffff";
  const barLabel   = theme?.stickyBarText      || "💬 Chat with us";
  const barPos     = theme?.stickyBarPosition  || "bottom";
  const teaserBg   = theme?.teaserBgColor      || "#111CA8";
  const teaserTx   = theme?.teaserTextColor    || "#ffffff";
  const drawerSide = theme?.drawerSide || "right";
  const tabBg      = theme?.drawerTabBgColor || theme?.widgetBgColor || "#111CA8";

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-auto flex" style={{ padding: '24px' }}>
      <div style={{ margin: 'auto', width: PHONE_W * scale, height: PHONE_H * scale, flexShrink: 0, position: 'relative' }}>
        <div style={{
          width: PHONE_W, height: PHONE_H,
          transformOrigin: "top left", transform: `scale(${scale})`,
          borderRadius: 36, border: "10px solid #1a1a1a",
          boxShadow: "0 16px 48px rgba(0,0,0,0.35), inset 0 0 0 1px #333",
          overflow: "hidden", background: "#f9fafb", position: "relative",
        }}>
          {/* Notch */}
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 70, height: 16, background: "#1a1a1a", borderRadius: "0 0 10px 10px", zIndex: 20 }} />

          {/* Fake page content */}
          <div className="absolute inset-0 flex flex-col gap-2 p-4 pt-8 pointer-events-none opacity-15">
            <div className="h-4 w-32 bg-gray-500 rounded" />
            <div className="h-2.5 w-full bg-gray-400 rounded" />
            <div className="h-2.5 w-5/6 bg-gray-400 rounded" />
            <div className="h-2.5 w-4/6 bg-gray-400 rounded" />
          </div>

          {/* ── FLOATING BUTTON ── */}
          {embedMode === "FLOATING_BUTTON" && (
            <>
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
                transform: isOpen ? "translateY(0)" : "translateY(100%)",
                transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
              }}>
                <iframe key={`m-float-${reloadKey}`} ref={iframeRef} src={src}
                  allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>
              <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 15 }}>
                <LauncherButton theme={theme} iconSrc={iconSrc} isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} size={48} />
              </div>
            </>
          )}

          {/* ── TEASER BUBBLE ── */}
          {embedMode === "TEASER_BUBBLE" && (
            <>
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
                transform: isOpen ? "translateY(0)" : "translateY(100%)",
                transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
              }}>
                <iframe key={`m-teaser-${reloadKey}`} ref={iframeRef} src={src}
                  allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>

              {!isOpen && !teaserDismissed && (
                <div style={{
                  position: "absolute", bottom: 72, right: 12,
                  backgroundColor: teaserBg, color: teaserTx,
                  padding: "8px 10px", borderRadius: "10px 10px 0 10px",
                  fontSize: 10, fontWeight: 500, maxWidth: 170, zIndex: 15,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}>
                  <p style={{ margin: "0 0 6px" }}>{theme?.teaserMessage || "👋 Need help?"}</p>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button style={{
                      flex: 1, padding: "4px 8px", borderRadius: 20,
                      backgroundColor: "rgba(255,255,255,0.25)", color: teaserTx,
                      fontSize: 9, fontWeight: 600, border: "1px solid rgba(255,255,255,0.35)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                      onClick={(e) => { e.stopPropagation(); setIsOpen(true); setTeaserDismissed(true); }}
                    >
                      {theme?.teaserCtaYes || "Yes"}
                    </button>
                    <button style={{
                      padding: "4px 8px", borderRadius: 20,
                      backgroundColor: "transparent", color: teaserTx,
                      fontSize: 9, border: "1px solid rgba(255,255,255,0.25)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTeaserDismissed(true);
                      }}
                    >
                      {theme?.teaserCtaNo || "No"}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 15 }}>
                <LauncherButton theme={theme} iconSrc={iconSrc} isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} size={48} />
              </div>
            </>
          )}

          {/* ── STICKY BAR ── */}
          {embedMode === "STICKY_BAR" && (
            <>
              <div style={{
                position: "absolute",
                ...(barPos === "bottom" ? { top: 0, bottom: 40 } : { top: 40, bottom: 0 }),
                left: 0, right: 0, zIndex: 10,
                opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
                transform: isOpen ? "translateY(0)" : barPos === "bottom" ? "translateY(30px)" : "translateY(-30px)",
                transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
              }}>
                <iframe key={`ms-${reloadKey}`} ref={iframeRef} src={src}
                  allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>
              <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                  position: "absolute",
                  ...(barPos === "bottom" ? { bottom: 0 } : { top: 0 }),
                  left: 0, right: 0, height: 40, backgroundColor: barBg,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  cursor: "pointer", zIndex: 15,
                }}
              >
                {isOpen
                  ? <><X size={12} color={barText} /><span style={{ fontSize: 10, fontWeight: 600, color: barText }}>Close</span></>
                  : <><MessageCircle size={12} color={barText} fill={barText} /><span style={{ fontSize: 10, fontWeight: 600, color: barText }}>{barLabel}</span></>
                }
              </div>
            </>
          )}

          {/* ── SLIDE DRAWER ── */}
          {embedMode === "SLIDE_DRAWER" && (
            <>
              {isOpen && (
                <div onClick={() => setIsOpen(false)} style={{
                  position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 9,
                }} />
              )}

              <div style={{
                position: "absolute", top: 0, bottom: 0,
                ...(drawerSide === "right" ? { right: 0 } : { left: 0 }),
                width: "75%", zIndex: 10,
                transform: isOpen ? "translateX(0)" : drawerSide === "right" ? "translateX(100%)" : "translateX(-100%)",
                transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
              }}>
                <iframe key={`md-${reloadKey}`} ref={iframeRef} src={src}
                  allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>

              <div style={{
                position: "absolute", top: "50%",
                ...(drawerSide === "right"
                  ? { right: isOpen ? "75%" : 0 }
                  : { left:  isOpen ? "75%" : 0 }
                ),
                transform: "translateY(-50%)", zIndex: 11,
                transition: `${drawerSide} 0.35s cubic-bezier(0.32,0.72,0,1)`,
              }}>
                <button onClick={() => setIsOpen(!isOpen)} style={{
                  display: "flex", alignItems: "center",
                  padding: "8px 5px", backgroundColor: tabBg,
                  color: "#fff", border: "none", cursor: "pointer",
                  borderRadius: drawerSide === "right" ? "6px 0 0 6px" : "0 6px 6px 0",
                  writingMode: "vertical-rl", textOrientation: "mixed",
                  fontSize: 9, fontWeight: 700,
                }}>
                  {isOpen ? <X size={10} /> : <MessageCircle size={10} fill="#fff" />}
                  {theme?.drawerTabText || "Chat"}
                </button>
              </div>
            </>
          )}

          {/* ── INLINE ── */}
          {embedMode === "INLINE" && (
            <div style={{ position: "absolute", inset: 0, top: 16, zIndex: 10 }}>
              <iframe key={`mi-${reloadKey}`} ref={iframeRef} src={src}
                allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}