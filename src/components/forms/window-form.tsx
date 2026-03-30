"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, Save, ChevronLeft, MessageSquare, Palette, Layout, User, ImageIcon } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface WindowThemeFormProps {
  onBack: () => void
  onSave: (data: any) => Promise<void>
  isLoading: boolean
  initial?: any
  chatbotId?: string
  onLiveUpdate?: (theme: any) => void
  chatbotData?: any // Pass the full chatbot data to access avatar/icon
}

export function WindowThemeForm({ 
  onBack, 
  onSave, 
  isLoading, 
  initial, 
  chatbotId, 
  onLiveUpdate,
  chatbotData 
}: WindowThemeFormProps) {
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

  // Separate state for avatar (from Chatbot model, not theme)
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

  // Initialize form data from initial prop (theme data)
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
      
      // Initialize avatar from chatbotData
      if (chatbotData) {
        if (chatbotData.avatar) {
          setAvatarData({
            type: "URL",
            value: chatbotData.avatar,
            emojiValue: "🤖",
            svgValue: "",
          })
        } else if (chatbotData.avatarEmoji) {
          setAvatarData({
            type: "EMOJI",
            value: chatbotData.avatarEmoji,
            emojiValue: chatbotData.avatarEmoji,
            svgValue: "",
          })
        } else if (chatbotData.avatarSvg) {
          setAvatarData({
            type: "SVG",
            value: chatbotData.avatarSvg,
            emojiValue: "🤖",
            svgValue: chatbotData.avatarSvg,
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
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setSelectedFile(file);
      // Show preview immediately
      const previewUrl = URL.createObjectURL(file);
      setAvatarData({
        type: "URL",
        value: previewUrl,
        emojiValue: "🤖",
        svgValue: "",
      });
    }
  };

  const handleSubmit = async () => {
    setIsAvatarLoading(true);
    
    try {
      // Upload avatar file if selected
      if (selectedFile && chatbotId) {
        const uploadFormData = new FormData();
        uploadFormData.append('avatar', selectedFile);
        
        const uploadResponse = await fetch(`/api/chatbots/${chatbotId}`, {
          method: "PUT",
          body: uploadFormData,
        });
        
        if (!uploadResponse.ok) throw new Error('Failed to upload avatar');
        
        const uploadData = await uploadResponse.json();
        console.log('Avatar uploaded:', uploadData);
        
        // Update avatar data with the new URL
        setAvatarData({
          type: "URL",
          value: uploadData.chatbot.avatar,
          emojiValue: "🤖",
          svgValue: "",
        });
        
        toast.success('Avatar uploaded successfully');
        setSelectedFile(null);
      }
      
      // Save avatar emoji or SVG if they changed (and no file upload)
      if (!selectedFile && chatbotId) {
        const avatarPayload: any = {};
        
        if (avatarData.type === "EMOJI" && avatarData.value !== chatbotData?.avatarEmoji) {
          avatarPayload.avatarEmoji = avatarData.value;
          avatarPayload.avatar = null;
          avatarPayload.avatarSvg = null;
        } else if (avatarData.type === "SVG" && avatarData.value !== chatbotData?.avatarSvg) {
          avatarPayload.avatarSvg = avatarData.value;
          avatarPayload.avatar = null;
          avatarPayload.avatarEmoji = null;
        } else if (avatarData.type === "URL" && avatarData.value !== chatbotData?.avatar && !avatarData.value.startsWith('blob:')) {
          // Only save if it's a permanent URL (not a blob preview)
          avatarPayload.avatar = avatarData.value;
          avatarPayload.avatarEmoji = null;
          avatarPayload.avatarSvg = null;
        }
        
        // Only make the request if there are changes
        if (Object.keys(avatarPayload).length > 0) {
          const avatarResponse = await fetch(`/api/chatbots/${chatbotId}`, {
            method: "PATCH",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(avatarPayload),
          });
          
          if (!avatarResponse.ok) throw new Error('Failed to save avatar');
          toast.success('Avatar saved successfully');
        }
      }
      
      // Save theme colors
      await onSave({
        ...initial,
        ...formData,
      });
      
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <div 
          className="relative w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden"
          onClick={() => document.getElementById(`color-input-${label.replace(/\s/g, '')}`)?.click()}
        >
          <div 
            className="absolute inset-0"
            style={{ backgroundColor: value }}
          />
          <input
            id={`color-input-${label.replace(/\s/g, '')}`}
            type="color" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            value={value} 
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs"
          placeholder="#000000"
        />
      </div>
    </div>
  );

  const AvatarSelector = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Chat Avatar</Label>
        <select 
          value={avatarData.type}
          onChange={(e) => setAvatarData({ ...avatarData, type: e.target.value as any })}
          className="text-xs border rounded-md px-2 py-1 bg-background"
        >
          <option value="EMOJI">Emoji</option>
          <option value="SVG">SVG Path</option>
          <option value="URL">Image Upload</option>
        </select>
      </div>

      {avatarData.type === "EMOJI" && (
        <div className="space-y-2">
          <Input 
            value={avatarData.value || avatarData.emojiValue}
            onChange={(e) => setAvatarData({ 
              ...avatarData, 
              value: e.target.value,
              emojiValue: e.target.value 
            })}
            placeholder="Enter emoji (e.g., 🤖)"
            className="font-mono"
          />
        </div>
      )}

      {avatarData.type === "SVG" && (
        <div className="space-y-2">
          <textarea 
            value={avatarData.value || avatarData.svgValue}
            onChange={(e) => setAvatarData({ 
              ...avatarData, 
              value: e.target.value,
              svgValue: e.target.value 
            })}
            placeholder='Paste SVG path or code (e.g., <path d="..." />)'
            className="w-full min-h-[80px] px-3 py-2 text-xs font-mono border rounded-md bg-background resize-none"
          />
        </div>
      )}

      {avatarData.type === "URL" && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 p-3 border rounded-md bg-muted/30">
            <div className="h-12 w-12 shrink-0 rounded-md border bg-background flex items-center justify-center overflow-hidden">
              {avatarData.value && !avatarData.value.startsWith('blob:') ? (
                <Image src={avatarData.value} alt="Avatar" width={48} height={48} className="h-full w-full object-contain" />
              ) : avatarData.value && avatarData.value.startsWith('blob:') ? (
                <img src={avatarData.value} alt="Avatar Preview" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Input 
                type="file" 
                accept="image/*"
                className="text-xs cursor-pointer"
                onChange={handleFileSelect}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Recommended: 48×48px PNG or SVG. Max 5MB</p>
        </div>
      )}
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
            <p className="text-xs text-muted-foreground">Customize chat window colors and avatar</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        
        {/* Avatar Section - Separate from theme colors */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="w-4 h-4 text-orange-500" />
            Chat Avatar
          </div>
          
          <AvatarSelector />
          <p className="text-[11px] text-muted-foreground mt-2">
            Note: The avatar appears in the chat header and next to bot messages.
          </p>
        </div>

        <hr />

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
                label="Bot Background" 
                value={formData.botMessageBgColor}
                onChange={(v) => setFormData({ ...formData, botMessageBgColor: v })}
              />
              <ColorPicker 
                label="Bot Text" 
                value={formData.botMessageTextColor}
                onChange={(v) => setFormData({ ...formData, botMessageTextColor: v })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">User Messages</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColorPicker 
                label="User Background" 
                value={formData.userMessageBgColor}
                onChange={(v) => setFormData({ ...formData, userMessageBgColor: v })}
              />
              <ColorPicker 
                label="User Text" 
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
              label="Suggestion Background" 
              value={formData.quickSuggestionBgColor}
              onChange={(v) => setFormData({ ...formData, quickSuggestionBgColor: v })}
            />
            <ColorPicker 
              label="Suggestion Text" 
              value={formData.quickSuggestionTextColor}
              onChange={(v) => setFormData({ ...formData, quickSuggestionTextColor: v })}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-background border-t pt-4 mt-6 flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || isAvatarLoading} className="flex-1">
            {(isLoading || isAvatarLoading) ? (
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