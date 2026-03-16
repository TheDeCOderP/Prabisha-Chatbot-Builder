"use client"

import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { List, Link2, Calendar, Lightbulb, Plus, Trash2, ChevronDown, ChevronUp, Globe } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { LinkButtonForm } from "@/components/forms/link-button-form"
import { CollectLeadsForm } from "@/components/forms/collect-leads-form"
import { ScheduleMeetingForm } from "@/components/forms/schedule-meeting-form"

import { ChatbotLogic } from "@/types/chatbot-logic"
import { useChatbot } from "@/providers/chatbot-provider"
import { SUPPORTED_LANGUAGES, MultilingualSuggestion, LanguageCode } from "@/providers/chatbot-provider"

interface Feature {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
}

const safeJsonParse = (data: any, fallback: any = null) => {
  if (!data) return fallback
  if (typeof data !== 'string') return data
  try { return JSON.parse(data) } catch { return fallback }
}

/** Returns display label: value in activeLang, or first non-empty translation */
const suggestionLabel = (s: MultilingualSuggestion, preferred: LanguageCode): string => {
  if (s[preferred]?.trim()) return s[preferred]!
  for (const lang of SUPPORTED_LANGUAGES) {
    if (s[lang.code]?.trim()) return s[lang.code]!
  }
  return '(empty)'
}

