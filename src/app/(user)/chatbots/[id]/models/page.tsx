'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { Loader2, RefreshCw, Zap, Brain, Gauge, FlaskConical, Check } from "lucide-react";
import { useChatbot } from '@/hooks/useChatbot'; // ← use the hook

// ─── Model definitions ────────────────────────────────────────────────────────

type ModelTier = 'pro' | 'flash' | 'flash-lite' | 'experimental';

interface GeminiModel {
  id: string;
  name: string;
  desc: string;
  tier: ModelTier;
  contextWindow?: string;
  tag?: 'recommended' | 'preview' | 'deprecated';
  group: string;
}

const GEMINI_MODELS: GeminiModel[] = [
  // ── Gemini 2.5 ──────────────────────────────────────────────────────────
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    desc: 'Most advanced — deep reasoning & coding',
    tier: 'pro',
    contextWindow: '1M',
    group: 'Gemini 2.5',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    desc: 'Best price-performance with reasoning',
    tier: 'flash',
    contextWindow: '1M',
    tag: 'recommended',
    group: 'Gemini 2.5',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    desc: 'Fastest & most budget-friendly in 2.5',
    tier: 'flash-lite',
    contextWindow: '1M',
    group: 'Gemini 2.5',
  },
  // ── Gemini 2.0 (deprecated soon) ────────────────────────────────────────
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    desc: 'Workhorse — speed + native tool use',
    tier: 'flash',
    contextWindow: '1M',
    tag: 'deprecated',
    group: 'Gemini 2.0',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    desc: 'Fastest & most cost-efficient gen-2',
    tier: 'flash-lite',
    contextWindow: '1M',
    tag: 'deprecated',
    group: 'Gemini 2.0',
  },
  // ── Gemini 1.5 ──────────────────────────────────────────────────────────
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    desc: 'Complex reasoning & deep analysis',
    tier: 'pro',
    contextWindow: '2M',
    group: 'Gemini 1.5',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    desc: 'Fast & versatile multimodal',
    tier: 'flash',
    contextWindow: '1M',
    group: 'Gemini 1.5',
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash 8B',
    desc: 'Ultra-lightweight for simple tasks',
    tier: 'flash-lite',
    contextWindow: '1M',
    group: 'Gemini 1.5',
  },
];

const TIER_ICONS: Record<ModelTier, React.ReactNode> = {
  pro:         <Brain className="h-3.5 w-3.5 text-purple-500" />,
  flash:       <Zap className="h-3.5 w-3.5 text-yellow-500" />,
  'flash-lite':<Gauge className="h-3.5 w-3.5 text-green-500" />,
  experimental:<FlaskConical className="h-3.5 w-3.5 text-blue-400" />,
};

const TAG_STYLES: Record<string, string> = {
  recommended: 'bg-green-100 text-green-700 border-green-200',
  preview:     'bg-blue-100 text-blue-700 border-blue-200',
  deprecated:  'bg-orange-100 text-orange-700 border-orange-200',
};

