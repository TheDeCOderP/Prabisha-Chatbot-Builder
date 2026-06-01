"use client"

import { useState, useEffect, useRef } from "react"
import {
  Loader2, Save, ChevronLeft, MessageSquare, Palette,
  Layout, User, ImageIcon, ToggleLeft, Type, Sparkles,
} from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-2 border border-border rounded-lg px-2 py-1.5 bg-background h-9">
        <div className="relative w-5 h-5 shrink-0 cursor-pointer">
          <div className="w-5 h-5 rounded border border-border/60" style={{ backgroundColor: value }} />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground truncate">{value}</span>
      </div>
    </div>
  )
}

function ColorPair({ label, bg, text, onBg, onText }: {
  label: string; bg: string; text: string; onBg: (v: string) => void; onText: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <ColorInput label="Background" value={bg} onChange={onBg} />
        <ColorInput label="Text Color" value={text} onChange={onText} />
      </div>
      {/* Live mini preview */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50" style={{ backgroundColor: bg }}>
        <span className="text-xs font-medium" style={{ color: text }}>Preview text</span>
        <span className="text-[10px]" style={{ color: text, opacity: 0.7 }}>12:34</span>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 pr-4">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WindowThemeFormProps {
  onBack: () => void
  onSave: (data: any) => Promise<void>
  isLoading: boolean
  initial?: any
  chatbotId?: string
  onLiveUpdate?: (theme: any) => void
  chatbotData?: any
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WindowThemeForm({
  onBack, onSave, isLoading, initial, chatbotId, onLiveUpdate, chatbotData,
}: WindowThemeFormProps) {
  const [formData, setFormData] = useState({
    headerBgColor: "#1320AA",
    headerTextColor: "#ffffff",
    botMessageBgColor: "#f1f5f9",
    botMessageTextColor: "#0f172a",
    userMessageBgColor: "#1320AA",
    userMessageTextColor: "#ffffff",
    inputBgColor: "#ffffff",
    inputBorderColor: "#e2e8f0",
    inputButtonColor: "#DD692E",
    closeButtonColor: "#000000",
    closeButtonBgColor: "#DD692E",
    quickSuggestionBgColor: "#ffffff",
    quickSuggestionTextColor: "#0f172a",
    messageBgColor: "#f8fafc",
    windowBorderRadius: 16,
    fontSize: 14,
    showPoweredBy: true,
    showTTS: true,
    leadCardMessage: "Before we continue, mind sharing a few quick details? Totally optional.",
  })

  const [avatarData, setAvatarData] = useState({
    type: "EMOJI" as "EMOJI" | "SVG" | "URL",
    value: "",
    emojiValue: "🤖",
    svgValue: "",
  })

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isAvatarLoading, setIsAvatarLoading] = useState(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  useEffect(() => {
    if (initial && !isInitializedRef.current) {
      setFormData({
        headerBgColor: initial.headerBgColor || "#1320AA",
        headerTextColor: initial.headerTextColor || "#ffffff",
        botMessageBgColor: initial.botMessageBgColor || "#f1f5f9",
        botMessageTextColor: initial.botMessageTextColor || "#0f172a",
        userMessageBgColor: initial.userMessageBgColor || "#1320AA",
        userMessageTextColor: initial.userMessageTextColor || "#ffffff",
        inputBgColor: initial.inputBgColor || "#ffffff",
        inputBorderColor: initial.inputBorderColor || "#e2e8f0",
        inputButtonColor: initial.inputButtonColor || "#DD692E",
        closeButtonColor: initial.closeButtonColor || "#000000",
        closeButtonBgColor: initial.closeButtonBgColor || "#DD692E",
        quickSuggestionBgColor: initial.quickSuggestionBgColor || "#ffffff",
        quickSuggestionTextColor: initial.quickSuggestionTextColor || "#0f172a",
        messageBgColor: initial.messageBgColor || "#f8fafc",
        windowBorderRadius: initial.windowBorderRadius ?? 16,
        fontSize: initial.fontSize ?? 14,
        showPoweredBy: initial.showPoweredBy ?? true,
        showTTS: initial.showTTS ?? true,
        leadCardMessage: initial.leadCardMessage || "Before we continue, mind sharing a few quick details? Totally optional.",
      })
      if (chatbotData?.avatar) {
        setAvatarData({ type: "URL", value: chatbotData.avatar, emojiValue: "🤖", svgValue: "" })
      }
      isInitializedRef.current = true
    }
  }, [initial, chatbotData])

  useEffect(() => {
    if (onLiveUpdate && isInitializedRef.current) {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
      updateTimeoutRef.current = setTimeout(() => onLiveUpdate({ ...initial, ...formData }), 100)
    }
    return () => { if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current) }
  }, [formData, initial, onLiveUpdate])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image size should be less than 5MB'); return }
    setSelectedFile(file)
    setAvatarData({ type: "URL", value: URL.createObjectURL(file), emojiValue: "🤖", svgValue: "" })
  }

  const handleSubmit = async () => {
    setIsAvatarLoading(true)
    try {
      if (selectedFile && chatbotId) {
        const fd = new FormData()
        fd.append('avatar', selectedFile)
        const res = await fetch(`/api/chatbots/${chatbotId}`, { method: "PUT", body: fd })
        if (!res.ok) throw new Error('Failed to upload avatar')
        const data = await res.json()
        setAvatarData({ type: "URL", value: data.chatbot.avatar, emojiValue: "🤖", svgValue: "" })
        toast.success('Avatar uploaded')
        setSelectedFile(null)
      }
      await onSave({ ...initial, ...formData })
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setIsAvatarLoading(false)
    }
  }

  const update = (patch: Partial<typeof formData>) => setFormData(p => ({ ...p, ...patch }))

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b py-3.5 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-semibold text-sm">Window Customization</h2>
          <p className="text-xs text-muted-foreground">Customize chat window colors and style</p>
        </div>
      </div>

      <div className="space-y-3 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>

        {/* Avatar */}
        <SectionCard title="Chat Avatar" icon={<User className="w-3.5 h-3.5" />}>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Avatar Type</Label>
            <Select value={avatarData.type} onValueChange={(v) => setAvatarData({ ...avatarData, type: v as any })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="URL">Image Upload</SelectItem>
                <SelectItem value="EMOJI">Emoji</SelectItem>
                <SelectItem value="SVG">SVG Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {avatarData.type === "EMOJI" && (
            <Input
              value={avatarData.value || avatarData.emojiValue}
              onChange={(e) => setAvatarData({ ...avatarData, value: e.target.value, emojiValue: e.target.value })}
              placeholder="🤖"
              className="font-mono text-lg"
            />
          )}

          {avatarData.type === "SVG" && (
            <Textarea
              value={avatarData.value || avatarData.svgValue}
              onChange={(e) => setAvatarData({ ...avatarData, value: e.target.value, svgValue: e.target.value })}
              placeholder='<path d="..." />'
              className="font-mono text-xs min-h-[80px]"
            />
          )}

          {avatarData.type === "URL" && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="h-12 w-12 shrink-0 rounded-xl border bg-background flex items-center justify-center overflow-hidden">
                {avatarData.value
                  ? <img src={avatarData.value} alt="avatar" className="h-full w-full object-contain" />
                  : <ImageIcon className="h-5 w-5 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <Input type="file" accept="image/*" className="text-xs" onChange={handleFileSelect} />
                <p className="text-[10px] text-muted-foreground mt-1">PNG/SVG • 48×48px • Max 5MB</p>
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Appears in the chat header and next to bot messages.</p>
        </SectionCard>

        {/* Header */}
        <SectionCard title="Header" icon={<Layout className="w-3.5 h-3.5" />}>
          <ColorPair
            label="Header"
            bg={formData.headerBgColor}
            text={formData.headerTextColor}
            onBg={(v) => update({ headerBgColor: v })}
            onText={(v) => update({ headerTextColor: v })}
          />
        </SectionCard>

        {/* Messages */}
        <SectionCard title="Message Bubbles" icon={<MessageSquare className="w-3.5 h-3.5" />}>
          <ColorPair
            label="Bot Messages"
            bg={formData.botMessageBgColor}
            text={formData.botMessageTextColor}
            onBg={(v) => update({ botMessageBgColor: v })}
            onText={(v) => update({ botMessageTextColor: v })}
          />
          <ColorPair
            label="User Messages"
            bg={formData.userMessageBgColor}
            text={formData.userMessageTextColor}
            onBg={(v) => update({ userMessageBgColor: v })}
            onText={(v) => update({ userMessageTextColor: v })}
          />
          <ColorInput
            label="Message Area Background"
            value={formData.messageBgColor}
            onChange={(v) => update({ messageBgColor: v })}
          />
        </SectionCard>

        {/* Input area */}
        <SectionCard title="Input Area" icon={<Palette className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Background" value={formData.inputBgColor} onChange={(v) => update({ inputBgColor: v })} />
              <ColorInput label="Border" value={formData.inputBorderColor} onChange={(v) => update({ inputBorderColor: v })} />
            </div>
            <ColorInput label="Send Button" value={formData.inputButtonColor} onChange={(v) => update({ inputButtonColor: v })} />
          </div>
        </SectionCard>

        {/* Close button */}
        <SectionCard title="Close Button" icon={<Palette className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-2 gap-3">
            <ColorInput label="Background" value={formData.closeButtonBgColor} onChange={(v) => update({ closeButtonBgColor: v })} />
            <ColorInput label="Icon Color" value={formData.closeButtonColor} onChange={(v) => update({ closeButtonColor: v })} />
          </div>
        </SectionCard>

        {/* Suggestions */}
        <SectionCard title="Quick Suggestions" icon={<Sparkles className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-2 gap-3">
            <ColorInput label="Background" value={formData.quickSuggestionBgColor} onChange={(v) => update({ quickSuggestionBgColor: v })} />
            <ColorInput label="Text Color" value={formData.quickSuggestionTextColor} onChange={(v) => update({ quickSuggestionTextColor: v })} />
          </div>
          {/* Preview pills */}
          <div className="flex gap-2 flex-wrap">
            {["How to get started?", "Contact support"].map(s => (
              <span key={s} className="text-[11px] px-3 py-1.5 rounded-full border font-medium"
                style={{ backgroundColor: formData.quickSuggestionBgColor, color: formData.quickSuggestionTextColor, borderColor: formData.inputBorderColor }}>
                {s}
              </span>
            ))}
          </div>
        </SectionCard>

        {/* Style */}
        <SectionCard title="Window Style" icon={<Type className="w-3.5 h-3.5" />}>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">Font Size</Label>
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.fontSize}px</span>
            </div>
            <Slider value={[formData.fontSize]} min={11} max={18} step={1}
              onValueChange={([v]) => update({ fontSize: v })} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>11 — small</span><span>18 — large</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">Corner Radius</Label>
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.windowBorderRadius}px</span>
            </div>
            <Slider value={[formData.windowBorderRadius]} min={0} max={32} step={2}
              onValueChange={([v]) => update({ windowBorderRadius: v })} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 — sharp</span><span>32 — pill</span>
            </div>
          </div>
        </SectionCard>

        {/* Toggles */}
        <SectionCard title="Display Options" icon={<ToggleLeft className="w-3.5 h-3.5" />}>
          <div className="divide-y divide-border -mx-4 -mb-4 px-4">
            <ToggleRow label="Read Aloud (TTS)" description="Show speak button on bot messages"
              checked={formData.showTTS} onChange={(v) => update({ showTTS: v })} />
            <ToggleRow label="Powered by Prabisha" description="Show branding at bottom of chat"
              checked={formData.showPoweredBy} onChange={(v) => update({ showPoweredBy: v })} />
          </div>
        </SectionCard>

        {/* Lead card */}
        <SectionCard title="Lead Card Message" icon={<MessageSquare className="w-3.5 h-3.5" />}>
          <p className="text-[11px] text-muted-foreground">
            Shown when asking users to share their details before continuing.
          </p>
          <Textarea
            value={formData.leadCardMessage}
            onChange={(e) => update({ leadCardMessage: e.target.value })}
            rows={3}
            placeholder="Before we continue, mind sharing a few quick details?"
            className="text-xs resize-none"
          />
        </SectionCard>

      </div>

      {/* Sticky footer */}
      <div className="shrink-0 bg-background border-t pt-4 mt-2 flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">Cancel</Button>
        <Button onClick={handleSubmit} disabled={isLoading || isAvatarLoading} className="flex-1">
          {(isLoading || isAvatarLoading)
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Save className="w-4 h-4 mr-2" />}
          Save Window
        </Button>
      </div>
    </div>
  )
}
