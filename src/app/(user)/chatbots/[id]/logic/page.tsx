"use client"

import type React from "react"
import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import Chat from "@/components/features/chat"
import { toast } from "sonner"
import { 
  ChevronLeft, 
  Trash2, 
  GripVertical, 
  AlertCircle, 
  Plus, 
  Info, 
  List, 
  Zap, 
  Play, 
  Link2, 
  Calendar, 
  Lightbulb, 
  Settings, 
  X,
  Clock,
  Video,
  Phone,
  MessageSquare,
  Mail,
  Users,
  User,
  Globe,
  ExternalLink,
  ArrowRight,
  ChevronRight,
  Download,
  Upload,
  FileText,
  Save,
  Loader2
} from "lucide-react";

interface Feature {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
}

// Types based on your Prisma schema
type LogicType = "COLLECT_LEADS" | "LINK_BUTTON" | "SCHEDULE_MEETING"
type TriggerType = "KEYWORD" | "ALWAYS" | "MANUAL" | "END_OF_CONVERSATION"
type FieldType = "TEXT" | "EMAIL" | "PHONE" | "NUMBER" | "CURRENCY" | "DATE" | "LINK"
type LeadTiming = "BEGINNING" | "MIDDLE" | "END"
type LeadFormStyle = "EMBEDDED" | "MESSAGES"
type Cadence = "ALL_AT_ONCE" | "ONE_BY_ONE" | "GROUPED"
type CalendarType = "CALENDLY" | "GOOGLE_CALENDAR" | "OUTLOOK_CALENDAR" | "CUSTOM"
type ButtonSize = "SMALL" | "MEDIUM" | "LARGE"

interface Field {
  id: string
  type: FieldType
  label: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  options?: string[]
}

interface LogicConfig {
  name: string
  description?: string
  type: LogicType
  triggerType: TriggerType
  keywords?: string[]
  showAlways?: boolean
  showAtEnd?: boolean
  showOnButton?: boolean
  isActive: boolean
  position?: number
  
  // Type-specific configs
  leadCollection?: {
    formTitle: string
    formDesc?: string
    leadTiming: LeadTiming
    leadFormStyle: LeadFormStyle
    cadence: Cadence
    fields: Field[]
    successMessage?: string
    redirectUrl?: string
    autoClose: boolean
    showThankYou: boolean
    notifyEmail?: string
    webhookUrl?: string
  }
  
  linkButton?: {
    buttonText: string
    buttonIcon?: string
    buttonLink: string
    openInNewTab: boolean
    buttonColor?: string
    textColor?: string
    buttonSize: ButtonSize
  }
  
  meetingSchedule?: {
    calendarType: CalendarType
    calendarLink: string
    calendarId?: string
    duration?: number
    timezone?: string
    titleFormat?: string
    description?: string
    availabilityDays?: number[]
    availabilityHours?: { start: string; end: string }
    bufferTime?: number
    showTimezoneSelector: boolean
    requireConfirmation: boolean
  }
}

