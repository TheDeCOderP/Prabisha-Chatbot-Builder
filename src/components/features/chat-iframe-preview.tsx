"use client";

import { useRef, useState, useEffect } from "react";
import { Monitor, Smartphone, RefreshCw, MessageCircle, X, AlignJustify, PanelRight, Layers, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatIframePreviewProps {
  chatbotId: string;
}

type EmbedMode = "FLOATING_BUTTON" | "INLINE" | "STICKY_BAR" | "TEASER_BUBBLE" | "SLIDE_DRAWER";

export default function ChatIframePreview({ chatbotId }: ChatIframePreviewProps) {
  const desktopRef = useRef<HTMLIFrameElement>(null);
  const mobileRef  = useRef<HTMLIFrameElement>(null);
  const [mode, setMode]       = useState<"desktop" | "mobile">("desktop");
  const [key, setKey]         = useState(0);
  const [isOpen, setIsOpen]   = useState(false);
  const [theme, setTheme]     = useState<any>(null);
  const [iconSrc, setIconSrc] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}`)
      .then(r => r.json())
      .then(data => {
        setTheme(data?.theme || null);
        setIconSrc(data?.icon || data?.avatar || null);
      })
      .catch(() => {});
  }, [chatbotId]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "chatbot-close") { setIsOpen(false); return; }
      if (e.data?.type === "theme-update") {
        if (e.data.theme) setTheme((prev: any) => ({ ...prev, ...e.data.theme }));
        const target = mode === "desktop" ? desktopRef.current : mobileRef.current;
        target?.contentWindow?.postMessage(e.data, "*");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [mode]);

  const embedMode: EmbedMode = (theme?.embedMode as EmbedMode) || "FLOATING_BUTTON";
  const src = `/embed/widget/${chatbotId}`;

  const modeBadgeLabel: Record<EmbedMode, { label: string; icon: React.ReactNode }> = {
    FLOATING_BUTTON: { label: "Floating Button", icon: <MessageCircle className="h-3 w-3" /> },
    TEASER_BUBBLE:   { label: "Teaser Bubble",   icon: <Bell className="h-3 w-3" /> },
    STICKY_BAR:      { label: "Sticky Bar",      icon: <AlignJustify className="h-3 w-3" /> },
    SLIDE_DRAWER:    { label: "Slide Drawer",    icon: <PanelRight className="h-3 w-3" /> },
    INLINE:          { label: "Inline Embed",    icon: <Layers className="h-3 w-3" /> },
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Live Preview
          </span>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {modeBadgeLabel[embedMode].icon}
            <span className="text-[10px] font-semibold">{modeBadgeLabel[embedMode].label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "desktop" ? "secondary" : "ghost"}
            size="icon" className="h-7 w-7"
            onClick={() => setMode("desktop")} title="Desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={mode === "mobile" ? "secondary" : "ghost"}
            size="icon" className="h-7 w-7"
            onClick={() => setMode("mobile")} title="Mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { setKey(k => k + 1); setIsOpen(false); }} title="Reload"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-hidden relative bg-muted/20">
        {mode === "desktop" ? (
          <DesktopPreview
            src={src}
            reloadKey={key}
            iframeRef={desktopRef}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            theme={theme}
            iconSrc={iconSrc}
            embedMode={embedMode}
          />
        ) : (
          <MobilePreview
            src={src}
            reloadKey={key}
            iframeRef={mobileRef}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            theme={theme}
            iconSrc={iconSrc}
            embedMode={embedMode}
          />
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
}

// ─── Launcher button ──────────────────────────────────────────────────────────

function LauncherButton({
  theme, iconSrc, isOpen, onClick, size = 56,
}: {
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
        position: "relative",
        flexShrink: 0, overflow: "hidden", padding: 0,
        transform: "scale(1)",
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

function ChatWindow({
  src, reloadKey, iframeRef, isOpen,
  top, bottom, left, right, width, height, borderR = 16,
}: {
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
      width, height,
      borderRadius: borderR,
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

function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px)`,
        backgroundSize: "24px 24px",
        backgroundColor: "#f9fafb",
      }}
    >
      {/* Fake page content */}
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

