"use client";

import { useState, useCallback } from "react";
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  VoiceAssistantControlBar,
  useVoiceAssistant
} from "@livekit/components-react";
import { Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "@livekit/components-styles";

export default function VoiceAgentPreview({ agentId }: { agentId: string }) {
  const [connectionDetails, setConnectionDetails] = useState<{ token: string; url: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectToAgent = async () => {
    if (isConnecting || connectionDetails) return;
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/voice-agents/${agentId}/preview`);
      if (!res.ok) throw new Error("Failed to get preview token");
      const data = await res.json();
      setConnectionDetails({ token: data.token, url: data.url });
    } catch (error) {
      toast.error("Could not start preview session.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = useCallback(() => {
    setConnectionDetails(null);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative">
      {!connectionDetails ? (
        <InactiveOrbUI onConnect={connectToAgent} isConnecting={isConnecting} />
      ) : (
        <LiveKitRoom
          serverUrl={connectionDetails.url}
          token={connectionDetails.token}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={disconnect}
          className="flex flex-col items-center justify-center w-full"
        >
          <ActiveOrbUI onDisconnect={disconnect} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}
    </div>
  );
}

// ─── INACTIVE / DISCONNECTED STATE ─────────────────────────────────────────
function InactiveOrbUI({ onConnect, isConnecting }: { onConnect: () => void, isConnecting: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Pass "disconnected" or "connecting" state to control spinning */}
        <FlatHudOrb state={isConnecting ? "connecting" : "disconnected"} onClick={onConnect} />
        
        <div className="flex items-center gap-2 mt-2 h-6">
          <span className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <p className="text-sm font-medium text-foreground">
            {isConnecting ? "Connecting..." : "Tap orb to start"}
          </p>
        </div>
      </div>
      
      <Button onClick={onConnect} disabled={isConnecting} className="rounded-full px-8 shadow-md">
        {isConnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mic className="w-4 h-4 mr-2" />}
        {isConnecting ? "Starting..." : "Start Agent"}
      </Button>
    </div>
  );
}

// ─── ACTIVE / CONNECTED STATE ──────────────────────────────────────────────
function ActiveOrbUI({ onDisconnect }: { onDisconnect: () => void }) {
  const { state } = useVoiceAssistant();

  const getStatusText = () => {
    switch (state) {
      case "connecting": case "initializing": return "Waking up agent...";
      case "listening": return "Listening...";
      case "thinking": return "Thinking...";
      case "speaking": return "Agent is speaking";
      default: return "Ready";
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <div className="flex flex-col items-center gap-4">
        <FlatHudOrb state={state} onClick={onDisconnect} />
        
        <div className="flex items-center gap-2 mt-2 h-6">
          <span className={`w-2 h-2 rounded-full ${state === 'speaking' ? 'bg-emerald-500 animate-pulse' : 'bg-primary animate-pulse'}`} />
          <p className="text-sm font-medium text-foreground">{getStatusText()}</p>
        </div>
      </div>

      {/* LiveKit Control Bar (Mute / Hang Up) */}
      <div className="bg-background/80 backdrop-blur-md border border-border p-2 rounded-full shadow-lg z-10">
        <VoiceAssistantControlBar controls={{ leave: true }} />
      </div>
    </div>
  );
}

// ─── THE 2D FLAT HUD ORB COMPONENT ─────────────────────────────────────────
function FlatHudOrb({ state, onClick }: { state: string; onClick: () => void }) {
  // If the state is disconnected, pause the CSS animations
  const isSpinning = state !== "disconnected";

  // Dynamically map agent states to colors
  let orbColor = "#00FFFF"; 
  let glowColor = "rgb(59, 130, 246)";
  
  if (state === "speaking") {
    orbColor = "#10b981"; // Emerald
    glowColor = "rgba(16, 185, 129, 0.2)";
  } else if (state === "thinking") {
    orbColor = "#f59e0b"; // Amber
    glowColor = "rgba(245, 158, 11, 0.15)";
  } else if (state === "disconnected") {
    orbColor = "#00FFFF"; // Keep cyan but dimmer glow
    glowColor = "rgb(59, 130, 246)";
  }

  return (
    <div 
      className="relative flex items-center justify-center cursor-pointer select-none group transition-transform active:scale-95"
      onClick={onClick}
      title={isSpinning ? "Tap to stop agent" : "Tap to start agent"}
    >
      {/* Inject scoped CSS for spinning animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hud-spin-layer {
          transform-origin: 50% 50%;
        }
        .hud-spin-slow { animation: hud-spin 14s linear infinite; }
        .hud-spin-med { animation: hud-spin 8s linear infinite; }
        .hud-spin-fast { animation: hud-spin 4s linear infinite; }
        .hud-spin-reverse-slow { animation: hud-reverse-spin 12s linear infinite; }
        .hud-spin-reverse-fast { animation: hud-reverse-spin 6s linear infinite; }

        /* Pause all animations when data-spinning is false */
        .hud-wrapper[data-spinning="false"] .hud-spin-layer {
          animation-play-state: paused !important;
        }

        @keyframes hud-spin {
          100% { transform: rotate(360deg); }
        }
        @keyframes hud-reverse-spin {
          100% { transform: rotate(-360deg); }
        }
      `}} />

      <div 
        className="hud-wrapper relative flex items-center justify-center rounded-full transition-shadow duration-500"
        data-spinning={isSpinning}
        style={{ boxShadow: `0 0 70px ${glowColor}` }}
      >
        <svg
          width="280"
          height="280"
          viewBox="0 0 200 200"
          fill="none"
          style={{ stroke: orbColor, transition: "stroke 0.5s ease" }}
        >
          {/* Ring 1: Outer Thin Ring (Solid) */}
          <circle cx="100" cy="100" r="95" strokeWidth="1" />

          {/* Ring 2: Thick Segmented Ring */}
          <circle
            cx="100" cy="100" r="82"
            strokeWidth="5"
            pathLength="100"
            strokeDasharray="15 5 25 5 10 10 20 10"
            className="hud-spin-layer hud-spin-med"
          />

          {/* Ring 3: Thin Yellow Arc */}
          <circle
            cx="100" cy="100" r="68"
            stroke="#FFD700"
            strokeWidth="1.5"
            pathLength="100"
            strokeDasharray="60 40"
            className="hud-spin-layer hud-spin-reverse-slow"
          />

          {/* Ring 4: Medium Segmented Double Ring */}
          <circle
            cx="100" cy="100" r="54"
            strokeWidth="3"
            pathLength="100"
            strokeDasharray="30 15 15 10 20 10"
            className="hud-spin-layer hud-spin-slow"
          />
          <circle
            cx="100" cy="100" r="50"
            strokeWidth="1"
            pathLength="100"
            strokeDasharray="30 15 15 10 20 10"
            className="hud-spin-layer hud-spin-slow"
          />

          {/* Ring 5: Inner Solid Ring */}
          <circle cx="100" cy="100" r="38" strokeWidth="2" />

          {/* Ring 6: Inner Thick Yellow Arcs */}
          <circle
            cx="100" cy="100" r="26"
            stroke="#FFD700"
            strokeWidth="4"
            pathLength="100"
            strokeDasharray="25 25 25 25"
            className="hud-spin-layer hud-spin-reverse-fast"
          />

          {/* Center Target Dot */}
          <circle cx="100" cy="100" r="8" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}