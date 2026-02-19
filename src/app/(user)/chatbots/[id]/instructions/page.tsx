"use client"

import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Check, Info, Loader2, Plus, Trash2, X, ImageIcon, Upload } from "lucide-react"
import { useChatbot } from "@/providers/chatbot-provider"
import { Input } from "@/components/ui/input"
import Image from "next/image"

interface Message {
  senderType: "USER" | "BOT";
  content: string;
}

export default function InstructionsPage() {
  const { 
    config, 
    updateConfig, 
    refreshConfig,
  } = useChatbot();

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { senderType: "BOT", content: config.greeting }
  ]);

  // Initialize local state from context - use a single useEffect
  const [name, setName] = useState("");
  const [directive, setDirective] = useState("");
  const [greeting, setGreeting] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [icon, setIcon] = useState("");

  // Single effect to initialize all state from config
  useEffect(() => {
    if (config.id) {
      setName(config.name || "");
      setDirective(config.directive || "");
      setGreeting(config.greeting || "How can I help you today?");
      setDescription(config.description || "");
      setAvatar(config.avatar || "");
      setIcon(config.icon || "");
      setMessages([{ senderType: "BOT", content: config.greeting || "How can I help you today?" }]);
    }
  }, [config.id, config.name, config.directive, config.greeting, config.description, config.avatar, config.icon]); // Added all dependencies

  // Handle image upload to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'icon') => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        if (type === 'avatar') {
          setAvatar(base64String)
        } else {
          setIcon(base64String)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setIsLoading(true);
    
    try {
      const updates = {
        name,
        greeting,
        directive,
        description,
        avatar,
        icon,
        suggestions: config.suggestions // Use the suggestions from context, not local state
      };

      // Update local context immediately for better UX
      updateConfig(updates);

      // Use FormData for consistency with PUT endpoint
      const formData = new FormData();
      formData.append("name", name);
      formData.append("greeting", greeting);
      formData.append("directive", directive);
      formData.append("description", description);
      
      // Handle avatar - if it's base64, convert to blob; if it's a URL, don't send it
      if (avatar && avatar.startsWith('data:image')) {
        const avatarBlob = await fetch(avatar).then(r => r.blob());
        formData.append("avatar", avatarBlob, "avatar.png");
      }
      
      // Handle icon - if it's base64, convert to blob; if it's a URL, don't send it
      if (icon && icon.startsWith('data:image')) {
        const iconBlob = await fetch(icon).then(r => r.blob());
        formData.append("icon", iconBlob, "icon.png");
      }
      
      const response = await fetch(`/api/chatbots/${config.id}`, {
        method: "PUT",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      // Refresh config from server to ensure consistency
      await refreshConfig();
      
      toast.success("Changes saved successfully!");
      
      // Update chat messages with new greeting
      setMessages([{ senderType: "BOT", content: greeting }]);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  }

  // If config is still loading or id is empty, show loading state
  if (!config.id) {
    return (
      <div className="flex min-h-[100px] w-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Images Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/30">
        {/* Avatar Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Avatar (Header Image)</Label>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg border-2 bg-background flex items-center justify-center overflow-hidden">
              {avatar ? (
                <Image src={avatar} alt="Avatar" width={64} height={64} className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Input 
                type="file" 
                accept="image/*"
                className="text-xs cursor-pointer"
                onChange={(e) => handleImageUpload(e, 'avatar')}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Recommended: 200x200px PNG
              </p>
            </div>
          </div>
        </div>

        {/* Icon Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Bot Icon (Messages)</Label>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg border-2 bg-background flex items-center justify-center overflow-hidden">
              {icon ? (
                <Image src={icon} alt="Icon" width={64} height={64} className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Input 
                type="file" 
                accept="image/*"
                className="text-xs cursor-pointer"
                onChange={(e) => handleImageUpload(e, 'icon')}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Recommended: 100x100px PNG
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Name Section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Chatbot Name
              </Label>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <Textarea
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-10 resize-none"
            placeholder="Enter your chatbot name..."
            rows={1}
          />
        </div>
      </div>

      {/* Description Section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px] resize-none"
            placeholder="Describe your chatbot's purpose and functionality..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-2">
            A brief description of what your chatbot does
          </p>
        </div>
      </div>

      {/* Greeting Section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="greeting" className="text-sm font-medium">
                Greeting Message
              </Label>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <Textarea
            id="greeting"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            className="min-h-[120px] resize-none"
            placeholder="How can I help you today?"
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-2">
            This is the first message users will see when they open the chatbot
          </p>
        </div>
      </div>

      {/* Directive Section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="directive" className="text-sm font-medium">
                Instructions & Personality
              </Label>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <Textarea
            id="directive"
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
            className="min-h-[280px] font-mono text-sm resize-none"
            placeholder={`Example: You are a helpful customer support assistant for an e-commerce store. 
- Always be polite and professional
- Keep responses concise
- If you don't know something, offer to connect with a human agent
- Never share internal company information`}
            rows={12}
          />
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            <p>Define your chatbot&apos;s personality, behavior, and instructions.</p>
            <p>Be specific about tone, response length, and limitations.</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t">
        <Button
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}