// Group models for the Select
const MODEL_GROUPS = Array.from(
  GEMINI_MODELS.reduce((acc, m) => {
    if (!acc.has(m.group)) acc.set(m.group, []);
    acc.get(m.group)!.push(m);
    return acc;
  }, new Map<string, GeminiModel[]>())
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModelSelectionPage() {
  const { id } = useParams<{ id: string }>();

  // ── Use the hook instead of raw fetch ─────────────────────────────────────
  const { chatbot, isLoadingChatbot, refetchChatbot } = useChatbot({
    chatbotId: id,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature]     = useState(0.7);
  const [maxTokens, setMaxTokens]         = useState(2048);
  const [saving, setSaving]               = useState(false);
  const [liveFetchStatus, setLiveFetchStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  // Sync state from hook data once loaded
  useEffect(() => {
    if (!chatbot) return;
    if (chatbot.model)       setSelectedModel(chatbot.model);
    if (chatbot.temperature) setTemperature(chatbot.temperature);
    if (chatbot.max_tokens)  setMaxTokens(chatbot.max_tokens);
  }, [chatbot]);

  // ── Attempt live model fetch from Gemini API ───────────────────────────────
  // The Gemini models endpoint requires an API key, so this will only work if
  // you expose a proxy route at /api/gemini/models. Gracefully falls back to
  // the hardcoded list if unavailable.
  const [availableModels, setAvailableModels] = useState<GeminiModel[]>(GEMINI_MODELS);

  const fetchLiveModels = async () => {
    setLiveFetchStatus('loading');
    try {
      const res = await fetch('/api/gemini/models');
      if (!res.ok) throw new Error('proxy unavailable');
      const data = await res.json();

      // Google returns { models: [{ name: 'models/gemini-...', displayName, ... }] }
      const liveIds = new Set<string>(
        (data.models ?? [])
          .map((m: any) => m.name?.replace('models/', ''))
          .filter(Boolean)
      );

      // Merge: mark models not returned by live API, append any unknown ones
      const merged = GEMINI_MODELS.map(m => ({
        ...m,
        ...(liveIds.has(m.id) ? {} : { tag: 'deprecated' as const }),
      }));

      // Add any live models we don't have metadata for yet
      liveIds.forEach(id => {
        if (!GEMINI_MODELS.find(m => m.id === id) && id.startsWith('gemini')) {
          merged.push({
            id,
            name: id,
            desc: 'Live model',
            tier: id.includes('pro') ? 'pro' : id.includes('lite') ? 'flash-lite' : 'flash',
            group: 'Other',
            tag: 'preview',
          });
        }
      });

      setAvailableModels(merged);
      setLiveFetchStatus('done');
      toast.success('Model list refreshed from Gemini API');
    } catch {
      setLiveFetchStatus('error');
      toast.info('Using built-in model list (live fetch unavailable)');
    }
  };

  const selectedModelInfo = availableModels.find(m => m.id === selectedModel);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.append('model', selectedModel);
    formData.append('temperature', temperature.toString());
    formData.append('max_tokens', maxTokens.toString());

    try {
      const res = await fetch(`/api/chatbots/${id}`, {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to update');
      await refetchChatbot();
      toast.success('Model settings saved!');
    } catch {
      toast.error('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoadingChatbot) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Model picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="model">Gemini Model</Label>
          <button
            type="button"
            onClick={fetchLiveModels}
            disabled={liveFetchStatus === 'loading'}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${liveFetchStatus === 'loading' ? 'animate-spin' : ''}`} />
            {liveFetchStatus === 'loading' ? 'Fetching…' : 'Refresh from API'}
          </button>
        </div>

        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger id="model" className="w-full h-auto py-2.5">
            <SelectValue>
              {selectedModelInfo && (
                <div className="flex items-center gap-2">
                  {TIER_ICONS[selectedModelInfo.tier]}
                  <span className="font-medium">{selectedModelInfo.name}</span>
                  {selectedModelInfo.tag && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TAG_STYLES[selectedModelInfo.tag]}`}>
                      {selectedModelInfo.tag}
                    </span>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>

          <SelectContent className="max-h-80">
            {MODEL_GROUPS.map(([group, models]) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group}
                </SelectLabel>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="py-2.5">
                    <div className="flex items-start gap-2.5 w-full">
                      <div className="mt-0.5 shrink-0">{TIER_ICONS[m.tier]}</div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{m.name}</span>
                          {m.tag && (
                            <span className={`text-[10px] px-1.5 py-0 rounded border font-medium leading-5 ${TAG_STYLES[m.tag]}`}>
                              {m.tag}
                            </span>
                          )}
                          {m.contextWindow && (
                            <span className="text-[10px] text-muted-foreground">
                              {m.contextWindow} ctx
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{m.desc}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {/* Selected model summary */}
        {selectedModelInfo && (
          <p className="text-xs text-muted-foreground pl-1">
            {selectedModelInfo.desc}
            {selectedModelInfo.contextWindow && ` · ${selectedModelInfo.contextWindow} token context window`}
          </p>
        )}
      </div>

      <hr />

      {/* Temperature */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-medium tabular-nums w-8 text-right">
              {temperature.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              {temperature <= 0.3 ? 'Precise' : temperature <= 0.6 ? 'Balanced' : temperature <= 0.8 ? 'Creative' : 'Experimental'}
            </span>
          </div>
        </div>
        <Slider
          value={[temperature]}
          min={0} max={1} step={0.1}
          onValueChange={(v) => setTemperature(v[0])}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
          <span>Deterministic</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Max tokens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Max Output Tokens</Label>
          <span className="text-sm font-mono font-medium tabular-nums">
            {maxTokens.toLocaleString()}
          </span>
        </div>
        <Slider
          value={[maxTokens]}
          min={256} max={8192} step={256}
          onValueChange={(v) => setMaxTokens(v[0])}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
          <span>Short (256)</span>
          <span>Long (8,192)</span>
        </div>
      </div>

      {/* ── Save ── */}
      <div className="pt-4 border-t">
        <Button
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}