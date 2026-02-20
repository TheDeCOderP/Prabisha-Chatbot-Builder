"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Save, ChevronLeft, MessageSquare, Palette, Layout } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface WindowThemeFormProps {
  onBack: () => void
  onSave: (data: any) => Promise<void>
  isLoading: boolean
  initial?: any
  onLiveUpdate?: (theme: any) => void
}

export function WindowThemeForm({ onBack, onSave, isLoading, initial, onLiveUpdate }: WindowThemeFormProps) {
  const [formData, setFormData] = useState({
    // Header Colors
    headerBgColor: "#1320AA",
    headerTextColor: "#ffffff",
    
    // Message Bubble Colors
    botMessageBgColor: "#f1f5f9",
    botMessageTextColor: "#0f172a",
    userMessageBgColor: "#1320AA",
    userMessageTextColor: "#ffffff",
    
    // Input Area Colors
    inputBgColor: "#ffffff",
    inputBorderColor: "#e2e8f0",
    inputButtonColor: "#DD692E",
    
    // Close Button Colors
    closeButtonColor: "#000000",
    closeButtonBgColor: "#DD692E",
    
    // Quick Suggestions Colors
    quickSuggestionBgColor: "#ffffff",
    quickSuggestionTextColor: "#0f172a",
  })

  // Use a ref to track if we're currently updating to prevent loops
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  // Initialize form data from initial prop
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
      })
      isInitializedRef.current = true
    }
  }, [initial])

  // Debounced live preview update
  useEffect(() => {
    if (onLiveUpdate && isInitializedRef.current) {
      // Clear any existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      // Set a new timeout to update after 100ms of no changes
      updateTimeoutRef.current = setTimeout(() => {
        const updatedTheme = {
          ...initial,
          ...formData,
        }
        onLiveUpdate(updatedTheme)
      }, 100)
    }

    // Cleanup timeout on unmount
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
    // Only depend on formData, not initial or onLiveUpdate to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData])

  const handleSubmit = async () => {
    await onSave({
      ...initial,
      ...formData,
    })
  }

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input 
          type="color" 
          className="w-12 h-10 p-1 cursor-pointer" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
        />
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs"
          placeholder="#000000"
        />
      </div>
    </div>
  )

  return (
    <>
      <div className="border-b py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-foreground text-sm">Window Customization</h2>
            <p className="text-xs text-muted-foreground">Customize chat window colors and appearance</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        
        {/* Header Colors */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Layout className="w-4 h-4" />
            Header Colors
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker 
              label="Header Background" 
              value={formData.headerBgColor}
              onChange={(v) => setFormData({ ...formData, headerBgColor: v })}
            />
            <ColorPicker 
              label="Header Text" 
              value={formData.headerTextColor}
              onChange={(v) => setFormData({ ...formData, headerTextColor: v })}
            />
          </div>
        </div>

        {/* Message Bubble Colors */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="w-4 h-4" />
            Message Bubbles
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Bot Messages</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColorPicker 
                label="Background" 
                value={formData.botMessageBgColor}
                onChange={(v) => setFormData({ ...formData, botMessageBgColor: v })}
              />
              <ColorPicker 
                label="Text" 
                value={formData.botMessageTextColor}
                onChange={(v) => setFormData({ ...formData, botMessageTextColor: v })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">User Messages</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColorPicker 
                label="Background" 
                value={formData.userMessageBgColor}
                onChange={(v) => setFormData({ ...formData, userMessageBgColor: v })}
              />
              <ColorPicker 
                label="Text" 
                value={formData.userMessageTextColor}
                onChange={(v) => setFormData({ ...formData, userMessageTextColor: v })}
              />
            </div>
          </div>
        </div>

        {/* Input Area Colors */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="w-4 h-4" />
            Input Area
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColorPicker 
              label="Input Background" 
              value={formData.inputBgColor}
              onChange={(v) => setFormData({ ...formData, inputBgColor: v })}
            />
            <ColorPicker 
              label="Input Border" 
              value={formData.inputBorderColor}
              onChange={(v) => setFormData({ ...formData, inputBorderColor: v })}
            />
            <ColorPicker 
              label="Send Button" 
              value={formData.inputButtonColor}
              onChange={(v) => setFormData({ ...formData, inputButtonColor: v })}
            />
          </div>
        </div>

        {/* Close Button Colors */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="w-4 h-4" />
            Close Button
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker 
              label="Button Background" 
              value={formData.closeButtonBgColor}
              onChange={(v) => setFormData({ ...formData, closeButtonBgColor: v })}
            />
            <ColorPicker 
              label="Icon Color" 
              value={formData.closeButtonColor}
              onChange={(v) => setFormData({ ...formData, closeButtonColor: v })}
            />
          </div>
        </div>

        {/* Quick Suggestions Colors */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="w-4 h-4" />
            Quick Suggestions
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker 
              label="Background" 
              value={formData.quickSuggestionBgColor}
              onChange={(v) => setFormData({ ...formData, quickSuggestionBgColor: v })}
            />
            <ColorPicker 
              label="Text" 
              value={formData.quickSuggestionTextColor}
              onChange={(v) => setFormData({ ...formData, quickSuggestionTextColor: v })}
            />
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="sticky bottom-0 bg-background border-t pt-4 mt-6 flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Window Settings
          </Button>
        </div>
      </div>
    </>
  )
}