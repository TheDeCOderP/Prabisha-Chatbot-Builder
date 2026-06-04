"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, Save, Loader2, Volume2, Mic2, Bell, Play, VolumeX, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0 pr-4">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ─── Sound presets ────────────────────────────────────────────────────────────

const SOUND_PRESETS = [
  { value: 'ding',   label: 'Ding',    desc: 'Falling tone' },
  { value: 'double', label: 'Double',  desc: 'Two quick beeps' },
  { value: 'chime',  label: 'Chime',   desc: 'Soft melodic' },
  { value: 'rising', label: 'Rising',  desc: 'Upward sweep' },
  { value: 'soft',   label: 'Soft',    desc: 'Subtle pop' },
] as const

type SoundType = typeof SOUND_PRESETS[number]['value']

function playPreviewSound(type: SoundType, volume: number) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const osc1 = (freq: number, startAt: number, dur: number, wave: OscillatorType = 'sine') => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = wave
      o.frequency.setValueAtTime(freq, startAt)
      g.gain.setValueAtTime(volume * 0.3, startAt)
      g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
      o.start(startAt); o.stop(startAt + dur)
    }

    switch (type) {
      case 'double':
        osc1(800, ctx.currentTime, 0.1)
        osc1(800, ctx.currentTime + 0.18, 0.1)
        setTimeout(() => ctx.close(), 700)
        break
      case 'chime':
        ;[523, 659, 784].forEach((f, i) => osc1(f, ctx.currentTime + i * 0.12, 0.35))
        setTimeout(() => ctx.close(), 1200)
        break
      case 'rising': {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = 'sine'
        o.frequency.setValueAtTime(300, ctx.currentTime)
        o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.25)
        g.gain.setValueAtTime(volume * 0.3, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3)
        setTimeout(() => ctx.close(), 600)
        break
      }
      case 'soft':
        osc1(600, ctx.currentTime, 0.15, 'triangle')
        setTimeout(() => ctx.close(), 400)
        break
      default: { // ding
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = 'sine'
        o.frequency.setValueAtTime(900, ctx.currentTime)
        o.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.12)
        g.gain.setValueAtTime(volume * 0.35, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.25)
        setTimeout(() => ctx.close(), 600)
      }
    }
  } catch { /* browser may not support */ }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoiceFormProps {
  onBack: () => void
  onSave: (data: any) => Promise<void>
  isLoading: boolean
  initial?: any
  onLiveUpdate?: (theme: any) => void
  chatbotData?: any
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceForm({ onBack, onSave, isLoading, initial, onLiveUpdate, chatbotData }: VoiceFormProps) {
  const [settings, setSettings] = useState({
    notificationSound:     true,
    notificationVolume:    0.4,
    notificationSoundType: 'ding' as SoundType,
    notificationSoundUrl:  '',
    voiceGender:           'female' as 'female' | 'male' | 'neutral',
    voiceGreeting:         false,
    voiceGreetingVolume:   0.8,
    voiceGreetingRate:     1.0,
  })

  const updateTimeoutRef  = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef  = useRef(false)
  const [testingSpeech, setTestingSpeech] = useState(false)

  useEffect(() => {
    if (initial && !isInitializedRef.current) {
      isInitializedRef.current = true
      setSettings({
        notificationSound:     initial.notificationSound     ?? true,
        notificationVolume:    initial.notificationVolume    ?? 0.4,
        notificationSoundType: initial.notificationSoundType ?? 'ding',
        notificationSoundUrl:  initial.notificationSoundUrl  ?? '',
        voiceGender:           initial.voiceGender           ?? 'female',
        voiceGreeting:         initial.voiceGreeting         ?? false,
        voiceGreetingVolume:   initial.voiceGreetingVolume   ?? 0.8,
        voiceGreetingRate:     initial.voiceGreetingRate     ?? 1.0,
      })
    }
  }, [initial])

  const update = (patch: Partial<typeof settings>) => {
    const updated = { ...settings, ...patch }
    setSettings(updated)
    if (onLiveUpdate) {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
      updateTimeoutRef.current = setTimeout(() => onLiveUpdate(updated), 150)
    }
  }

  const handleTestSound = () => {
    if (settings.notificationSoundUrl) {
      try {
        const audio = new Audio(settings.notificationSoundUrl)
        audio.volume = Math.min(Math.max(settings.notificationVolume, 0), 1)
        audio.play().catch(() => {})
      } catch { /* ignore */ }
    } else {
      playPreviewSound(settings.notificationSoundType, settings.notificationVolume)
    }
  }

  const handleTestVoice = () => {
    if (!window.speechSynthesis) return
    setTestingSpeech(true)

    let greetingText = "Hi! How can I help you today?"
    try {
      const greetingArr = chatbotData?.greeting
      if (Array.isArray(greetingArr) && greetingArr.length > 0) {
        const g = greetingArr[0]
        greetingText = (typeof g === 'string' ? g : g?.en || g?.hi || Object.values(g)[0]) || greetingText
      }
    } catch { /* use default */ }

    const browserLang = navigator.language?.split('-')[0] || 'en'
    const langMap: Record<string, string> = {
      en: 'en-US', hi: 'hi-IN', ar: 'ar-SA', fr: 'fr-FR',
      es: 'es-ES', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN',
      pa: 'pa-IN', kn: 'kn-IN', te: 'te-IN', bn: 'bn-IN', gu: 'gu-IN',
      pt: 'pt-BR', it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', ko: 'ko-KR',
    }
    const targetLang = langMap[browserLang] || 'en-US'

    const gender = settings.voiceGender || 'female'
    const femaleRe = /female|woman|zira|samantha|karen|moira|tessa|fiona|vicki|victoria|lisa|sarah|susan|allison|ava|nicky|siri/i
    const maleRe   = /male|man|david|mark|daniel|alex|fred|ralph|albert|bruce|jorge|diego|pablo|thomas|rishi|lekha/i
    const matchesGender = (v: SpeechSynthesisVoice) => {
      if (gender === 'neutral') return true
      if (gender === 'female')  return femaleRe.test(v.name)
      if (gender === 'male')    return maleRe.test(v.name)
      return true
    }

    const doSpeak = (voices: SpeechSynthesisVoice[]) => {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(greetingText)
        utterance.lang   = targetLang
        utterance.volume = settings.voiceGreetingVolume
        utterance.rate   = settings.voiceGreetingRate
        utterance.onend  = () => setTestingSpeech(false)
        utterance.onerror = () => setTestingSpeech(false)
        if (voices.length > 0) {
          const langExact  = voices.filter(v => v.lang === targetLang)
          const langPrefix = voices.filter(v => v.lang.startsWith(browserLang))
          const fallbackEn = voices.filter(v => v.lang.startsWith('en'))
          const pick = (pool: SpeechSynthesisVoice[]) => pool.find(matchesGender) || pool[0]
          const v = pick(langExact) || pick(langPrefix) || pick(fallbackEn) || voices[0]
          if (v) utterance.voice = v
        }
        window.speechSynthesis.speak(utterance)
      } catch { setTestingSpeech(false) }
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      doSpeak(voices)
    } else {
      const onReady = () => {
        window.speechSynthesis.onvoiceschanged = null
        doSpeak(window.speechSynthesis.getVoices())
      }
      window.speechSynthesis.onvoiceschanged = onReady
      setTimeout(() => {
        if ((window.speechSynthesis.onvoiceschanged as any) === onReady) {
          window.speechSynthesis.onvoiceschanged = null
          doSpeak(window.speechSynthesis.getVoices())
        }
      }, 300)
    }
  }

  const handleStopVoice = () => {
    window.speechSynthesis?.cancel()
    setTestingSpeech(false)
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b py-3.5 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-semibold text-sm">Voice & Sound</h2>
          <p className="text-xs text-muted-foreground">Notification sounds and voice greeting for your embed</p>
        </div>
      </div>

      <div className="space-y-3 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>

        {/* Notification Sound */}
        <SectionCard title="Notification Sound" icon={<Bell className="w-3.5 h-3.5" />}>
          <ToggleRow
            label="Enable notification sound"
            description="Play a sound when the chat button is clicked"
            checked={settings.notificationSound}
            onChange={(v) => update({ notificationSound: v })}
          />

          {settings.notificationSound && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Volume</Label>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{pct(settings.notificationVolume)}</span>
                </div>
                <Slider
                  min={0.05} max={1} step={0.05}
                  value={[settings.notificationVolume]}
                  onValueChange={([v]) => update({ notificationVolume: v })}
                />
              </div>

              {/* Sound type presets */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sound Type</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {SOUND_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => update({ notificationSoundType: p.value, notificationSoundUrl: '' })}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border p-2 text-center transition-colors cursor-pointer
                        ${settings.notificationSoundType === p.value && !settings.notificationSoundUrl
                          ? 'border-primary bg-primary/8 text-primary'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                    >
                      <span className="text-[11px] font-semibold leading-tight">{p.label}</span>
                      <span className="text-[9px] leading-tight opacity-70">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom audio URL */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Link className="w-3 h-3" />
                  Custom Sound URL
                  <span className="text-[10px] font-normal text-muted-foreground">(optional — overrides preset)</span>
                </Label>
                <Input
                  type="url"
                  placeholder="https://example.com/notification.mp3"
                  value={settings.notificationSoundUrl}
                  onChange={(e) => update({ notificationSoundUrl: e.target.value })}
                  className="text-xs h-8"
                />
                {settings.notificationSoundUrl && (
                  <p className="text-[10px] text-blue-600">Custom URL active — preset is ignored</p>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={handleTestSound}
                type="button"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Test Sound
              </Button>
            </>
          )}

          <div className="rounded-lg bg-muted/50 border border-border/50 p-3">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Note:</span> Sound plays only after the user clicks the chat button — browsers block auto-play. Silent mode on mobile will mute sounds.
            </p>
          </div>
        </SectionCard>

        {/* Voice Greeting */}
        <SectionCard title="Voice Greeting" icon={<Mic2 className="w-3.5 h-3.5" />}>
          <ToggleRow
            label="Speak greeting on chat open"
            description="Chatbot reads the greeting message aloud when user opens chat"
            checked={settings.voiceGreeting}
            onChange={(v) => update({ voiceGreeting: v })}
          />

          {settings.voiceGreeting && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Voice Volume</Label>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{pct(settings.voiceGreetingVolume)}</span>
                </div>
                <Slider
                  min={0.1} max={1} step={0.05}
                  value={[settings.voiceGreetingVolume]}
                  onValueChange={([v]) => update({ voiceGreetingVolume: v })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Speaking Speed</Label>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{settings.voiceGreetingRate.toFixed(1)}x</span>
                </div>
                <Slider
                  min={0.5} max={2} step={0.1}
                  value={[settings.voiceGreetingRate]}
                  onValueChange={([v]) => update({ voiceGreetingRate: v })}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0.5x — slow</span>
                  <span>1.0x — normal</span>
                  <span>2.0x — fast</span>
                </div>
              </div>

              {testingSpeech ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs border-destructive text-destructive hover:bg-destructive/5"
                  onClick={handleStopVoice}
                  type="button"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  Stop Speaking
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={handleTestVoice}
                  type="button"
                >
                  <Play className="w-3.5 h-3.5" />
                  Test Voice Greeting
                </Button>
              )}

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-1">
                <p className="text-[10px] text-blue-700 leading-relaxed font-medium">How voice language works:</p>
                <ul className="space-y-0.5">
                  {[
                    "Uses visitor's browser language automatically",
                    "Speaks in Hindi for Indian visitors, English for others",
                    "Falls back to English if language not supported",
                    "Silent mode / iOS restrictions may prevent voice",
                  ].map((t, i) => (
                    <li key={i} className="text-[10px] text-blue-600 flex gap-1.5">
                      <span className="shrink-0">•</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </SectionCard>

        {/* Browser support */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-800">Browser Support</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            {[
              { browser: "Chrome / Edge", sound: "✅", voice: "✅" },
              { browser: "Firefox",       sound: "✅", voice: "✅" },
              { browser: "Safari (Mac)",  sound: "✅", voice: "✅" },
              { browser: "iOS Safari",    sound: "⚠️", voice: "⚠️" },
              { browser: "Silent mode",   sound: "❌", voice: "❌" },
            ].map(r => (
              <div key={r.browser} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-amber-700">{r.browser}</span>
                <span className="font-mono">{r.sound} {r.voice}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-600">First column: Sound · Second: Voice</p>
        </div>

      </div>

      {/* Footer */}
      <div className="shrink-0 bg-background border-t pt-4 mt-2 flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">Cancel</Button>
        <Button onClick={() => onSave({
        ...settings,
        notificationSoundUrl: settings.notificationSoundUrl?.trim() || null,
      })} disabled={isLoading} className="flex-1">
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Voice Settings
        </Button>
      </div>
    </div>
  )
}
