"use client"

import { useState, useEffect, useRef } from "react"
import {
  MessageCircle, AlignJustify, PanelRight,
  Layers, ChevronLeft, Save, Loader2,
  Bell, Settings2, Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

// ─── Types ────────────────────────────────────────────────────────────────────

type EmbedMode = "FLOATING_BUTTON" | "INLINE" | "STICKY_BAR" | "TEASER_BUBBLE" | "SLIDE_DRAWER"

interface EmbedModeFormProps {
  onBack: () => void
  onSave: (data: any) => Promise<void>
  isLoading: boolean
  initial?: any
  onLiveUpdate?: (theme: any) => void
}

// ─── Mode Definitions ─────────────────────────────────────────────────────────

const MODES: {
  id: EmbedMode
  label: string
  description: string
  badge?: string
  preview: React.ReactNode
}[] = [
  {
    id: "FLOATING_BUTTON",
    label: "Floating Button",
    description: "Classic fixed-corner bubble. Clicks open the chat window.",
    preview: <FloatingPreview />,
  },
  {
    id: "TEASER_BUBBLE",
    label: "Teaser Bubble",
    description: "Show a greeting popup above the button to boost click-through rate.",
    badge: "+60% CTR",
    preview: <TeaserPreview />,
  },
  {
    id: "STICKY_BAR",
    label: "Sticky Bar",
    description: "Full-width bar pinned to the bottom. Highest visibility on mobile.",
    badge: "Mobile Best",
    preview: <StickyBarPreview />,
  },
  {
    id: "SLIDE_DRAWER",
    label: "Slide Drawer",
    description: "Panel slides in from the side, keeping page content visible.",
    preview: <DrawerPreview />,
  },
  {
    id: "INLINE",
    label: "Inline / Embed",
    description: "Drop the chat directly into any div — perfect for a dedicated chat page.",
    badge: "Best Conversion",
    preview: <InlinePreview />,
  },
]

// ─── Mini preview components ──────────────────────────────────────────────────

function FloatingPreview() {
  return (
    <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      <div className="absolute inset-0 flex flex-col gap-1.5 p-2 pointer-events-none">
        <div className="h-1.5 w-16 bg-gray-200 rounded" />
        <div className="h-1 w-full bg-gray-100 rounded" />
        <div className="h-1 w-4/5 bg-gray-100 rounded" />
      </div>
      <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
        <MessageCircle className="w-3.5 h-3.5 text-white fill-white" />
      </div>
      <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
    </div>
  )
}

function TeaserPreview() {
  return (
    <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      <div className="absolute inset-0 flex flex-col gap-1.5 p-2 pointer-events-none">
        <div className="h-1.5 w-16 bg-gray-200 rounded" />
        <div className="h-1 w-full bg-gray-100 rounded" />
      </div>
      <div className="absolute bottom-9 right-1.5 bg-blue-600 rounded-xl rounded-br-none px-2 py-1 shadow-lg max-w-[80px]">
        <p className="text-[6px] text-white leading-tight">👋 Need help?</p>
      </div>
      <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
        <MessageCircle className="w-3.5 h-3.5 text-white fill-white" />
      </div>
    </div>
  )
}

function StickyBarPreview() {
  return (
    <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      <div className="absolute inset-0 flex flex-col gap-1.5 p-2 pointer-events-none">
        <div className="h-1.5 w-16 bg-gray-200 rounded" />
        <div className="h-1 w-full bg-gray-100 rounded" />
        <div className="h-1 w-4/5 bg-gray-100 rounded" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-blue-600 flex items-center justify-center gap-1.5 rounded-b-lg">
        <MessageCircle className="w-2.5 h-2.5 text-white fill-white" />
        <span className="text-[6px] text-white font-medium">Chat with us →</span>
      </div>
    </div>
  )
}

function DrawerPreview() {
  return (
    <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      <div className="absolute inset-0 flex flex-col gap-1.5 p-2 pointer-events-none">
        <div className="h-1.5 w-16 bg-gray-200 rounded" />
        <div className="h-1 w-1/2 bg-gray-100 rounded" />
        <div className="h-1 w-1/2 bg-gray-100 rounded" />
      </div>
      <div className="absolute top-0 right-0 bottom-0 w-[48%] bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.1)] border-l border-gray-100 rounded-r-lg flex flex-col">
        <div className="h-4 bg-blue-600 rounded-tr-lg flex items-center px-1.5">
          <span className="text-[5px] text-white font-semibold">Assistant</span>
        </div>
        <div className="flex-1 p-1 space-y-1">
          <div className="h-1.5 w-3/4 bg-blue-100 rounded-full" />
          <div className="h-1.5 w-1/2 bg-gray-100 rounded-full ml-auto" />
        </div>
        <div className="h-3 bg-gray-50 border-t border-gray-100 rounded-br-lg" />
      </div>
    </div>
  )
}

function InlinePreview() {
  return (
    <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden flex flex-col gap-1 p-1.5">
      <div className="h-1.5 w-16 bg-gray-200 rounded" />
      <div className="flex-1 bg-white border border-gray-200 rounded-md shadow-sm flex flex-col">
        <div className="h-4 bg-blue-600 rounded-t-md flex items-center px-1.5">
          <span className="text-[5px] text-white font-semibold">Assistant • Live</span>
        </div>
        <div className="flex-1 p-1 space-y-1">
          <div className="h-1.5 w-3/4 bg-blue-100 rounded-full" />
          <div className="h-1.5 w-1/2 bg-gray-100 rounded-full ml-auto" />
        </div>
        <div className="h-3 bg-gray-50 border-t border-gray-100 rounded-b-md" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmbedModeForm({ onBack, onSave, isLoading, initial, onLiveUpdate }: EmbedModeFormProps) {
  const [embedMode, setEmbedMode] = useState<EmbedMode>("FLOATING_BUTTON")
  const [settings, setSettings] = useState({
    // Teaser
    teaserEnabled: true,
    teaserMessage: "👋 Hi! Need help finding what you're looking for?",
    teaserDelay: 3,
    teaserBgColor: "#111CA8",
    teaserTextColor: "#ffffff",
    teaserCtaYes: "Yes, help me",
    teaserCtaNo: "Not now",
    // Sticky Bar
    stickyBarText: "💬 Chat with us — we reply instantly",
    stickyBarBgColor: "#111CA8",
    stickyBarTextColor: "#ffffff",
    stickyBarPosition: "bottom",
    stickyBarCtaText: "Start chat →",
    // Drawer
    drawerSide: "right",
    drawerWidth: 380,
    drawerTabText: "Chat",
    drawerTabBgColor: "#111CA8",
  })

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  // Load initial values
  useEffect(() => {
    if (initial && !isInitializedRef.current) {
      isInitializedRef.current = true
      if (initial.embedMode) setEmbedMode(initial.embedMode as EmbedMode)
      setSettings({
        teaserEnabled:    initial.teaserEnabled    ?? true,
        teaserMessage:    initial.teaserMessage    ?? "👋 Hi! Need help finding what you're looking for?",
        teaserDelay:      initial.teaserDelay      ?? 3,
        teaserBgColor:    initial.teaserBgColor    ?? "#111CA8",
        teaserTextColor:  initial.teaserTextColor  ?? "#ffffff",
        teaserCtaYes:     initial.teaserCtaYes     ?? "Yes, help me",
        teaserCtaNo:      initial.teaserCtaNo      ?? "Not now",
        stickyBarText:    initial.stickyBarText    ?? "💬 Chat with us — we reply instantly",
        stickyBarBgColor: initial.stickyBarBgColor ?? "#111CA8",
        stickyBarTextColor: initial.stickyBarTextColor ?? "#ffffff",
        stickyBarPosition: initial.stickyBarPosition ?? "bottom",
        stickyBarCtaText:  initial.stickyBarCtaText  ?? "Start chat →",
        drawerSide:      initial.drawerSide      ?? "right",
        drawerWidth:     initial.drawerWidth     ?? 380,
        drawerTabText:   initial.drawerTabText   ?? "Chat",
        drawerTabBgColor: initial.drawerTabBgColor ?? "#111CA8",
      })
    }
  }, [initial])

  const triggerLiveUpdate = (newMode: EmbedMode, newSettings: typeof settings) => {
    if (!onLiveUpdate) return
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
    updateTimeoutRef.current = setTimeout(() => {
      onLiveUpdate({
        embedMode: newMode,
        ...newSettings,
      })
    }, 150)
  }

  const handleModeChange = (mode: EmbedMode) => {
    setEmbedMode(mode)
    triggerLiveUpdate(mode, settings)
  }

  const handleSettingChange = (key: string, value: any) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    triggerLiveUpdate(embedMode, updated)
  }

  const handleSave = async () => {
    await onSave({
      embedMode,
      ...settings,
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-sm font-semibold">Embed Style</h2>
          <p className="text-xs text-muted-foreground">Choose how the chatbot appears on your site</p>
        </div>
      </div>

      {/* Mode Selector Grid */}
      <div className="grid grid-cols-1 gap-2.5">
        {MODES.map((mode) => {
          const isSelected = embedMode === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeChange(mode.id)}
              className={[
                "relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer",
                "hover:shadow-md",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40",
              ].join(" ")}
            >
              {/* Mini preview thumbnail */}
              <div className="w-[72px] h-[52px] shrink-0 rounded-lg overflow-hidden border border-border/50">
                {mode.preview}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{mode.label}</span>
                  {mode.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                      {mode.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{mode.description}</p>
              </div>

              {/* Check */}
              <div className={[
                "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30",
              ].join(" ")}>
                {isSelected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Per-Mode Settings */}
      {embedMode === "TEASER_BUBBLE" && (
        <ModeSettingsCard title="Teaser Bubble Settings" icon={<Bell className="w-4 h-4" />}>
          <div className="space-y-4">
            <SettingRow label="Enable teaser" description="Show popup before user clicks">
              <Switch
                checked={settings.teaserEnabled}
                onCheckedChange={(v) => handleSettingChange("teaserEnabled", v)}
              />
            </SettingRow>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Teaser Message</Label>
              <Input
                value={settings.teaserMessage}
                onChange={(e) => handleSettingChange("teaserMessage", e.target.value)}
                placeholder="👋 Hi! Need help?"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Appear after: {settings.teaserDelay}s</Label>
              <Slider
                min={0} max={30} step={1}
                value={[settings.teaserDelay]}
                onValueChange={([v]) => handleSettingChange("teaserDelay", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Background</Label>
                <ColorInput value={settings.teaserBgColor} onChange={(v) => handleSettingChange("teaserBgColor", v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Text Color</Label>
                <ColorInput value={settings.teaserTextColor} onChange={(v) => handleSettingChange("teaserTextColor", v)} />
              </div>
            </div>

            <div className="pt-1 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground mb-2.5 font-medium uppercase tracking-wide">CTA Buttons</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Accept button</Label>
                  <Input
                    value={settings.teaserCtaYes}
                    onChange={(e) => handleSettingChange("teaserCtaYes", e.target.value)}
                    placeholder="Yes, help me"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Dismiss button</Label>
                  <Input
                    value={settings.teaserCtaNo}
                    onChange={(e) => handleSettingChange("teaserCtaNo", e.target.value)}
                    placeholder="Not now"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </ModeSettingsCard>
      )}

      {embedMode === "STICKY_BAR" && (
        <ModeSettingsCard title="Sticky Bar Settings" icon={<AlignJustify className="w-4 h-4" />}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Bar Text</Label>
              <Input
                value={settings.stickyBarText}
                onChange={(e) => handleSettingChange("stickyBarText", e.target.value)}
                placeholder="💬 Chat with us"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">CTA Button Text</Label>
              <Input
                value={settings.stickyBarCtaText}
                onChange={(e) => handleSettingChange("stickyBarCtaText", e.target.value)}
                placeholder="Start chat →"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Position</Label>
              <Select value={settings.stickyBarPosition} onValueChange={(v) => handleSettingChange("stickyBarPosition", v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Background</Label>
                <ColorInput value={settings.stickyBarBgColor} onChange={(v) => handleSettingChange("stickyBarBgColor", v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Text Color</Label>
                <ColorInput value={settings.stickyBarTextColor} onChange={(v) => handleSettingChange("stickyBarTextColor", v)} />
              </div>
            </div>
          </div>
        </ModeSettingsCard>
      )}

      {embedMode === "SLIDE_DRAWER" && (
        <ModeSettingsCard title="Slide Drawer Settings" icon={<PanelRight className="w-4 h-4" />}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Open from side</Label>
              <Select value={settings.drawerSide} onValueChange={(v) => handleSettingChange("drawerSide", v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Drawer width: {settings.drawerWidth}px</Label>
              <Slider
                min={280} max={520} step={10}
                value={[settings.drawerWidth]}
                onValueChange={([v]) => handleSettingChange("drawerWidth", v)}
              />
            </div>

            <div className="pt-1 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground mb-2.5 font-medium uppercase tracking-wide">Tab Button</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tab Label</Label>
                  <Input
                    value={settings.drawerTabText}
                    onChange={(e) => handleSettingChange("drawerTabText", e.target.value)}
                    placeholder="Chat"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tab Color</Label>
                  <ColorInput value={settings.drawerTabBgColor} onChange={(v) => handleSettingChange("drawerTabBgColor", v)} />
                </div>
              </div>
            </div>
          </div>
        </ModeSettingsCard>
      )}

      {embedMode === "INLINE" && (
        <ModeSettingsCard title="Inline Embed — How to Use" icon={<Layers className="w-4 h-4" />}>
          <div className="space-y-4">

            {/* What is inline */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Place a <code className="px-1 py-0.5 bg-muted rounded text-[11px] font-mono">div</code> anywhere on your page and the chatbot fills it — no floating button, no popup.
              <strong className="text-foreground"> Height is required.</strong>
            </p>

            {/* Use cases */}
            <div className="space-y-2.5">

              {/* Case 1 — Basic */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Basic — anywhere on page</span>
                </div>
                <pre className="bg-zinc-950 text-zinc-100 p-3 text-[10px] leading-relaxed overflow-x-auto font-mono">{`<div id="my-chat" style="height:600px"></div>

<script src="embed.js"
  data-chatbot-id="YOUR_ID"
  data-mode="inline"
  data-container="my-chat">
</script>`}</pre>
              </div>

              {/* Case 2 — Sidebar */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sidebar — sticky panel</span>
                </div>
                <pre className="bg-zinc-950 text-zinc-100 p-3 text-[10px] leading-relaxed overflow-x-auto font-mono">{`<aside style="width:380px; position:sticky; top:20px">
  <div id="chat-sidebar" style="height:580px;
    border-radius:16px; overflow:hidden">
  </div>
</aside>

<script src="embed.js"
  data-chatbot-id="YOUR_ID"
  data-mode="inline"
  data-container="chat-sidebar">
</script>`}</pre>
              </div>

              {/* Case 3 — Dedicated page */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Full page — dedicated chat page</span>
                </div>
                <pre className="bg-zinc-950 text-zinc-100 p-3 text-[10px] leading-relaxed overflow-x-auto font-mono">{`<div id="chat-page"
  style="height:100vh; width:100%">
</div>

<script src="embed.js"
  data-chatbot-id="YOUR_ID"
  data-mode="inline"
  data-container="chat-page">
</script>`}</pre>
              </div>

              {/* Case 4 — Auto detect */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Auto-detect — no container id needed</span>
                </div>
                <pre className="bg-zinc-950 text-zinc-100 p-3 text-[10px] leading-relaxed overflow-x-auto font-mono">{`<!-- Add this attribute to any div -->
<div data-chatbot-inline style="height:600px">
</div>

<!-- Script finds it automatically -->
<script src="embed.js"
  data-chatbot-id="YOUR_ID"
  data-mode="inline">
</script>`}</pre>
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">Important Notes</p>
              <ul className="space-y-1">
                {[
                  "Container div must have an explicit height (e.g. height:600px)",
                  "Width is optional — defaults to 100% of the container",
                  "Script tag should be placed AFTER the container div",
                  "Go to Integrations page for framework-specific code (React, Next.js etc.)",
                ].map((note, i) => (
                  <li key={i} className="text-[10px] text-amber-700 flex gap-1.5">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </ModeSettingsCard>
      )}

      {embedMode === "FLOATING_BUTTON" && (
        <ModeSettingsCard title="Floating Button" icon={<Settings2 className="w-4 h-4" />}>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Use the <strong>Chat Widget</strong> tab to customize the button size, shape, position, and colors.
          </p>
        </ModeSettingsCard>
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={isLoading}
        className="w-full h-10 font-semibold"
      >
        {isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
        ) : (
          <><Save className="mr-2 h-4 w-4" /> Save Embed Style</>
        )}
      </Button>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ModeSettingsCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/10 bg-primary/10">
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-semibold text-primary">{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 border border-border rounded-lg px-2 py-1.5 bg-background cursor-pointer h-9">
      <label className="flex items-center gap-2 cursor-pointer w-full">
        <div
          className="w-5 h-5 rounded border border-border/60 shrink-0"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ opacity: 0, position: 'absolute', width: 0, height: 0, border: 'none', padding: 0 }}
        />
        <span className="text-xs font-mono text-muted-foreground truncate">{value}</span>
      </label>
    </div>
  )
}
