"use client";

import { useState, useCallback } from "react";
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  VoiceAssistantControlBar,
  useVoiceAssistant
} from "@livekit/components-react";
import { Loader2, Mic, RefreshCw, Phone, PhoneCall, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import "@livekit/components-styles";

export default function VoiceAgentPreview({ agentId }: { agentId: string }) {
  // UI View State
  const [previewMode, setPreviewMode] = useState<"web" | "phone">("web");
  
  // WebRTC (Browser) State
  const [connectionDetails, setConnectionDetails] = useState<{ token: string; url: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Outbound Phone State
  const [testPhone, setTestPhone] = useState("");
  const [isDialing, setIsDialing] = useState(false);

  // ─── WebRTC Handlers ──────────────────────────────────────────────────────
  const connectToWebAgent = async () => {
    if (isConnecting || connectionDetails) return;
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/voice-agents/${agentId}/preview`);
      if (!res.ok) throw new Error("Failed to get preview token");
      const data = await res.json();
      setConnectionDetails({ token: data.token, url: data.url });
    } catch (error) {
      toast.error("Could not start web preview session.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWebAgent = useCallback(() => {
    setConnectionDetails(null);
  }, []);

  // ─── Outbound Phone Handlers ──────────────────────────────────────────────
  const handleDialPhone = async () => {
    if (!testPhone.trim()) {
      toast.error("Please enter a valid phone number");
      return;
    }
    
    setIsDialing(true);
    try {
      const res = await fetch('/api/campaigns/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          prospectNumber: testPhone.trim(),
          prospectName: "System Tester",
          leadSource: "Dashboard Preview Panel"
        })
      });

      if (!res.ok) throw new Error("Dialer API failed");
      toast.success(`Ringing ${testPhone}...`);
      
      // Auto-reset the visual dialing state after 15 seconds
      setTimeout(() => setIsDialing(false), 15000);
    } catch (error) {
      toast.error("Failed to initiate outbound call. Check SIP trunk settings.");
      setIsDialing(false);
    }
  };

  const resetAll = () => {
    disconnectWebAgent();
    setIsDialing(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-background relative overflow-hidden">
      {/* ─── PREVIEW CONTROLS HEADER (TOOLBAR) ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {previewMode === "web" ? (
              <Mic className="h-3 w-3" />
            ) : (
              <PhoneOutgoing className="h-3 w-3" />
            )}
            <span className="text-[10px] font-semibold">
              {previewMode === "web" ? "WebRTC Preview" : "Telecom Preview"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={previewMode === "web" ? "secondary" : "ghost"} 
            size="icon"
            className="h-7 w-7"
            onClick={() => { setPreviewMode("web"); resetAll(); }}
            title="Browser WebRTC Preview"
          >
            <Mic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={previewMode === "phone" ? "secondary" : "ghost"} 
            size="icon"
            className="h-7 w-7"
            onClick={() => { setPreviewMode("phone"); resetAll(); }}
            title="Outbound Telecom Preview"
          >
            <PhoneOutgoing className="h-3.5 w-3.5" />
          </Button>
          <div className="w-[1px] h-4 bg-border mx-1" />
          <Button
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={resetAll}
            title="Reset"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── MAIN PREVIEW AREA ─── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 relative">
        
        {/* MODE: BROWSER WEBRTC */}
        {previewMode === "web" && (
          !connectionDetails ? (
            <InactiveOrbUI onConnect={connectToWebAgent} isConnecting={isConnecting} />
          ) : (
            <LiveKitRoom
              serverUrl={connectionDetails.url}
              token={connectionDetails.token}
              connect={true}
              audio={true}
              video={false}
              onDisconnected={disconnectWebAgent}
              className="flex flex-col items-center justify-center w-full h-full"
            >
              <ActiveOrbUI onDisconnect={disconnectWebAgent} />
              <RoomAudioRenderer />
            </LiveKitRoom>
          )
        )}

        {/* MODE: OUTBOUND PHONE NETWORK */}
        {previewMode === "phone" && (
          <div className="w-full max-w-sm px-6 animate-in fade-in zoom-in-95 duration-300">
            {!isDialing ? (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                  <PhoneCall className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight mb-2">Live Network Test</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your phone number to have the AI call you directly over the actual telecom network using your SIP Trunk.
                  </p>
                </div>
                <div className="flex w-full items-center gap-2">
                  <Input 
                    type="tel"
                    placeholder="+919876543210" 
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleDialPhone} disabled={!testPhone.trim()}>
                    <Phone className="w-4 h-4 mr-2" />
                    Dial
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-8">
                {/* Reusing the orb purely for visual effect while ringing */}
                <LiquidMorphOrb state="speaking" onClick={() => setIsDialing(false)} />
                <div className="text-center space-y-2">
                  <p className="font-semibold text-lg text-emerald-500 animate-pulse">Ringing your phone...</p>
                  <p className="text-sm text-muted-foreground">Answer the call on your device to speak with the agent.</p>
                </div>
                <Button variant="outline" className="rounded-full" onClick={() => setIsDialing(false)}>
                  Cancel Visual Test
                </Button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── INACTIVE / DISCONNECTED STATE (WEB MODE) ──────────────────────────────
function InactiveOrbUI({ onConnect, isConnecting }: { onConnect: () => void, isConnecting: boolean }) {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-6 mt-8">
        <LiquidMorphOrb state={isConnecting ? "connecting" : "disconnected"} onClick={onConnect} />
        
        <div className="flex items-center gap-2 h-6">
          <span className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <p className="text-sm font-medium text-foreground">
            {isConnecting ? "Connecting to LiveKit..." : "Tap orb to start browser session"}
          </p>
        </div>
      </div>
      
      <Button onClick={onConnect} disabled={isConnecting} className="rounded-full px-8 shadow-md">
        {isConnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mic className="w-4 h-4 mr-2" />}
        {isConnecting ? "Starting..." : "Start Web Preview"}
      </Button>
    </div>
  );
}

// ─── ACTIVE / CONNECTED STATE (WEB MODE) ───────────────────────────────────
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
    <div className="flex flex-col items-center gap-8 w-full max-w-sm animate-in zoom-in-95 duration-300">
      <div className="flex flex-col items-center gap-6 mt-8">
        <LiquidMorphOrb state={state} onClick={onDisconnect} />
        
        <div className="flex items-center gap-2 h-6">
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

// ─── THE LIQUID MORPH ORB COMPONENT ────────────────────────────────────────
function LiquidMorphOrb({ state, onClick }: { state: string; onClick: () => void }) {
  const isSpinning = state !== "disconnected";

  return (
    <div 
      className="relative flex items-center justify-center cursor-pointer transition-transform active:scale-95"
      onClick={onClick}
      title={isSpinning ? "Tap to stop agent" : "Tap to start agent"}
      style={{ width: "200px", height: "200px" }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .voice-loader {
          --color-one: #ffbf48;
          --color-two: #be4a1d;
          --color-three: #ffbf4780;
          --color-four: #bf4a1d80;
          --color-five: #ffbf4740;
          --time-animation: 2s;
          --size: 1.8; 
          position: relative;
          border-radius: 50%;
          transform: scale(var(--size));
          box-shadow: 0 0 25px 0 var(--color-three), 0 20px 50px 0 var(--color-four);
          animation: colorize calc(var(--time-animation) * 3) ease-in-out infinite;
        }

        /* Dynamic Speed based on State */
        .voice-loader[data-state="speaking"] {
          --time-animation: 1s; /* Spin much faster when speaking */
        }
        .voice-loader[data-state="thinking"] {
          --time-animation: 3.5s; /* Slow down while thinking */
        }

        /* Paused State */
        .voice-loader[data-spinning="false"],
        .voice-loader[data-spinning="false"] .box,
        .voice-loader[data-spinning="false"] svg #clipping,
        .voice-loader[data-spinning="false"] svg #clipping polygon {
          animation-play-state: paused !important;
        }
        .voice-loader[data-state="disconnected"] {
          box-shadow: 0 0 10px 0 var(--color-three); 
        }

        .voice-loader::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          border-top: solid 1px var(--color-one);
          border-bottom: solid 1px var(--color-two);
          background: linear-gradient(180deg, var(--color-five), var(--color-four));
          box-shadow: inset 0 10px 10px 0 var(--color-three), inset 0 -10px 10px 0 var(--color-four);
        }

        .voice-loader .box {
          width: 100px;
          height: 100px;
          background: linear-gradient(180deg, var(--color-one) 30%, var(--color-two) 70%);
          mask: url(#clipping);
          -webkit-mask: url(#clipping);
        }

        .voice-loader svg {
          position: absolute;
        }

        .voice-loader svg #clipping {
          filter: contrast(15);
          animation: roundness calc(var(--time-animation) / 2) linear infinite;
        }

        .voice-loader svg #clipping polygon {
          filter: blur(7px);
        }

        .voice-loader svg #clipping polygon:nth-child(1) { transform-origin: 75% 25%; transform: rotate(90deg); }
        .voice-loader svg #clipping polygon:nth-child(2) { transform-origin: 50% 50%; animation: rotation var(--time-animation) linear infinite reverse; }
        .voice-loader svg #clipping polygon:nth-child(3) { transform-origin: 50% 60%; animation: rotation var(--time-animation) linear infinite; animation-delay: calc(var(--time-animation) / -3); }
        .voice-loader svg #clipping polygon:nth-child(4) { transform-origin: 40% 40%; animation: rotation var(--time-animation) linear infinite reverse; }
        .voice-loader svg #clipping polygon:nth-child(5) { transform-origin: 40% 40%; animation: rotation var(--time-animation) linear infinite reverse; animation-delay: calc(var(--time-animation) / -2); }
        .voice-loader svg #clipping polygon:nth-child(6) { transform-origin: 60% 40%; animation: rotation var(--time-animation) linear infinite; }
        .voice-loader svg #clipping polygon:nth-child(7) { transform-origin: 60% 40%; animation: rotation var(--time-animation) linear infinite; animation-delay: calc(var(--time-animation) / -1.5); }

        @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes roundness { 0%, 60%, 100% { filter: contrast(15); } 20%, 40% { filter: contrast(3); } }
        
        @keyframes colorize {
          0% { filter: hue-rotate(0deg); }
          20% { filter: hue-rotate(-30deg); }
          40% { filter: hue-rotate(-60deg); }
          60% { filter: hue-rotate(-90deg); }
          80% { filter: hue-rotate(-45deg); }
          100% { filter: hue-rotate(0deg); }
        }
      `}} />

      <div className="voice-loader" data-state={state} data-spinning={isSpinning}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <defs>
            <mask id="clipping">
              <polygon points="0,0 100,0 100,100 0,100" fill="black" />
              <polygon points="25,25 75,25 50,75" fill="white" />
              <polygon points="50,25 75,75 25,75" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
            </mask>
          </defs>
        </svg>
        <div className="box"></div>
      </div>
    </div>
  );
}