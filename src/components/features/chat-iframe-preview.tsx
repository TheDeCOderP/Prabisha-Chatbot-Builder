"use client";

import { useRef, useState, useEffect } from "react";
import { Monitor, Smartphone, RefreshCw, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatIframePreviewProps {
  chatbotId: string;
}

export default function ChatIframePreview({ chatbotId }: ChatIframePreviewProps) {
  const desktopRef = useRef<HTMLIFrameElement>(null);
  const mobileRef  = useRef<HTMLIFrameElement>(null);
  const [mode, setMode]     = useState<"desktop" | "mobile">("desktop");
  const [key, setKey]       = useState(0);
  const [isOpen, setIsOpen]   = useState(false);
  const [theme, setTheme]     = useState<any>(null);
  const [iconSrc, setIconSrc] = useState<string | null>(null);

  // Fetch chatbot data for launcher button styling
  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}`)
      .then(r => r.json())
      .then(data => {
        setTheme(data?.theme || null);
        // icon lives on the chatbot model, not inside theme
        setIconSrc(data?.icon || data?.avatar || null);
      })
      .catch(() => {});
  }, [chatbotId]);

  // Listen for messages from widget iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "chatbot-close") {
        setIsOpen(false);
        return;
      }
      if (e.data?.type === "theme-update") {
        // Update local theme for button re-styling too
        if (e.data.theme) setTheme((prev: any) => ({ ...prev, ...e.data.theme }));
        // Forward to active iframe
        const target = mode === "desktop" ? desktopRef.current : mobileRef.current;
        target?.contentWindow?.postMessage(e.data, "*");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [mode]);

  const src = `/embed/widget/${chatbotId}`;

  return (
    <div className="h-full flex flex-col">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Live Preview
        </span>
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
}

// ─── Launcher button (shared) ─────────────────────────────────────────────────

function LauncherButton({
  theme,
  iconSrc,
  isOpen,
  onClick,
  size = 56,
}: {
  theme: any;
  iconSrc: string | null;
  isOpen: boolean;
  onClick: () => void;
  size?: number;
}) {
  const bgColor  = theme?.widgetColor   || "#3b82f6";
  const widgetBg = theme?.widgetBgColor || "#ffffff";
  const shapeRaw = (theme?.widgetShape  || "ROUND").toLowerCase();
  const borderRadius = shapeRaw === "square" ? 0 : shapeRaw === "rounded_square" ? 12 : "50%";

  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: isOpen ? "#6b7280" : widgetBg,
        border: `3px solid ${bgColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        transition: "all 0.2s ease",
        position: "relative",
        flexShrink: 0,
        overflow: "hidden",
        padding: 0,
      }}
      title={isOpen ? "Close chat" : "Open chat"}
    >
      {isOpen ? (
        <div style={{
          width: "100%", height: "100%",
          backgroundColor: "#6b7280",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "inherit",
        }}>
          <X size={size * 0.4} color="#fff" strokeWidth={2.5} />
        </div>
      ) : iconSrc ? (
        // Show actual chatbot icon
        <img
          src={iconSrc}
          alt="Chatbot"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
          }}
        />
      ) : (
        // Fallback icon
        <div style={{
          width: "100%", height: "100%",
          backgroundColor: bgColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "inherit",
        }}>
          <MessageCircle size={size * 0.45} color="#fff" fill="#fff" strokeWidth={1.5} />
        </div>
      )}
      {/* Online dot */}
      {!isOpen && (
        <span style={{
          position: "absolute",
          top: -2, right: -2,
          width: 12, height: 12,
          borderRadius: "50%",
          background: "#22c55e",
          border: "2px solid white",
          zIndex: 1,
        }} />
      )}
    </button>
  );
}

// ─── Desktop preview ──────────────────────────────────────────────────────────

