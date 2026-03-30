"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Save, ChevronLeft, Palette, MousePointer2, Upload, ImageIcon } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectItem, 
  SelectValue, 
  SelectContent, 
  SelectTrigger 
} from "@/components/ui/select"

import { ShapeType, BorderType, Position, WidgetIconType } from "../../../generated/prisma/enums"

interface WidgetThemeFormProps {
  onBack: () => void
  onSave: (data: any) => Promise<void>
  isLoading: boolean
  initial?: any
  onLiveUpdate?: (theme: any) => void
  chatbotData?: any
}

export function WidgetThemeForm({ onBack, onSave, isLoading, initial, onLiveUpdate, chatbotData }: WidgetThemeFormProps) {
  const [formData, setFormData] = useState({
    widgetIcon: "💬",
    widgetIconType: "EMOJI" as WidgetIconType,
    widgetText: "Chat with us",
    widgetSize: 70,
    widgetSizeMobile: 60,
    widgetColor: "#3b82f6",
    widgetShape: "ROUND" as ShapeType,
    widgetBorder: "FLAT" as BorderType,
    widgetBgColor: "#FFFFFF",
    widgetPosition: "BottomRight" as Position,
    widgetPadding: 0,
    widgetMargin: 20,
    popup_onload: false,
  })

  // Separate state for icon (from Chatbot model)
  const [iconData, setIconData] = useState({
    type: "IMAGE" as "EMOJI" | "IMAGE" | "SVG",
    value: "",
    emojiValue: "💬",
    svgValue: "",
  })

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  // Initialize form data from initial prop (theme data)
  useEffect(() => {
    console.log("Initializing widget form with data:", { initial, chatbotData })
    if (initial && !isInitializedRef.current) {
      setFormData({
        widgetIcon: initial.widgetIcon || "💬",
        widgetIconType: (initial.widgetIconType as WidgetIconType) || "EMOJI",
        widgetText: initial.widgetText || "Chat with us",
        widgetSize: initial.widgetSize || 70,
        widgetSizeMobile: initial.widgetSizeMobile || 60,
        widgetColor: initial.widgetColor || "#3b82f6",
        widgetShape: (initial.widgetShape as ShapeType) || "ROUND",
        widgetBorder: (initial.widgetBorder as BorderType) || "FLAT",
        widgetBgColor: initial.widgetBgColor || "#FFFFFF",
        widgetPosition: (initial.widgetPosition as Position) || "BottomRight",
        widgetPadding: initial.widgetPadding || 0,
        widgetMargin: initial.widgetMargin || 20,
        popup_onload: initial.popup_onload ?? false,
      })

      // Initialize icon from chatbotData
      if (chatbotData) {
        if (chatbotData.icon) {
          setIconData({
            type: "IMAGE",
            value: chatbotData.icon,
            emojiValue: "💬",
            svgValue: "",
          })
        } else if (chatbotData.widgetIconEmoji) {
          setIconData({
            type: "EMOJI",
            value: chatbotData.widgetIconEmoji,
            emojiValue: chatbotData.widgetIconEmoji,
            svgValue: "",
          })
        } else if (chatbotData.widgetIconSvg) {
          setIconData({
            type: "SVG",
            value: chatbotData.widgetIconSvg,
            emojiValue: "💬",
            svgValue: chatbotData.widgetIconSvg,
          })
        }
      }
      
      isInitializedRef.current = true
    }
  }, [initial, chatbotData])

  // Debounced live preview update
  useEffect(() => {
    if (onLiveUpdate && isInitializedRef.current) {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      updateTimeoutRef.current = setTimeout(() => {
        const updatedTheme = {
          ...initial,
          ...formData,
        }
        onLiveUpdate(updatedTheme)
      }, 100)
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [formData, initial, onLiveUpdate])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB')
        return
      }
      setSelectedFile(file)
      // Show preview
      const previewUrl = URL.createObjectURL(file)
      setIconData({
        type: "IMAGE",
        value: previewUrl,
        emojiValue: "💬",
        svgValue: "",
      })
    }
  }

  const handleSubmit = async () => {
    // If there's a file to upload, use FormData with the main endpoint
    if (selectedFile) {
      const formDataToSend = new FormData()
      formDataToSend.append('icon', selectedFile)
      
      // Also append widget settings if needed
      if (formData.widgetText) formDataToSend.append('widget_text', formData.widgetText)
      if (formData.widgetIconType) formDataToSend.append('widget_icon_type', formData.widgetIconType)
      // Add other widget settings as needed
      
      try {
        const response = await fetch(`/api/chatbots/${chatbotData?.id}`, {
          method: "PUT",
          body: formDataToSend,
        })
        
        if (!response.ok) throw new Error('Failed to save icon')
        toast.success('Icon uploaded and saved successfully')
        setSelectedFile(null)
      } catch (error) {
        console.error('Error uploading icon:', error)
        toast.error('Failed to upload icon')
      }
    }
    
    // Save the theme settings
    await onSave(formData)
  }

  return (
    <>
      <div className="border-b py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-foreground text-sm">Widget Customization</h2>
            <p className="text-xs text-muted-foreground">Adjust the look and feel of the chat bubble</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        
        {/* Icon Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MousePointer2 className="w-4 h-4" />
            Widget Icon
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Icon Type</Label>
              <select 
                value={iconData.type}
                onChange={(e) => setIconData({ ...iconData, type: e.target.value as any })}
                className="text-xs border rounded-md px-2 py-1 bg-background"
              >
                <option value="URL">Image URL</option>
                <option value="EMOJI">Emoji</option>
                <option value="SVG">SVG Path</option>
              </select>
            </div>

            {iconData.type === "EMOJI" && (
              <div className="space-y-2">
                <Input 
                  value={iconData.value || iconData.emojiValue}
                  onChange={(e) => setIconData({ 
                    ...iconData, 
                    value: e.target.value,
                    emojiValue: e.target.value 
                  })}
                  placeholder="Enter emoji (e.g., 💬)"
                  className="font-mono"
                />
              </div>
            )}

            {iconData.type === "SVG" && (
              <div className="space-y-2">
                <Textarea 
                  value={iconData.value || iconData.svgValue}
                  onChange={(e) => setIconData({ 
                    ...iconData, 
                    value: e.target.value,
                    svgValue: e.target.value 
                  })}
                  placeholder='Paste SVG path or code (e.g., <path d="..." />)'
                  className="font-mono text-xs min-h-[80px]"
                />
              </div>
            )}

            {iconData.type === "IMAGE" && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 p-3 border rounded-md bg-muted/30">
                  <div className="h-12 w-12 rounded-md border bg-background flex items-center justify-center overflow-hidden">
                    {iconData.value ? (
                      <img src={iconData.value} alt="Widget Icon" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Input 
                      type="file" 
                      accept="image/*"
                      className="text-xs"
                      onChange={handleFileSelect}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Recommended: 48×48px PNG or SVG. Max 5MB</p>
              </div>
            )}
          </div>
        </div>

        <hr />

        {/* Widget Appearance - Keep existing code */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="w-4 h-4" />
            Widget Appearance
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Widget Text</Label>
              <Input 
                value={formData.widgetText} 
                onChange={(e) => setFormData({ ...formData, widgetText: e.target.value })}
                placeholder="Tooltip text"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select 
                  value={formData.widgetPosition} 
                  onValueChange={(v: Position) => setFormData({ ...formData, widgetPosition: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BottomRight">Bottom Right</SelectItem>
                    <SelectItem value="BottomLeft">Bottom Left</SelectItem>
                    <SelectItem value="TopRight">Top Right</SelectItem>
                    <SelectItem value="TopLeft">Top Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="color" 
                    className="w-10 h-10 p-1 cursor-pointer" 
                    value={formData.widgetColor} 
                    onChange={(e) => setFormData({ ...formData, widgetColor: e.target.value })}
                  />
                  <Input 
                    value={formData.widgetColor} 
                    onChange={(e) => setFormData({ ...formData, widgetColor: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Widget Shape</Label>
                <Select 
                  value={formData.widgetShape} 
                  onValueChange={(v: ShapeType) => setFormData({ ...formData, widgetShape: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROUND">Round</SelectItem>
                    <SelectItem value="SQUARE">Square</SelectItem>
                    <SelectItem value="ROUNDED_SQUARE">Rounded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Size & Spacing - Keep existing code */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MousePointer2 className="w-4 h-4" />
            Size & Spacing
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Size (Desktop)</Label>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.widgetSize}px</span>
              </div>
              <Slider 
                value={[formData.widgetSize]} 
                min={40} max={100} step={1} 
                onValueChange={([v]) => setFormData({ ...formData, widgetSize: v })} 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Size (Mobile)</Label>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.widgetSizeMobile}px</span>
              </div>
              <Slider 
                value={[formData.widgetSizeMobile]} 
                min={40} max={80} step={1} 
                onValueChange={([v]) => setFormData({ ...formData, widgetSizeMobile: v })} 
              />
              <p className="text-[10px] text-muted-foreground">Recommended: 50-60px for mobile devices</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Distance from Edge</Label>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{formData.widgetMargin}px</span>
              </div>
              <Slider 
                value={[formData.widgetMargin]} 
                min={0} max={100} step={1} 
                onValueChange={([v]) => setFormData({ ...formData, widgetMargin: v })} 
              />
            </div>
          </div>
        </div>

        {/* Behavior Section */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-open on load</Label>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expand window by default</p>
            </div>
            <Switch 
              checked={formData.popup_onload} 
              onCheckedChange={(v) => setFormData({ ...formData, popup_onload: v })}
            />
          </div>
        </div>

        {/* Action Buttons */}
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
            Save Widget Settings
          </Button>
        </div>
      </div>
    </>
  )
}