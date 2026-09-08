"use client"

import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Mic, Cpu, Check, Bot, User, PhoneCall, ChevronLeft } from "lucide-react"

const VOICE_DIRECTIVE_PLACEHOLDER = `Example:
You are Sarah, a helpful receptionist for Acme Corp.

Your tone: warm, professional, and concise. Because you are speaking over the phone, keep your sentences short and natural. Do NOT use markdown, bullet points, or complex formatting.

What you help with: routing calls, taking messages, and answering basic FAQs based on your knowledge base. 

If you don't know the answer, politely offer to take a message or transfer them to a human agent.`;

const VOICE_TEMPLATES: { label: string; value: (name: string) => string }[] = [
  {
    label: '📞 Inbound Support',
    value: (name) => `You are ${name}, a customer support agent.
Your tone: Empathetic, clear, and efficient. 
Instructions: You are talking on the phone. Keep responses to 1-2 short sentences. Do not use lists or special characters. If a user is frustrated, validate their feelings. Answer questions strictly using your provided knowledge base. If you cannot solve the issue, tell the user you will escalate it to a human.`,
  },
  {
    label: '📅 Appointment Booking',
    value: (name) => `You are ${name}, a receptionist for a clinic/office.
Your tone: Friendly, polite, and organized.
Instructions: You are talking on the phone. Your main goal is to help the caller schedule, reschedule, or cancel an appointment. Ask for one piece of information at a time (e.g., "What day works best for you?"). Keep sentences very brief.`,
  },
  {
    label: '💼 Outbound Sales',
    value: (name) => `You are ${name}, a sales representative.
Your tone: Upbeat, confident, and engaging.
Instructions: You are speaking on the phone. Speak naturally, using conversational fillers like "I see" or "Got it" sparingly. Your goal is to qualify the lead by asking 2-3 brief questions about their needs. Do not monologue. End your turns with a clear, short question to keep the conversation moving.`,
  },
];

const GEMINI_VOICES = [
  { id: "Puck", name: "Puck", description: "Neutral, friendly, and balanced" },
  { id: "Charon", name: "Charon", description: "Deep, resonant male voice" },
  { id: "Kore", name: "Kore", description: "Calm, clear female voice" },
  { id: "Fenrir", name: "Fenrir", description: "Bright, energetic male voice" },
  { id: "Aoede", name: "Aoede", description: "Warm, conversational female voice" },
];

export default function VoiceAgentCustomizationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [agentName, setAgentName] = useState("");
  const [voiceId, setVoiceId] = useState("Puck");
  const [firstSpeaker, setFirstSpeaker] = useState("agent");
  const [greeting, setGreeting] = useState("");
  const [directive, setDirective] = useState("");

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/voice-agents/${id}`);
        if (!res.ok) throw new Error('Failed to fetch voice agent');
        const data = await res.json();
        
        if (data.voiceAgent) {
          setPhoneNumber(data.voiceAgent.phoneNumber || "");
          setAgentName(data.voiceAgent.agentName || "");
          setVoiceId(data.voiceAgent.voiceId || "Puck");
          setFirstSpeaker(data.voiceAgent.firstSpeaker || "agent");
          setGreeting(data.voiceAgent.greeting || "");
          setDirective(data.voiceAgent.directive || "");
        }
      } catch (error) {
        toast.error("Could not load agent settings");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchAgent();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/voice-agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, voiceId, firstSpeaker, greeting, directive }),
      });
      
      if (!res.ok) throw new Error("Failed to save changes");
      toast.success("Voice agent updated successfully!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground" onClick={() => router.push('/voice-agents')}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Agents
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configure Voice Agent</h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <PhoneCall className="w-4 h-4 text-emerald-500" />
              Active on: <span className="font-mono text-emerald-500">{phoneNumber}</span>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="shadow-md">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ── Identity & Voice ── */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="agentName" className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-500" /> Agent Name
            </Label>
            <Input
              id="agentName"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. Sarah"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-blue-500" /> Voice Model
            </Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">{v.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Call Flow ── */}
        <div className="space-y-6 p-5 border rounded-xl bg-muted/20">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Call Flow</Label>
            <p className="text-xs text-muted-foreground mb-2">Who speaks first when the phone connects?</p>
            
            <RadioGroup value={firstSpeaker} onValueChange={setFirstSpeaker} className="flex flex-col gap-3">
              <div className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer transition-colors ${firstSpeaker === 'agent' ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50'}`} onClick={() => setFirstSpeaker("agent")}>
                <RadioGroupItem value="agent" id="agent" />
                <Label htmlFor="agent" className="flex items-center gap-2 cursor-pointer w-full">
                  <Bot className="w-4 h-4 text-primary" /> AI Greets Caller First
                </Label>
              </div>
              <div className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer transition-colors ${firstSpeaker === 'user' ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50'}`} onClick={() => setFirstSpeaker("user")}>
                <RadioGroupItem value="user" id="user" />
                <Label htmlFor="user" className="flex items-center gap-2 cursor-pointer w-full">
                  <User className="w-4 h-4 text-emerald-500" /> Wait for Caller to Speak
                </Label>
              </div>
            </RadioGroup>
          </div>

          {firstSpeaker === "agent" && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label>Greeting Message</Label>
              <Textarea 
                value={greeting} 
                onChange={(e) => setGreeting(e.target.value)} 
                className="resize-none h-20"
                placeholder="e.g. Thanks for calling! How can I help you today?" 
              />
            </div>
          )}
        </div>
      </div>

      <hr />

      {/* ── Directive ── */}
      <div className="space-y-3">
        <Label htmlFor="directive" className="flex items-center gap-2 text-base">
          <Cpu className="h-5 w-5 text-amber-500" />
          Voice Instructions & Personality
        </Label>
        
        <div className="flex flex-wrap gap-2 pb-1">
          {VOICE_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => setDirective(tpl.value(agentName || 'Agent'))}
              className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {tpl.label}
            </button>
          ))}
        </div>

        <Textarea
          id="directive"
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          className="min-h-[300px] font-mono text-sm resize-none"
          placeholder={VOICE_DIRECTIVE_PLACEHOLDER}
        />
        <div className="flex justify-between text-xs text-muted-foreground pl-0.5">
          <span>Remember: Instruct the AI to keep answers short for optimal voice latency.</span>
          <span className="font-mono tabular-nums">{directive.length} chars</span>
        </div>
      </div>
    </div>
  );
}