export default function LogicPage() {
  const params = useParams();
  const router = useRouter();
  const chatbotId = params.id as string;
  const [activeTab, setActiveTab] = useState("features")
  const [isLoading, setIsLoading] = useState(false)

  const features: Feature[] = [
    {
      id: "collect-leads",
      icon: <List className="w-5 h-5" />,
      title: "Collect leads",
      description: "Add a form to request info.",
    },
    {
      id: "link-button",
      icon: <Link2 className="w-5 h-5" />,
      title: "Link button",
      description: "Display button to open a URL.",
    },
    {
      id: "schedule-meeting",
      icon: <Calendar className="w-5 h-5" />,
      title: "Schedule meeting",
      description: "Display inline calendar for scheduling",
    },
  ]

  const handleSaveLogic = async (logicConfig: LogicConfig) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/logic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logicConfig),
      })

      if (!response.ok) {
        throw new Error('Failed to save logic')
      }

      const data = await response.json()
      toast.success('Logic configuration saved successfully!')
      router.refresh()
      return data
    } catch (error) {
      console.error('Error saving logic:', error)
      toast.error('Failed to save logic configuration')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Custom message handler for the logic page
  const handleSendMessage = async (userMessage: string, previousMessages: any[]) => {
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        const responses = [
          "I've processed your logic request. What else would you like to configure?",
          "Understood! I'll apply that logic to the conversation flow.",
          "Logic feature activated. How else can I assist with your chatbot configuration?",
          "I've updated the conversation logic based on your input. Anything else you'd like to adjust?"
        ]
        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
        resolve(randomResponse)
      }, 800)
    })
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Panel with Tabs */}
      <div className="w-full lg:w-1/2 bg-muted/50 border-r overflow-y-auto no-scrollbar">
        <div className="max-h-screen p-4">
          <h1 className="text-2xl font-semibold mb-8">Logic Configuration</h1>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="features" className="space-y-8">
              {/* Features List */}
              <div className="flex flex-col gap-2">
                {features.map((feature) => (
                  <Card
                    key={feature.id}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-card"
                    onClick={() => setActiveTab(feature.id)}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-foreground">{feature.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                            {feature.badge && (
                              <Badge 
                                variant={feature.badge === "New" ? "default" : "secondary"} 
                                className="text-xs h-5"
                              >
                                {feature.badge}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            {/* Feature-specific Tabs */}
            {features.map((feature) => (
              <TabsContent key={feature.id} value={feature.id} className="space-y-8">
                {feature.id === "collect-leads" && (
                  <CollectLeadsForm 
                    onBack={() => setActiveTab("features")} 
                    onSave={handleSaveLogic}
                    isLoading={isLoading}
                  />
                )}
                {feature.id === "link-button" && (
                  <LinkButtonForm 
                    onBack={() => setActiveTab("features")} 
                    onSave={handleSaveLogic}
                    isLoading={isLoading}
                  />
                )}
                {feature.id === "schedule-meeting" && (
                  <ScheduleMeetingForm 
                    onBack={() => setActiveTab("features")} 
                    onSave={handleSaveLogic}
                    isLoading={isLoading}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Right Panel - Chat Preview */}
      <div className="hidden lg:block w-1/2 bg-background">
        <Chat
          id={chatbotId}
          showPreviewControls={true}
          onSendMessage={handleSendMessage}
          directive={`
            # Objective: You are a logic configuration assistant for a chatbot builder. Help users configure various logic features like lead collection, Zapier integrations, scheduling, and suggestions.
            # Style: Be technical but friendly. Provide clear explanations of logic features and their implications.
            # Rules: When users ask about specific logic features, explain how they work and how to configure them. If unsure, suggest they check the feature documentation.
          `}
        />
      </div>
    </div>
  )
}

// Enhanced CollectLeadsForm component
interface CollectLeadsFormProps {
  onBack: () => void
  onSave: (config: LogicConfig) => Promise<void>
  isLoading: boolean
}

export function CollectLeadsForm({ onBack, onSave, isLoading }: CollectLeadsFormProps) {
  const [fields, setFields] = useState<Field[]>([
    { id: "1", type: "TEXT", label: "Name", required: true },
    { id: "2", type: "EMAIL", label: "Email", required: true },
    { id: "3", type: "PHONE", label: "Phone" },
    { id: "4", type: "TEXT", label: "Company" },
  ])
  const [name, setName] = useState("Lead Collection Form")
  const [description, setDescription] = useState("Collect leads from chatbot conversations")
  const [triggerType, setTriggerType] = useState<TriggerType>("KEYWORD")
  const [keywords, setKeywords] = useState<string[]>(["help", "info", "contact"])
  const [newKeyword, setNewKeyword] = useState("")
  const [showAlways, setShowAlways] = useState(false)
  const [showAtEnd, setShowAtEnd] = useState(false)
  const [showOnButton, setShowOnButton] = useState(false)
  const [isActive, setIsActive] = useState(true)
  
  const [leadTiming, setLeadTiming] = useState<LeadTiming>("BEGINNING")
  const [leadFormStyle, setLeadFormStyle] = useState<LeadFormStyle>("EMBEDDED")
  const [cadence, setCadence] = useState<Cadence>("ALL_AT_ONCE")
  const [formTitle, setFormTitle] = useState("Let's Connect")
  const [formDesc, setFormDesc] = useState("Just a couple details so we can better assist you!")
  const [successMessage, setSuccessMessage] = useState("Thank you! We'll be in touch soon.")
  const [redirectUrl, setRedirectUrl] = useState("")
  const [autoClose, setAutoClose] = useState(true)
  const [showThankYou, setShowThankYou] = useState(true)
  const [notifyEmail, setNotifyEmail] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")

  const fieldTypes: FieldType[] = ["TEXT", "EMAIL", "PHONE", "NUMBER", "CURRENCY", "DATE", "LINK"]

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword("")
    }
  }

  const removeKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(keyword => keyword !== keywordToRemove))
  }

  const addField = () => {
    const newId = Date.now().toString()
    setFields([...fields, { id: newId, type: "TEXT", label: `Field ${fields.length + 1}`, required: true }])
  }

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
  }

  const updateField = (id: string, updates: Partial<Field>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const handleSubmit = async () => {
    const config: LogicConfig = {
      name,
      description,
      type: "COLLECT_LEADS",
      triggerType,
      keywords: triggerType === "KEYWORD" ? keywords : undefined,
      showAlways: triggerType === "ALWAYS" ? true : undefined,
      showAtEnd: triggerType === "END_OF_CONVERSATION" ? true : undefined,
      showOnButton: triggerType === "MANUAL" ? true : undefined,
      isActive,
      leadCollection: {
        formTitle,
        formDesc,
        leadTiming,
        leadFormStyle,
        cadence,
        fields,
        successMessage,
        redirectUrl: redirectUrl || undefined,
        autoClose,
        showThankYou,
        notifyEmail: notifyEmail || undefined,
        webhookUrl: webhookUrl || undefined,
      }
    }

    await onSave(config)
    onBack()
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-foreground">Collect Leads</h2>
            <p className="text-xs text-muted-foreground">Configure lead collection form</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>{isActive ? "Active" : "Inactive"}</Label>
        </div>
      </div>

      <div className="p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Basic Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
          <div className="space-y-2">
            <Label>Logic Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter logic name" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter description" />
          </div>
        </div>

        {/* Trigger Configuration */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Trigger Configuration</h3>
          <div className="space-y-2">
            <Label>When to show form</Label>
            <Select value={triggerType} onValueChange={(value: TriggerType) => setTriggerType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KEYWORD">When keywords are mentioned</SelectItem>
                <SelectItem value="ALWAYS">Always show</SelectItem>
                <SelectItem value="MANUAL">Manual trigger (button)</SelectItem>
                <SelectItem value="END_OF_CONVERSATION">At end of conversation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {triggerType === "KEYWORD" && (
            <div className="space-y-2">
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.map(keyword => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button onClick={() => removeKeyword(keyword)} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newKeyword} 
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add keyword"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button variant="outline" onClick={addKeyword}>Add</Button>
              </div>
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Form Fields</h3>
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus className="w-4 h-4 mr-1" />
              Add Field
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map(field => (
              <Card key={field.id} className="p-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="cursor-move">
                    <GripVertical className="w-4 h-4" />
                  </Button>
                  <Select value={field.type} onValueChange={(value: FieldType) => updateField(field.id, { type: value })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    placeholder="Field label"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Required</Label>
                    <Switch 
                      checked={field.required} 
                      onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeField(field.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Form Settings */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Form Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Form Title</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>When to ask</Label>
              <Select value={leadTiming} onValueChange={(value: LeadTiming) => setLeadTiming(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNING">Beginning of conversation</SelectItem>
                  <SelectItem value="MIDDLE">Middle of conversation</SelectItem>
                  <SelectItem value="END">End of conversation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Form Style</Label>
              <Select value={leadFormStyle} onValueChange={(value: LeadFormStyle) => setLeadFormStyle(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMBEDDED">Embedded Form</SelectItem>
                  <SelectItem value="MESSAGES">Chat Messages</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cadence</Label>
              <Select value={cadence} onValueChange={(value: Cadence) => setCadence(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_AT_ONCE">All at once</SelectItem>
                  <SelectItem value="ONE_BY_ONE">One by one</SelectItem>
                  <SelectItem value="GROUPED">Grouped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Form Description</Label>
            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="space-y-2">
            <Label>Success Message</Label>
            <Input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Redirect URL (optional)</Label>
              <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Notification Email (optional)</Label>
              <Input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} type="email" placeholder="email@example.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL (optional)</Label>
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://webhook.example.com" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Auto-close after submission</Label>
              <p className="text-xs text-muted-foreground">Automatically close the form after successful submission</p>
            </div>
            <Switch checked={autoClose} onCheckedChange={setAutoClose} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Show thank you message</Label>
              <p className="text-xs text-muted-foreground">Display a thank you message after form submission</p>
            </div>
            <Switch checked={showThankYou} onCheckedChange={setShowThankYou} />
          </div>
        </div>

        {/* Actions */}
        <div className="border-t pt-4 flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Logic
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// LinkButtonForm Component
interface LinkButtonFormProps {
  onBack: () => void
  onSave: (config: LogicConfig) => Promise<void>
  isLoading: boolean
}

function LinkButtonForm({ onBack, onSave, isLoading }: LinkButtonFormProps) {
  const [name, setName] = useState("Link Button")
  const [description, setDescription] = useState("Add a clickable button to redirect users")
  const [triggerType, setTriggerType] = useState<TriggerType>("KEYWORD")
  const [keywords, setKeywords] = useState<string[]>(["help", "info"])
  const [newKeyword, setNewKeyword] = useState("")
  const [isActive, setIsActive] = useState(true)
  
  const [buttonText, setButtonText] = useState("Schedule Meeting")
  const [buttonIcon, setButtonIcon] = useState("Calendar")
  const [buttonLink, setButtonLink] = useState("https://calendly.com/your-link")
  const [openInNewTab, setOpenInNewTab] = useState(true)
  const [buttonColor, setButtonColor] = useState("#3b82f6")
  const [textColor, setTextColor] = useState("#ffffff")
  const [buttonSize, setButtonSize] = useState<ButtonSize>("MEDIUM")

  const icons = [
    "Calendar", "Clock", "Video", "Phone", "MessageSquare",
    "Mail", "Users", "User", "Globe", "Link", "ExternalLink",
    "ArrowRight", "ChevronRight", "Download", "Upload", "FileText"
  ]

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword("")
    }
  }

  const removeKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(keyword => keyword !== keywordToRemove))
  }

  const handleSubmit = async () => {
    const config: LogicConfig = {
      name,
      description,
      type: "LINK_BUTTON",
      triggerType,
      keywords: triggerType === "KEYWORD" ? keywords : undefined,
      showAlways: triggerType === "ALWAYS" ? true : undefined,
      showAtEnd: triggerType === "END_OF_CONVERSATION" ? true : undefined,
      showOnButton: triggerType === "MANUAL" ? true : undefined,
      isActive,
      linkButton: {
        buttonText,
        buttonIcon,
        buttonLink,
        openInNewTab,
        buttonColor,
        textColor,
        buttonSize,
      }
    }

    await onSave(config)
    onBack()
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-foreground">Link Button</h2>
            <p className="text-xs text-muted-foreground">Configure link button settings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>{isActive ? "Active" : "Inactive"}</Label>
        </div>
      </div>

      <div className="p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Basic Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
          <div className="space-y-2">
            <Label>Logic Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Trigger Configuration */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Trigger Configuration</h3>
          <div className="space-y-2">
            <Label>When to show button</Label>
            <Select value={triggerType} onValueChange={(value: TriggerType) => setTriggerType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KEYWORD">When keywords are mentioned</SelectItem>
                <SelectItem value="ALWAYS">Always show</SelectItem>
                <SelectItem value="MANUAL">Manual trigger</SelectItem>
                <SelectItem value="END_OF_CONVERSATION">At end of conversation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {triggerType === "KEYWORD" && (
            <div className="space-y-2">
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.map(keyword => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button onClick={() => removeKeyword(keyword)} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newKeyword} 
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add keyword"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button variant="outline" onClick={addKeyword}>Add</Button>
              </div>
            </div>
          )}
        </div>

        {/* Button Configuration */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Button Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Button Text</Label>
              <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Button Icon</Label>
              <Select value={buttonIcon} onValueChange={setButtonIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {icons.map(icon => (
                    <SelectItem key={icon} value={icon} className="flex items-center gap-2">
                      {getIconComponent(icon)}
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Button Size</Label>
              <Select value={buttonSize} onValueChange={(value: ButtonSize) => setButtonSize(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMALL">Small</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LARGE">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Open in new tab</Label>
              <div className="pt-2">
                <Switch checked={openInNewTab} onCheckedChange={setOpenInNewTab} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Button Link</Label>
            <Input value={buttonLink} onChange={(e) => setButtonLink(e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Button Color</Label>
              <div className="flex gap-2">
                <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} />
                <div className="w-10 h-10 rounded border" style={{ backgroundColor: buttonColor }} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-2">
                <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                <div className="w-10 h-10 rounded border" style={{ backgroundColor: textColor }} />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Preview</h3>
          <Card className="p-4">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Button 
                style={{ 
                  backgroundColor: buttonColor,
                  color: textColor,
                  padding: buttonSize === "SMALL" ? "0.5rem 1rem" : buttonSize === "LARGE" ? "1rem 2rem" : "0.75rem 1.5rem"
                }}
                className="gap-2"
              >
                {getIconComponent(buttonIcon)}
                {buttonText}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Clicking will {openInNewTab ? "open in new tab:" : "navigate to:"}<br />
                <code className="text-blue-500">{buttonLink}</code>
              </p>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="border-t pt-4 flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Logic
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ScheduleMeetingForm Component
interface ScheduleMeetingFormProps {
  onBack: () => void
  onSave: (config: LogicConfig) => Promise<void>
  isLoading: boolean
}

function ScheduleMeetingForm({ onBack, onSave, isLoading }: ScheduleMeetingFormProps) {
  const [name, setName] = useState("Schedule Meeting")
  const [description, setDescription] = useState("Allow users to schedule meetings directly from chat")
  const [triggerType, setTriggerType] = useState<TriggerType>("KEYWORD")
  const [keywords, setKeywords] = useState<string[]>(["meeting", "schedule", "call"])
  const [newKeyword, setNewKeyword] = useState("")
  const [isActive, setIsActive] = useState(true)
  
  const [calendarType, setCalendarType] = useState<CalendarType>("CALENDLY")
  const [calendarLink, setCalendarLink] = useState("your-calendar-link")
  const [duration, setDuration] = useState(30)
  const [timezone, setTimezone] = useState("UTC")
  const [titleFormat, setTitleFormat] = useState("Meeting with {company}")
  const [descriptionText, setDescriptionText] = useState("")
  const [bufferTime, setBufferTime] = useState(5)
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(true)
  const [requireConfirmation, setRequireConfirmation] = useState(false)

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword("")
    }
  }

  const removeKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(keyword => keyword !== keywordToRemove))
  }

  const handleSubmit = async () => {
    const config: LogicConfig = {
      name,
      description,
      type: "SCHEDULE_MEETING",
      triggerType,
      keywords: triggerType === "KEYWORD" ? keywords : undefined,
      showAlways: triggerType === "ALWAYS" ? true : undefined,
      showAtEnd: triggerType === "END_OF_CONVERSATION" ? true : undefined,
      showOnButton: triggerType === "MANUAL" ? true : undefined,
      isActive,
      meetingSchedule: {
        calendarType,
        calendarLink,
        duration,
        timezone,
        titleFormat,
        description: descriptionText || undefined,
        bufferTime,
        showTimezoneSelector,
        requireConfirmation,
      }
    }

    await onSave(config)
    onBack()
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-foreground">Schedule Meeting</h2>
            <p className="text-xs text-muted-foreground">Configure meeting scheduling</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>{isActive ? "Active" : "Inactive"}</Label>
        </div>
      </div>

      <div className="p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Basic Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
          <div className="space-y-2">
            <Label>Logic Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Trigger Configuration */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Trigger Configuration</h3>
          <div className="space-y-2">
            <Label>When to show calendar</Label>
            <Select value={triggerType} onValueChange={(value: TriggerType) => setTriggerType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KEYWORD">When keywords are mentioned</SelectItem>
                <SelectItem value="ALWAYS">Always show</SelectItem>
                <SelectItem value="MANUAL">Manual trigger (button)</SelectItem>
                <SelectItem value="END_OF_CONVERSATION">At end of conversation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {triggerType === "KEYWORD" && (
            <div className="space-y-2">
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.map(keyword => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button onClick={() => removeKeyword(keyword)} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newKeyword} 
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add keyword"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button variant="outline" onClick={addKeyword}>Add</Button>
              </div>
            </div>
          )}
        </div>

        {/* Calendar Configuration */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Calendar Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Calendar Type</Label>
              <Select value={calendarType} onValueChange={(value: CalendarType) => setCalendarType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALENDLY">Calendly</SelectItem>
                  <SelectItem value="GOOGLE_CALENDAR">Google Calendar</SelectItem>
                  <SelectItem value="OUTLOOK_CALENDAR">Outlook Calendar</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="EST">EST</SelectItem>
                  <SelectItem value="PST">PST</SelectItem>
                  <SelectItem value="CET">CET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buffer Time (minutes)</Label>
              <Input type="number" value={bufferTime} onChange={(e) => setBufferTime(parseInt(e.target.value) || 5)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Calendar Link</Label>
            <div className="flex items-center gap-2">
              {calendarType === "CALENDLY" && <span className="text-muted-foreground">calendly.com/</span>}
              <Input 
                value={calendarLink} 
                onChange={(e) => setCalendarLink(e.target.value)}
                placeholder={calendarType === "CALENDLY" ? "your-calendar-link" : "calendar-link"}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Meeting Title Format</Label>
            <Input value={titleFormat} onChange={(e) => setTitleFormat(e.target.value)} />
            <p className="text-xs text-muted-foreground">Use {"{company}"} or {"{name}"} for dynamic values</p>
          </div>
          <div className="space-y-2">
            <Label>Meeting Description (optional)</Label>
            <Input value={descriptionText} onChange={(e) => setDescriptionText(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Show timezone selector</Label>
              <p className="text-xs text-muted-foreground">Allow users to select their timezone</p>
            </div>
            <Switch checked={showTimezoneSelector} onCheckedChange={setShowTimezoneSelector} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require confirmation</Label>
              <p className="text-xs text-muted-foreground">Ask users to confirm before scheduling</p>
            </div>
            <Switch checked={requireConfirmation} onCheckedChange={setRequireConfirmation} />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Preview</h3>
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Schedule a Meeting</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {calendarType === "CALENDLY" 
                  ? `Available times will appear based on your Calendly link: calendly.com/${calendarLink}`
                  : `Meeting scheduling via ${calendarType}`}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Mon 9:00 AM", "Mon 10:00 AM", "Mon 11:00 AM", "Tue 9:00 AM", "Tue 10:00 AM", "Tue 11:00 AM"].map(time => (
                  <Button key={time} variant="outline" size="sm">{time}</Button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1">Cancel</Button>
                <Button className="flex-1">Schedule Meeting</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="border-t pt-4 flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Logic
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Helper function to get icon component
function getIconComponent(iconName: string) {
  const iconMap = {
    Calendar: <Calendar className="w-4 h-4" />,
    Clock: <Clock className="w-4 h-4" />,
    Video: <Video className="w-4 h-4" />,
    Phone: <Phone className="w-4 h-4" />,
    MessageSquare: <MessageSquare className="w-4 h-4" />,
    Mail: <Mail className="w-4 h-4" />,
    Users: <Users className="w-4 h-4" />,
    User: <User className="w-4 h-4" />,
    Globe: <Globe className="w-4 h-4" />,
    Link: <Link2 className="w-4 h-4" />,
    ExternalLink: <ExternalLink className="w-4 h-4" />,
    ArrowRight: <ArrowRight className="w-4 h-4" />,
    ChevronRight: <ChevronRight className="w-4 h-4" />,
    Download: <Download className="w-4 h-4" />,
    Upload: <Upload className="w-4 h-4" />,
    FileText: <FileText className="w-4 h-4" />,
  }
  return iconMap[iconName as keyof typeof iconMap] || <Calendar className="w-4 h-4" />
}