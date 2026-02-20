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
import { useChatbot } from "@/providers/chatbot-provider"

// You would create these form components separately 
// similar to LinkButtonForm in your Logic page
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
  const { config, updateConfig } = useChatbot()

  const [activeTab, setActiveTab] = useState("selection")
  const [isLoading, setIsLoading] = useState(false)
  const [existingTheme, setExistingTheme] = useState<any>(null)
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)

  useEffect(() => {
    fetchTheme()
  }, [chatbotId])

  const fetchTheme = async () => {
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/theme`)
      if (!response.ok) throw new Error('Failed to fetch theme')
      const data = await response.json()
      setExistingTheme(data.theme || null)
      // Update the provider's config with the theme
      if (data.theme) {
        updateConfig({ theme: data.theme })
      }
    } catch (error) {
      console.error('Error fetching theme:', error)
      toast.error('Failed to load theme settings')
    }
  }

  const handleLivePreviewUpdate = useCallback((updatedTheme: any) => {
    // Update the provider's config for live preview
    updateConfig({ theme: updatedTheme })
    
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
  }, [updateConfig, chatbotId])

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
      await fetchTheme()
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
            />
          </TabsContent>

          {/* Window Configuration Form */}
          <TabsContent value="window">
             <WindowThemeForm 
              onBack={resetForm}
              onSave={handleSaveTheme}
              isLoading={isLoading}
              initial={existingTheme}
              onLiveUpdate={handleLivePreviewUpdate}
            />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}