function DesktopPreview({ src, reloadKey, iframeRef, isOpen, setIsOpen, theme, iconSrc, embedMode }: PreviewProps) {
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

  // ── FLOATING BUTTON (default) ──────────────────────────────────────────────
  if (embedMode === "FLOATING_BUTTON") {
    return (
      <PageBackground>
        <ChatWindow
          src={src} reloadKey={reloadKey} iframeRef={iframeRef} isOpen={isOpen}
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
    return (
      <PageBackground>
        <ChatWindow
          src={src} reloadKey={reloadKey} iframeRef={iframeRef} isOpen={isOpen}
          bottom={btnBottom + btnSize + 12}
          {...(onLeft ? { left: btnEdge } : { right: btnEdge })}
          width={winW} height={winH} borderR={borderR}
        />
        {/* Teaser bubble */}
        {!isOpen && (
          <div style={{
            position: "absolute",
            bottom: btnBottom + btnSize + 10,
            ...(onLeft ? { left: btnEdge } : { right: btnEdge }),
            maxWidth: 220,
            backgroundColor: teaserBg,
            color: teaserText,
            padding: "10px 14px",
            borderRadius: onLeft ? "12px 12px 12px 0" : "12px 12px 0 12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.5,
            animation: "fadeInUp 0.4s ease",
            cursor: "pointer",
          }}
            onClick={() => setIsOpen(true)}
          >
            {teaserMsg}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button style={{
                padding: "4px 10px", borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.2)",
                color: teaserText, fontSize: 11, fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer",
              }}
                onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
              >
                {theme?.teaserCtaYes || "Yes, help me"}
              </button>
              <button style={{
                padding: "4px 10px", borderRadius: 20,
                backgroundColor: "transparent",
                color: teaserText, fontSize: 11,
                border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              }}>
                {theme?.teaserCtaNo || "Not now"}
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
    const barBg     = theme?.stickyBarBgColor   || "#111CA8";
    const barText   = theme?.stickyBarTextColor || "#ffffff";
    const barLabel  = theme?.stickyBarText      || "💬 Chat with us — we reply instantly";
    const barPos    = theme?.stickyBarPosition  || "bottom";
    return (
      <PageBackground>
        {/* Chat window slides up from bar */}
        <ChatWindow
          src={src} reloadKey={reloadKey} iframeRef={iframeRef} isOpen={isOpen}
          {...(barPos === "bottom" ? { bottom: 48, right: 16 } : { top: 48, right: 16 })}
          width={winW} height={winH} borderR={borderR}
        />
        {/* Sticky bar */}
        <div style={{
          position: "absolute",
          ...(barPos === "bottom" ? { bottom: 0 } : { top: 0 }),
          left: 0, right: 0,
          height: 44,
          backgroundColor: barBg,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer",
          boxShadow: barPos === "bottom" ? "0 -2px 16px rgba(0,0,0,0.15)" : "0 2px 16px rgba(0,0,0,0.15)",
          transition: "opacity 0.2s",
        }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <MessageCircle size={16} color={barText} fill={barText} />
          <span style={{ fontSize: 13, fontWeight: 600, color: barText }}>{barLabel}</span>
          <div style={{
            padding: "3px 10px", borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.2)",
            color: barText, fontSize: 11, fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.25)",
          }}>
            {theme?.stickyBarCtaText || "Start chat →"}
          </div>
        </div>
      </PageBackground>
    );
  }

  // ── SLIDE DRAWER ───────────────────────────────────────────────────────────
  if (embedMode === "SLIDE_DRAWER") {
    const drawerW    = Math.min(theme?.drawerWidth || 380, 380);
    const drawerSide = theme?.drawerSide || "right";
    return (
      <PageBackground>
        {/* Drawer panel */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          ...(drawerSide === "right" ? { right: 0 } : { left: 0 }),
          width: drawerW,
          backgroundColor: "#fff",
          boxShadow: drawerSide === "right"
            ? "-8px 0 32px rgba(0,0,0,0.15)"
            : "8px 0 32px rgba(0,0,0,0.15)",
          transform: isOpen
            ? "translateX(0)"
            : drawerSide === "right" ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          overflow: "hidden",
          zIndex: 10,
        }}>
          <iframe
            key={`drawer-${reloadKey}`}
            ref={iframeRef}
            src={src}
            allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Chatbot drawer"
          />
        </div>
        {/* Trigger tab */}
        <div style={{
          position: "absolute", top: "50%",
          ...(drawerSide === "right" ? { right: isOpen ? drawerW : 0 } : { left: isOpen ? drawerW : 0 }),
          transform: "translateY(-50%)",
          transition: "right 0.35s cubic-bezier(0.32,0.72,0,1), left 0.35s cubic-bezier(0.32,0.72,0,1)",
          zIndex: 11,
        }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 8px",
              backgroundColor: theme?.drawerTabBgColor || theme?.widgetBgColor || "#111CA8",
              color: "#fff",
              border: "none", cursor: "pointer",
              borderRadius: drawerSide === "right" ? "8px 0 0 8px" : "0 8px 8px 0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              fontSize: 11, fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            <MessageCircle size={14} fill="#fff" />
            {theme?.drawerTabText || "Chat"}
          </button>
        </div>
      </PageBackground>
    );
  }

  // ── INLINE ─────────────────────────────────────────────────────────────────
  if (embedMode === "INLINE") {
    return (
      <div className="absolute inset-0 p-4 flex flex-col gap-3"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px)`,
          backgroundSize: "24px 24px",
          backgroundColor: "#f9fafb",
        }}
      >
        {/* Fake page header */}
        <div className="flex items-center justify-between pointer-events-none opacity-30">
          <div className="h-5 w-32 bg-gray-400 rounded" />
          <div className="flex gap-2">
            <div className="h-4 w-12 bg-gray-300 rounded" />
            <div className="h-4 w-12 bg-gray-300 rounded" />
          </div>
        </div>
        {/* Inline chat container */}
        <div style={{
          flex: 1,
          borderRadius: borderR,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          border: "1px solid rgba(0,0,0,0.08)",
        }}>
          <iframe
            key={`inline-${reloadKey}`}
            ref={iframeRef}
            src={src}
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

function MobilePreview({ src, reloadKey, iframeRef, isOpen, setIsOpen, theme, iconSrc, embedMode }: PreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const PHONE_W = 320;
  const PHONE_H = 620;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const aw = parent.clientWidth  - 48;
      const ah = parent.clientHeight - 48;
      setScale(Math.min(aw / PHONE_W, ah / PHONE_H, 1));
    };
    compute();
    const ro = new ResizeObserver(compute);
    const parent = el.parentElement;
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const barBg    = theme?.stickyBarBgColor   || "#111CA8";
  const barText  = theme?.stickyBarTextColor || "#ffffff";
  const barLabel = theme?.stickyBarText      || "💬 Chat with us";
  const teaserBg = theme?.teaserBgColor      || "#111CA8";
  const teaserTx = theme?.teaserTextColor    || "#ffffff";

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <div
          ref={wrapRef}
          style={{
            width: PHONE_W, height: PHONE_H,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            borderRadius: 36,
            border: "10px solid #1a1a1a",
            boxShadow: "0 16px 48px rgba(0,0,0,0.35), inset 0 0 0 1px #333",
            overflow: "hidden",
            background: "#f9fafb",
            position: "relative",
          }}
        >
          {/* Notch */}
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 70, height: 16, background: "#1a1a1a", borderRadius: "0 0 10px 10px", zIndex: 20 }} />

          {/* Fake page content */}
          <div className="absolute inset-0 flex flex-col gap-2 p-4 pt-8 pointer-events-none opacity-15">
            <div className="h-4 w-32 bg-gray-500 rounded" />
            <div className="h-2.5 w-full bg-gray-400 rounded" />
            <div className="h-2.5 w-5/6 bg-gray-400 rounded" />
            <div className="h-2.5 w-4/6 bg-gray-400 rounded" />
          </div>

          {/* ── FLOATING / TEASER ── */}
          {(embedMode === "FLOATING_BUTTON" || embedMode === "TEASER_BUBBLE") && (
            <>
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? "auto" : "none",
                transform: isOpen ? "translateY(0)" : "translateY(100%)",
                transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
              }}>
                <iframe key={`m-${reloadKey}`} ref={iframeRef} src={src}
                  allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>
              {!isOpen && embedMode === "TEASER_BUBBLE" && (
                <div style={{
                  position: "absolute", bottom: 74, right: 12,
                  backgroundColor: teaserBg, color: teaserTx,
                  padding: "7px 10px", borderRadius: "10px 10px 0 10px",
                  fontSize: 10, fontWeight: 500, maxWidth: 160, zIndex: 15,
                }}>
                  {theme?.teaserMessage || "👋 Need help?"}
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
                position: "absolute", inset: 0, bottom: 40, zIndex: 10,
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? "auto" : "none",
                transform: isOpen ? "translateY(0)" : "translateY(30px)",
                transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
              }}>
                <iframe key={`ms-${reloadKey}`} ref={iframeRef} src={src}
                  allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: 40, backgroundColor: barBg,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                cursor: "pointer", zIndex: 15,
              }} onClick={() => setIsOpen(!isOpen)}>
                <MessageCircle size={12} color={barText} fill={barText} />
                <span style={{ fontSize: 10, fontWeight: 600, color: barText }}>{barLabel}</span>
              </div>
            </>
          )}

          {/* ── SLIDE DRAWER ── */}
          {embedMode === "SLIDE_DRAWER" && (
            <>
              <div style={{
                position: "absolute", top: 0, bottom: 0, right: 0,
                width: "75%", zIndex: 10,
                transform: isOpen ? "translateX(0)" : "translateX(100%)",
                transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
              }}>
                <iframe key={`md-${reloadKey}`} ref={iframeRef} src={src}
                  allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>
              <div style={{
                position: "absolute", top: "50%", right: isOpen ? "75%" : 0,
                transform: "translateY(-50%)", zIndex: 11,
                transition: "right 0.35s cubic-bezier(0.32,0.72,0,1)",
              }}>
                <button onClick={() => setIsOpen(!isOpen)} style={{
                  display: "flex", alignItems: "center",
                  padding: "8px 5px",
                  backgroundColor: theme?.drawerTabBgColor || theme?.widgetBgColor || "#111CA8",
                  color: "#fff", border: "none", cursor: "pointer",
                  borderRadius: "6px 0 0 6px",
                  writingMode: "vertical-rl", textOrientation: "mixed",
                  fontSize: 9, fontWeight: 700,
                }}>
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
