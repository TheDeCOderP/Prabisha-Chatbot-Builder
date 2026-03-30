// app/(dashboard)/chatbots/[id]/theme/page.tsx
"use client"

import { toast } from "sonner"
import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
  MousePointer2, 
  Layout, 
  ChevronLeft, 
  Palette, 
  Settings2 
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useChatbot } from "@/hooks/useChatbot"

import { WidgetThemeForm } from "@/components/forms/widget-form"
import { WindowThemeForm } from "@/components/forms/window-form"

interface ThemeFeature {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
}

export default function ThemePage() {
  const params = useParams()
  const router = useRouter()
  const chatbotId = params.id as string
  
  // Use the chatbot hook
  const { 
    chatbot, 
    isLoadingChatbot, 
    chatbotError,
    refetchChatbot 
  } = useChatbot({
    chatbotId,
  });

  console.log("Chatbot data in ThemePage:", chatbot)
  console.log("Theme data:", chatbot?.theme)

  const [activeTab, setActiveTab] = useState("selection")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  const [isDataReady, setIsDataReady] = useState(false)

  // Show error toast if chatbot fetch fails
  useEffect(() => {
    if (chatbotError) {
      toast.error(chatbotError)
    }
  }, [chatbotError])

  // Set data ready when chatbot is loaded
  useEffect(() => {
    if (!isLoadingChatbot && chatbot) {
      setIsDataReady(true)
    }
  }, [isLoadingChatbot, chatbot])

  const handleLivePreviewUpdate = useCallback((updatedTheme: any) => {
    // Send message to embedded chatbot widget iframe to update its theme
    const iframe = document.querySelector('iframe[src*="/embed/widget/"]') as HTMLIFrameElement
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'theme-update',
        theme: updatedTheme
      }, '*')
    }
    
    // Also send message to parent window (for embed.js button updates)
    window.postMessage({
      type: 'theme-update',
      chatbotId: chatbotId,
      theme: updatedTheme
    }, '*')
  }, [chatbotId])

  const themeFeatures: ThemeFeature[] = [
    {
      id: "widget",
      icon: <MousePointer2 className="w-5 h-5" />,
      title: "Chat Widget",
      description: "Customize the bubble icon, position, and colors.",
    },
    {
      id: "window",
      icon: <Layout className="w-5 h-5" />,
      title: "Chat Window",
      description: "Configure the header, messages, and window style.",
    },
  ]

  const handleSaveTheme = async (themeData: any) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/theme`, {
        method: "PUT",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(themeData),
      })

      if (!response.ok) throw new Error('Failed to save theme')

      toast.success('Theme updated successfully!')
      
      // Refetch chatbot data to get updated theme
      await refetchChatbot()
      
      resetForm()
      router.refresh()
    } catch (error) {
      console.error('Error saving theme:', error)
      toast.error('Failed to save theme configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedFeature(null)
    setActiveTab("selection")
  }

  // Show loading state while fetching chatbot
  if (isLoadingChatbot || !isDataReady) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading theme settings...</p>
        </div>
      </div>
    )
  }

  // If chatbot is null after loading, show error
  if (!chatbot) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive">Failed to load chatbot data</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Now we can safely access chatbot.theme
  const existingTheme = chatbot.theme

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          
          {/* Main Selection View */}
          <TabsContent value="selection" className="space-y-4">
            <div className="flex flex-col gap-2">
              {themeFeatures.map((feature) => {
                const isConfigured = !!existingTheme && (
                   (feature.id === "widget" && existingTheme.widgetIcon) ||
                   (feature.id === "window" && existingTheme.headerBgColor)
                )

                return (
                  <Card
                    key={feature.id}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer hover:bg-card"
                    onClick={() => {
                      setSelectedFeature(feature.id)
                      setActiveTab(feature.id)
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-foreground">{feature.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                            {isConfigured && (
                              <Badge 
                                variant="outline" 
                                className="text-xs h-5 bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Active
                              </Badge>
                            )}
                            {feature.badge && (
                              <Badge variant="secondary" className="text-xs h-5">
                                {feature.badge}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Widget Configuration Form */}
          <TabsContent value="widget">
            <WidgetThemeForm 
              onBack={resetForm}
              onSave={handleSaveTheme}
              isLoading={isLoading}
              initial={existingTheme}
              onLiveUpdate={handleLivePreviewUpdate}
              chatbotData={chatbot}
            />
          </TabsContent>

          {/* Window Configuration Form */}
          <TabsContent value="window">
            <WindowThemeForm 
              onBack={resetForm}
              onSave={handleSaveTheme}
              isLoading={isLoading}
              initial={existingTheme}
              chatbotId={chatbotId}
              onLiveUpdate={handleLivePreviewUpdate}
              chatbotData={chatbot}
            />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}