export default function LogicPage() {
  const params = useParams()
  const router = useRouter()
  const chatbotId = params.id as string

  const {
    config,
    addSuggestion,
    removeSuggestion,
    updateSuggestionField,
    clearSuggestions,
    activeLang,
    setActiveLang,
  } = useChatbot()

  const [activeTab, setActiveTab]           = useState("features")
  const [isLoading, setIsLoading]           = useState(false)
  const [existingLogic, setExistingLogic]   = useState<ChatbotLogic | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  const [expandedIndex, setExpandedIndex]   = useState<number | null>(null)
  const [isSavingSuggestions, setIsSavingSuggestions] = useState(false)

  // Quick-add input — one per language column
  const [quickAdd, setQuickAdd] = useState<Record<LanguageCode, string>>(
    Object.fromEntries(SUPPORTED_LANGUAGES.map(l => [l.code, ''])) as Record<LanguageCode, string>
  )

  const suggestions = config.suggestions || []

  useEffect(() => { fetchExistingLogic() }, [chatbotId])

  const fetchExistingLogic = async () => {
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/logic`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setExistingLogic(data.logic || null)
    } catch {
      toast.error('Failed to load logic configuration')
    }
  }

  // ─── Quick-add: creates a new suggestion pre-filled with the activeLang value ─

  const handleQuickAdd = () => {
    const value = quickAdd[activeLang].trim()
    if (!value) return
    addSuggestion({ [activeLang]: value })
    setQuickAdd(prev => ({ ...prev, [activeLang]: '' }))
    // Auto-expand the new row so user can fill other languages
    setExpandedIndex(suggestions.length)
  }

  const handleSaveSuggestions = async () => {
    setIsSavingSuggestions(true)
    try {
      const formData = new FormData()
      formData.append("suggestions", JSON.stringify(suggestions))

      const res = await fetch(`/api/chatbots/${config.id}`, { method: "PUT", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      toast.success("Suggestions saved successfully!")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save suggestions")
    } finally {
      setIsSavingSuggestions(false)
    }
  }

  // ─── Logic save / delete (unchanged) ────────────────────────────────────────

  const handleSaveLogic = async (logicData: Partial<ChatbotLogic>, formData?: any) => {
    setIsLoading(true)
    try {
      const existingRes = await fetch(`/api/chatbots/${chatbotId}/logic`)
      let currentLogic: ChatbotLogic = existingLogic || {
        chatbotId, name: "Chatbot Logic", description: "Logic configuration",
        isActive: true, leadCollectionEnabled: false, linkButtonEnabled: false,
        meetingScheduleEnabled: false, triggers: []
      }
      if (existingRes.ok) {
        const d = await existingRes.json()
        if (d.logic) currentLogic = d.logic
      }

      const updatedLogic: ChatbotLogic = { ...currentLogic, chatbotId, ...logicData }
      if (formData) {
        if (selectedFeature === "collect-leads")    { updatedLogic.leadCollectionConfig  = formData; updatedLogic.leadCollectionEnabled  = true }
        else if (selectedFeature === "link-button") { updatedLogic.linkButtonConfig      = formData; updatedLogic.linkButtonEnabled      = true }
        else if (selectedFeature === "schedule-meeting") { updatedLogic.meetingScheduleConfig = formData; updatedLogic.meetingScheduleEnabled = true }
      }

      const method = updatedLogic.id ? 'PUT' : 'POST'
      const url    = updatedLogic.id ? `/api/chatbots/${chatbotId}/logic/${updatedLogic.id}` : `/api/chatbots/${chatbotId}/logic`

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedLogic) })
      if (!res.ok) throw new Error()

      const data = await res.json()
      toast.success(updatedLogic.id ? 'Logic updated!' : 'Logic saved!')
      await fetchExistingLogic()
      router.refresh()
      return data
    } catch {
      toast.error('Failed to save logic configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFeature = async (featureType: string) => {
    if (!confirm('Delete this feature configuration?')) return
    try {
      const updatedLogic: ChatbotLogic = {
        ...(existingLogic || { chatbotId, name: "Chatbot Logic", description: "", isActive: true, triggers: [] })
      }
      if (featureType === "collect-leads")         { updatedLogic.leadCollectionEnabled  = false; updatedLogic.leadCollectionConfig  = undefined }
      else if (featureType === "link-button")      { updatedLogic.linkButtonEnabled      = false; updatedLogic.linkButtonConfig      = undefined }
      else if (featureType === "schedule-meeting") { updatedLogic.meetingScheduleEnabled = false; updatedLogic.meetingScheduleConfig = undefined }

      if (updatedLogic.triggers)
        updatedLogic.triggers = updatedLogic.triggers.filter(t => !t.keywords?.includes(`${featureType}-trigger`))

      const res = await fetch(
        `/api/chatbots/${chatbotId}/logic${existingLogic?.id ? `/${existingLogic.id}` : ''}`,
        { method: existingLogic?.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedLogic) }
      )
      if (!res.ok) throw new Error()
      toast.success('Feature deleted!')
      await fetchExistingLogic()
    } catch {
      toast.error('Failed to delete feature configuration')
    }
  }

  const getFeatureConfig = (featureId: string) => {
    if (!existingLogic) return undefined
    switch (featureId) {
      case "collect-leads":    return existingLogic.leadCollectionEnabled  ? safeJsonParse(existingLogic.leadCollectionConfig)  : undefined
      case "link-button":      return existingLogic.linkButtonEnabled      ? safeJsonParse(existingLogic.linkButtonConfig)      : undefined
      case "schedule-meeting": return existingLogic.meetingScheduleEnabled ? safeJsonParse(existingLogic.meetingScheduleConfig) : undefined
    }
  }

  const resetForm = () => { setSelectedFeature(null); setActiveTab("features") }

  const features: Feature[] = [
    { id: "collect-leads",    icon: <List className="w-5 h-5" />,     title: "Collect leads",    description: "Add a form to request info." },
    { id: "link-button",      icon: <Link2 className="w-5 h-5" />,    title: "Link button",      description: "Display button to open a URL." },
    { id: "schedule-meeting", icon: <Calendar className="w-5 h-5" />, title: "Schedule meeting", description: "Display inline calendar for scheduling" },
    { id: "suggestions",      icon: <Lightbulb className="w-5 h-5" />,title: "Quick Suggestions",description: "Manage multilingual quick suggestions", badge: "New" },
  ]

  // ─── Active language meta ─────────────────────────────────────────────────

  const activeLangMeta = SUPPORTED_LANGUAGES.find(l => l.code === activeLang)!

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* ── Feature list ── */}
        <TabsContent value="features" className="space-y-8">
          <div className="flex flex-col gap-2">
            {features.map((feature) => {
              const isEnabled =
                (feature.id === "collect-leads"    && existingLogic?.leadCollectionEnabled)  ||
                (feature.id === "link-button"      && existingLogic?.linkButtonEnabled)      ||
                (feature.id === "schedule-meeting" && existingLogic?.meetingScheduleEnabled) ||
                (feature.id === "suggestions"      && suggestions.length > 0)

              return (
                <Card
                  key={feature.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-card"
                  onClick={() => { setSelectedFeature(feature.id); setActiveTab(feature.id) }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-foreground">{feature.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                          {isEnabled && (
                            <Badge variant="outline" className="text-xs h-5 bg-green-50 text-green-700 border-green-200">
                              {feature.id === "suggestions" ? `${suggestions.length} configured` : "Configured"}
                            </Badge>
                          )}
                          {feature.badge && (
                            <Badge variant={feature.badge === "New" ? "default" : "secondary"} className="text-xs h-5">
                              {feature.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                    {isEnabled && feature.id !== "suggestions" && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFeature(feature.id) }}
                          className="text-xs text-red-600 hover:text-red-800 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ── Other feature tabs ── */}
        {(["collect-leads", "link-button", "schedule-meeting"] as const).map((id) => (
          <TabsContent key={id} value={id} className="space-y-8">
            {id === "collect-leads"    && <CollectLeadsForm    onBack={resetForm} onSave={(d) => handleSaveLogic({}, d)} isLoading={isLoading} initial={getFeatureConfig(id)} />}
            {id === "link-button"      && <LinkButtonForm      onBack={resetForm} onSave={(d) => handleSaveLogic({}, d)} isLoading={isLoading} initial={getFeatureConfig(id)} />}
            {id === "schedule-meeting" && <ScheduleMeetingForm onBack={resetForm} onSave={(d) => handleSaveLogic({}, d)} isLoading={isLoading} initial={getFeatureConfig(id)} />}
          </TabsContent>
        ))}

        {/* ── Multilingual Suggestions tab ── */}
        <TabsContent value="suggestions" className="space-y-6">

          {/* Header */}
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Quick Suggestions</h3>
            <p className="text-sm text-muted-foreground">
              Add suggestions in multiple languages. Users will see the suggestion that matches their language.
            </p>
          </div>

          {/* ── Language picker ── */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add suggestions in</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setActiveLang(lang.code)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium
                    transition-colors
                    ${activeLang === lang.code
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-input hover:bg-muted'}
                  `}
                >
                  <img
                    src={lang.img}
                    alt={lang.name}
                    className="w-4 h-4 rounded-sm object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── Quick-add input for the selected language ── */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              New suggestion
              <span className="text-muted-foreground font-normal">({activeLangMeta.name})</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={quickAdd[activeLang]}
                onChange={(e) => setQuickAdd(prev => ({ ...prev, [activeLang]: e.target.value }))}
                placeholder={activeLangMeta.placeholder}
                dir={activeLangMeta.dir}
                className={activeLang === 'ar' ? 'text-right' : ''}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd() }
                }}
              />
              <Button onClick={handleQuickAdd} disabled={!quickAdd[activeLang].trim()}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* ── Suggestions list ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Suggestions ({suggestions.length})
              </label>
              {suggestions.length > 0 && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { if (confirm('Clear all suggestions?')) clearSuggestions() }}
                  className="text-destructive hover:text-destructive"
                >
                  Clear All
                </Button>
              )}
            </div>

            {suggestions.length === 0 ? (
              <div className="text-center p-8 border border-dashed rounded-lg">
                <Globe className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No suggestions yet. Pick a language above and add your first suggestion.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => {
                  const isExpanded   = expandedIndex === index
                  const label        = suggestionLabel(suggestion, activeLang)
                  const filledCount  = SUPPORTED_LANGUAGES.filter(l => suggestion[l.code]?.trim()).length

                  return (
                    <Card key={index} className="overflow-hidden">
                      {/* Collapsed header */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                        onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      >
                        <span className="text-sm font-medium flex-1 truncate">{label}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {filledCount}/{SUPPORTED_LANGUAGES.length} languages
                        </Badge>
                        <Button
                          type="button" variant="ghost" size="sm"
                          onClick={(e) => { e.stopPropagation(); removeSuggestion(index) }}
                          className="text-destructive hover:text-destructive h-7 w-7 p-0 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        }
                      </div>

                      {/* Expanded: all language fields */}
                      {isExpanded && (
                        <div className="border-t px-3 pb-3 pt-3 space-y-2 bg-muted/20">
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <div key={lang.code} className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 w-24 shrink-0">
                                <img
                                  src={lang.img} alt={lang.name}
                                  className="w-5 h-5 rounded-sm object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                                <span className="text-xs text-muted-foreground">{lang.name}</span>
                              </div>
                              <Input
                                value={suggestion[lang.code] || ""}
                                onChange={(e) => updateSuggestionField(index, lang.code, e.target.value)}
                                placeholder={lang.placeholder}
                                dir={lang.dir}
                                className={`text-sm h-8 ${lang.code === 'ar' ? 'text-right' : ''}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Save */}
          <Button className="w-full" onClick={handleSaveSuggestions} disabled={isSavingSuggestions}>
            {isSavingSuggestions ? "Saving..." : "Save Suggestions"}
          </Button>

          {/* Back */}
          <Button variant="outline" className="w-full" onClick={resetForm}>
            Back to Features
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}