function DesktopPreview({ src, reloadKey, iframeRef, isOpen, setIsOpen, theme, iconSrc }: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const borderR  = theme?.windowBorderRadius ?? 16;
  const btnSize  = Math.min(theme?.widgetSize || 56, 64);
  const margin   = theme?.widgetMargin ?? 20;

  // Which horizontal side is the widget on?
  const pos      = (theme?.widgetPosition || "BottomRight").toLowerCase();
  const onLeft   = theme?.widgetCustomPosition
    ? theme.widgetLeft != null && theme.widgetRight == null
    : pos.includes("left");

  // Button position (px from edge)
  const btnEdge  = theme?.widgetCustomPosition
    ? (onLeft ? (theme.widgetLeft ?? margin) : (theme.widgetRight ?? margin))
    : margin;
  const btnBottom = theme?.widgetCustomPosition
    ? (theme.widgetBottom ?? margin)
    : margin;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "24px 24px",
        backgroundColor: "#f9fafb",
      }}
    >
      {/* Fake page lines */}
      <div className="absolute inset-0 flex flex-col gap-3 p-6 pointer-events-none opacity-20">
        <div className="h-6 w-48 bg-gray-400 rounded" />
        <div className="h-3 w-full bg-gray-300 rounded" />
        <div className="h-3 w-5/6 bg-gray-300 rounded" />
        <div className="h-3 w-4/6 bg-gray-300 rounded" />
        <div className="h-3 w-full bg-gray-300 rounded mt-2" />
        <div className="h-3 w-3/4 bg-gray-300 rounded" />
      </div>

      {/* Chat window — always in DOM so postMessage live updates always work */}
      <div
        style={{
          position: "absolute",
          top: 8,
          bottom: btnBottom + btnSize + 12,
          ...(onLeft ? { left: btnEdge } : { right: btnEdge }),
          width: Math.min(theme?.windowWidth || 420, 400),
          borderRadius: borderR,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          border: "1px solid rgba(0,0,0,0.08)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
        }}
      >
        <iframe
          key={`desktop-${reloadKey}`}
          ref={iframeRef}
          src={src}
          allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="Chatbot preview"
        />
      </div>

      {/* Launcher button */}
      <div
        style={{
          position: "absolute",
          bottom: btnBottom,
          ...(onLeft ? { left: btnEdge } : { right: btnEdge }),
        }}
      >
        <LauncherButton
          theme={theme}
          iconSrc={iconSrc}
          isOpen={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          size={btnSize}
        />
      </div>
    </div>
  );
}

// ─── Mobile preview ───────────────────────────────────────────────────────────

function MobilePreview({ src, reloadKey, iframeRef, isOpen, setIsOpen, theme, iconSrc }: PreviewProps) {
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
          <div style={{
            position: "absolute", top: 0, left: "50%",
            transform: "translateX(-50%)",
            width: 70, height: 16,
            background: "#1a1a1a",
            borderRadius: "0 0 10px 10px",
            zIndex: 20,
          }} />

          {/* Fake page lines */}
          <div className="absolute inset-0 flex flex-col gap-2 p-4 pt-8 pointer-events-none opacity-15">
            <div className="h-4 w-32 bg-gray-500 rounded" />
            <div className="h-2.5 w-full bg-gray-400 rounded" />
            <div className="h-2.5 w-5/6 bg-gray-400 rounded" />
            <div className="h-2.5 w-4/6 bg-gray-400 rounded" />
          </div>

          {/* Chat iframe — always mounted, full screen when open on mobile */}
          <div style={{
            position: "absolute", inset: 0,
            zIndex: 10,
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
            transform: isOpen ? "translateY(0)" : "translateY(100%)",
            transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
          }}>
            <iframe
              key={`mobile-${reloadKey}`}
              ref={iframeRef}
              src={src}
              allow="microphone; camera; autoplay; clipboard-write; encrypted-media"
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              title="Chatbot mobile preview"
            />
          </div>

          {/* Launcher button — bottom-right */}
          <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 15 }}>
            <LauncherButton
              theme={theme}
              iconSrc={iconSrc}
              isOpen={isOpen}
              onClick={() => setIsOpen(!isOpen)}
              size={48}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
