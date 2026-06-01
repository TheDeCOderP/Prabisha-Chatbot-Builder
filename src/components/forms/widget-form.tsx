"use client"

import { useState, useEffect, useRef } from "react"
import {
  Loader2, Save, ChevronLeft, Palette, MousePointer2,
  ImageIcon, LayoutGrid, Sliders, ToggleLeft, Zap, Globe,
} from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectItem, SelectValue, SelectContent, SelectTrigger,
} from "@/components/ui/select"
import { ShapeType, BorderType, Position, WidgetIconType } from "../../../generated/prisma/enums"

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

interface WidgetThemeFormProps {
  onBack: () => void
  onSave: (data: any) => Promise<void>
  isLoading: boolean
  initial?: any
  onLiveUpdate?: (theme: any) => void
  chatbotData?: any
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WidgetThemeForm({ onBack, onSave, isLoading, initial, onLiveUpdate, chatbotData }: WidgetThemeFormProps) {
  const [formData, setFormData] = useState({
    widgetIcon: "💬",
    widgetIconType: "EMOJI" as WidgetIconType,
    widgetText: "Chat with us",
    widgetSize: 70,
    widgetSizeMobile: 60,
    widgetColor: "#3b82f6",
    widgetBgColor: "#FFFFFF",
    widgetShape: "ROUND" as ShapeType,
    widgetBorder: "FLAT" as BorderType,
    widgetPosition: "BottomRight" as Position,
    widgetPadding: 0,
    widgetMargin: 20,
    popup_onload: false,
    widgetCustomPosition: false,
    widgetTop: null as number | null,
    widgetBottom: 20 as number | null,
    widgetLeft: null as number | null,
    widgetRight: 20 as number | null,
    windowWidth: 420,
    windowHeight: 600,
    showMic: true,
    showEmoji: true,
    showNewChat: true,
    showLanguageSwitcher: true,
    defaultLanguage: 'auto',
    restrictedLanguages: [] as string[],
  })

  const [iconData, setIconData] = useState({
    type: "IMAGE" as "EMOJI" | "IMAGE" | "SVG",
    value: "",
    emojiValue: "💬",
    svgValue: "",
  })

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  useEffect(() => {
    if (initial && !isInitializedRef.current) {
      // If chatbot has an uploaded icon but theme still says EMOJI (old bug), correct it to IMAGE
      const hasUploadedIcon = !!(chatbotData?.icon)
      const themeIconType = initial.widgetIconType as WidgetIconType
      const correctedIconType: WidgetIconType =
        (!themeIconType || themeIconType === 'EMOJI') && hasUploadedIcon ? 'IMAGE' : (themeIconType || 'EMOJI')
      const correctedIconValue =
        correctedIconType === 'IMAGE'
          ? (initial.widgetIcon || chatbotData?.icon || '')
          : (initial.widgetIcon || '💬')

      setFormData({
        widgetIcon: correctedIconValue,
        widgetIconType: correctedIconType,
        widgetText: initial.widgetText || "Chat with us",
        widgetSize: initial.widgetSize || 70,
        widgetSizeMobile: initial.widgetSizeMobile || 60,
        widgetColor: initial.widgetColor || "#3b82f6",
        widgetBgColor: initial.widgetBgColor || "#FFFFFF",
        widgetShape: (initial.widgetShape as ShapeType) || "ROUND",
        widgetBorder: (initial.widgetBorder as BorderType) || "FLAT",
        widgetPosition: (initial.widgetPosition as Position) || "BottomRight",
        widgetPadding: initial.widgetPadding || 0,
        widgetMargin: initial.widgetMargin ?? 20,
        popup_onload: initial.popup_onload ?? false,
        widgetCustomPosition: initial.widgetCustomPosition ?? false,
        widgetTop: initial.widgetTop ?? null,
        widgetBottom: initial.widgetBottom ?? 20,
        widgetLeft: initial.widgetLeft ?? null,
        widgetRight: initial.widgetRight ?? 20,
        windowWidth: initial.windowWidth || 420,
        windowHeight: initial.windowHeight || 600,
        showMic: initial.showMic ?? true,
        showEmoji: initial.showEmoji ?? true,
        showNewChat: initial.showNewChat ?? true,
        showLanguageSwitcher: initial.showLanguageSwitcher ?? true,
        defaultLanguage: initial.defaultLanguage ?? 'auto',
        restrictedLanguages: initial.restrictedLanguages ?? [],
      })
      if (correctedIconType === 'IMAGE') {
        setIconData({ type: "IMAGE", value: correctedIconValue, emojiValue: "💬", svgValue: "" })
      } else if (correctedIconType === 'SVG') {
        setIconData({ type: "SVG", value: correctedIconValue, emojiValue: "💬", svgValue: correctedIconValue })
      } else {
        const emoji = correctedIconValue || chatbotData?.widgetIconEmoji || '💬'
        setIconData({ type: "EMOJI", value: emoji, emojiValue: emoji, svgValue: "" })
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
    setIconData({ type: "IMAGE", value: URL.createObjectURL(file), emojiValue: "💬", svgValue: "" })
    update({ widgetIconType: 'IMAGE' as WidgetIconType })
  }

  const handleSubmit = async () => {
    let savedIconUrl: string | null = null
    if (selectedFile) {
      const fd = new FormData()
      fd.append('icon', selectedFile)
      if (formData.widgetText) fd.append('widget_text', formData.widgetText)
      try {
        const res = await fetch(`/api/chatbots/${chatbotData?.id}`, { method: "PUT", body: fd })
        if (!res.ok) throw new Error('Failed to save icon')
        const data = await res.json()
        savedIconUrl = data.chatbot?.icon || null
        toast.success('Icon uploaded')
        setSelectedFile(null)
      } catch { toast.error('Failed to upload icon') }
    }
    // Merge the Cloudinary URL into formData before saving theme
    await onSave({
      ...formData,
      ...(savedIconUrl ? { widgetIcon: savedIconUrl, widgetIconType: 'IMAGE' as WidgetIconType } : {}),
    })
  }

  const positionPresets: { label: string; value: Position; icon: string }[] = [
    { label: "Bottom Right", value: "BottomRight", icon: "↘" },
    { label: "Bottom Left",  value: "BottomLeft",  icon: "↙" },
    { label: "Top Right",    value: "TopRight",    icon: "↗" },
    { label: "Top Left",     value: "TopLeft",     icon: "↖" },
  ]

  const update = (patch: Partial<typeof formData>) => setFormData(p => ({ ...p, ...patch }))

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b py-3.5 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-semibold text-sm">Widget Customization</h2>
          <p className="text-xs text-muted-foreground">Adjust the chat bubble look and feel</p>
        </div>
      </div>

      <div className="space-y-3 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>

        {/* Icon */}
        <SectionCard title="Widget Icon" icon={<MousePointer2 className="w-3.5 h-3.5" />}>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Icon Type</Label>
            <Select value={iconData.type} onValueChange={(v) => {
              setIconData({ ...iconData, type: v as any })
              update({ widgetIconType: v as WidgetIconType })
            }}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IMAGE">Image Upload</SelectItem>
                <SelectItem value="EMOJI">Emoji</SelectItem>
                <SelectItem value="SVG">SVG Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {iconData.type === "EMOJI" && (
            <Input
              value={iconData.value || iconData.emojiValue}
              onChange={(e) => setIconData({ ...iconData, value: e.target.value, emojiValue: e.target.value })}
              placeholder="💬"
              className="font-mono text-lg"
            />
          )}

          {iconData.type === "SVG" && (
            <Textarea
              value={iconData.value || iconData.svgValue}
              onChange={(e) => setIconData({ ...iconData, value: e.target.value, svgValue: e.target.value })}
              placeholder='<path d="..." />'
              className="font-mono text-xs min-h-[80px]"
            />
          )}

          {iconData.type === "IMAGE" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="h-12 w-12 rounded-xl border bg-background flex items-center justify-center overflow-hidden shrink-0">
                  {iconData.value
                    ? <img src={iconData.value} alt="icon" className="h-full w-full object-contain" />
                    : <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <Input type="file" accept="image/*" className="text-xs" onChange={handleFileSelect} />
                  <p className="text-[10px] text-muted-foreground mt-1">PNG/SVG • 48×48px • Max 5MB</p>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Appearance */}
        <SectionCard title="Appearance" icon={<Palette className="w-3.5 h-3.5" />}>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tooltip Text</Label>
            <Input
              value={formData.widgetText}
              onChange={(e) => update({ widgetText: e.target.value })}
              placeholder="Chat with us"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Button Shape</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "ROUND",          label: "Round",   preview: "rounded-full" },
                { value: "SQUARE",         label: "Square",  preview: "rounded-none" },
                { value: "ROUNDED_SQUARE", label: "Rounded", preview: "rounded-xl" },
              ] as { value: ShapeType; label: string; preview: string }[]).map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => update({ widgetShape: s.value })}
                  className={[
                    "flex flex-col items-center gap-1.5 py-2.5 px-2 border-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    formData.widgetShape === s.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40",
                  ].join(" ")}
                >
                  <div
                    className={`w-6 h-6 bg-primary/80 ${s.preview}`}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ColorInput
              label="Accent / Border"
              value={formData.widgetColor}
              onChange={(v) => update({ widgetColor: v })}
            />
            <ColorInput
              label="Button Background"
              value={formData.widgetBgColor}
              onChange={(v) => update({ widgetBgColor: v })}
            />
          </div>
        </SectionCard>

        {/* Size */}
        <SectionCard title="Size & Spacing" icon={<Sliders className="w-3.5 h-3.5" />}>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">Desktop Size</Label>
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.widgetSize}px</span>
            </div>
            <Slider value={[formData.widgetSize]} min={40} max={100} step={1}
              onValueChange={([v]) => update({ widgetSize: v })} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">Mobile Size</Label>
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.widgetSizeMobile}px</span>
            </div>
            <Slider value={[formData.widgetSizeMobile]} min={40} max={80} step={1}
              onValueChange={([v]) => update({ widgetSizeMobile: v })} />
          </div>
        </SectionCard>

        {/* Window Size */}
        <SectionCard title="Chat Window Size" icon={<LayoutGrid className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">Width</Label>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.windowWidth}px</span>
              </div>
              <Slider value={[formData.windowWidth]} min={300} max={600} step={10}
                onValueChange={([v]) => update({ windowWidth: v })} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">Height</Label>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.windowHeight}px</span>
              </div>
              <Slider value={[formData.windowHeight]} min={400} max={800} step={10}
                onValueChange={([v]) => update({ windowHeight: v })} />
            </div>
          </div>
        </SectionCard>

        {/* Position */}
        <SectionCard title="Position" icon={<Sliders className="w-3.5 h-3.5" />}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Custom Position</p>
              <p className="text-[10px] text-muted-foreground">Set exact px from each edge</p>
            </div>
            <Switch checked={formData.widgetCustomPosition}
              onCheckedChange={(v) => update({ widgetCustomPosition: v })} />
          </div>

          {!formData.widgetCustomPosition ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {positionPresets.map(({ label, value, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ widgetPosition: value })}
                    className={[
                      "flex items-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                      formData.widgetPosition === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border",
                    ].join(" ")}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Distance from Edge</Label>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.widgetMargin}px</span>
                </div>
                <Slider value={[formData.widgetMargin]} min={0} max={100} step={1}
                  onValueChange={([v]) => update({ widgetMargin: v })} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Leave empty to not pin from that side.</p>
              <div className="grid grid-cols-2 gap-2">
                {(["widgetTop", "widgetBottom", "widgetLeft", "widgetRight"] as const).map((side) => (
                  <div key={side} className="space-y-1">
                    <Label className="text-xs capitalize">{side.replace("widget", "")}</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={0} max={500} placeholder="—"
                        value={formData[side] ?? ""}
                        onChange={(e) => update({ [side]: e.target.value === "" ? null : Number(e.target.value) })}
                        className="font-mono text-xs"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">px</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Features */}
        <SectionCard title="Input Features" icon={<ToggleLeft className="w-3.5 h-3.5" />}>
          <div className="divide-y divide-border -mx-4 -mb-4 px-4">
            <ToggleRow label="Microphone (STT)" description="Let users speak instead of type"
              checked={formData.showMic} onChange={(v) => update({ showMic: v })} />
            <ToggleRow label="Emoji Picker" description="Show emoji button in input bar"
              checked={formData.showEmoji} onChange={(v) => update({ showEmoji: v })} />
            <ToggleRow label="New Chat Button" description="Let users reset the conversation"
              checked={formData.showNewChat} onChange={(v) => update({ showNewChat: v })} />
            <ToggleRow label="Language Switcher" description="Show language selector in input"
              checked={formData.showLanguageSwitcher} onChange={(v) => update({ showLanguageSwitcher: v })} />
          </div>
        </SectionCard>

        {/* Behaviour */}
        <SectionCard title="Behaviour" icon={<Zap className="w-3.5 h-3.5" />}>
          <ToggleRow
            label="Auto-open on page load"
            description="Chat window expands automatically when page loads"
            checked={formData.popup_onload}
            onChange={(v) => update({ popup_onload: v })}
          />
        </SectionCard>

        {/* Language Settings */}
        <SectionCard title="Language Settings" icon={<Globe className="w-3.5 h-3.5" />}>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Default Language</Label>
            <p className="text-[10px] text-muted-foreground">
              Language shown to all visitors by default. <span className="font-medium text-foreground">Auto</span> = detect from visitor's IP location.
            </p>
            <Select value={formData.defaultLanguage} onValueChange={(v) => update({ defaultLanguage: v })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🌐 Auto (detect from IP)</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="hi">🇮🇳 हिन्दी (Hindi)</SelectItem>
                <SelectItem value="pa">🇮🇳 ਪੰਜਾਬੀ (Punjabi)</SelectItem>
                <SelectItem value="kn">🇮🇳 ಕನ್ನಡ (Kannada)</SelectItem>
                <SelectItem value="te">🇮🇳 తెలుగు (Telugu)</SelectItem>
                <SelectItem value="bn">🇮🇳 বাংলা (Bengali)</SelectItem>
                <SelectItem value="gu">🇮🇳 ગુજરાતી (Gujarati)</SelectItem>
                <SelectItem value="fr">🇫🇷 Français</SelectItem>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
                <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                <SelectItem value="zh">🇨🇳 中文</SelectItem>
                <SelectItem value="ja">🇯🇵 日本語</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.showLanguageSwitcher && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Show Only These Languages</Label>
              <p className="text-[10px] text-muted-foreground">
                Restrict the language picker. Empty = show all languages.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { code: 'en', label: 'English' },
                  { code: 'hi', label: 'हिन्दी' },
                  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
                  { code: 'kn', label: 'ಕನ್ನಡ' },
                  { code: 'te', label: 'తెలుగు' },
                  { code: 'bn', label: 'বাংলা' },
                  { code: 'gu', label: 'ગુજરાતી' },
                  { code: 'fr', label: 'Français' },
                  { code: 'es', label: 'Español' },
                  { code: 'ar', label: 'العربية' },
                  { code: 'zh', label: '中文' },
                  { code: 'ja', label: '日本語' },
                ].map(({ code, label }) => {
                  const isSelected = formData.restrictedLanguages.includes(code)
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        const current = formData.restrictedLanguages
                        update({
                          restrictedLanguages: isSelected
                            ? current.filter(c => c !== code)
                            : [...current, code]
                        })
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/8 text-primary'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                        {isSelected && <span className="text-white text-[8px] leading-none">✓</span>}
                      </span>
                      {label}
                    </button>
                  )
                })}
              </div>
              {formData.restrictedLanguages.length > 0 && (
                <button
                  type="button"
                  onClick={() => update({ restrictedLanguages: [] })}
                  className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Clear all — show all languages
                </button>
              )}
            </div>
          )}
        </SectionCard>

      </div>

      {/* Sticky footer */}
      <div className="shrink-0 bg-background border-t pt-4 mt-2 flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">Cancel</Button>
        <Button onClick={handleSubmit} disabled={isLoading} className="flex-1">
          {isLoading
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Save className="w-4 h-4 mr-2" />}
          Save Widget
        </Button>
      </div>
    </div>
  )
}
