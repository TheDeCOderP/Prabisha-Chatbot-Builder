"use client"

import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Check, Info, Loader2, ImageIcon } from "lucide-react"
import { useChatbot, SUPPORTED_LANGUAGES, LanguageCode } from "@/providers/chatbot-provider"
import { Input } from "@/components/ui/input"
import Image from "next/image"

export default function InstructionsPage() {
  const {
    config,
    updateConfig,
    updateGreetingField,
    refreshConfig,
    activeLang,
    setActiveLang,
  } = useChatbot();

  const [isLoading, setIsLoading] = useState(false);

  // Local state for fields that aren't managed in context
  const [name, setName]             = useState("");
  const [directive, setDirective]   = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar]         = useState("");
  const [icon, setIcon]             = useState("");

  // Single effect to initialise from config
  useEffect(() => {
    if (config.id) {
      setName(config.name || "");
      setDirective(config.directive || "");
      setDescription(config.description || "");
      setAvatar(config.avatar || "");
      setIcon(config.icon || "");
    }
  }, [config.id, config.name, config.directive, config.description, config.avatar, config.icon]);

  // Handle image upload to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'icon') => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        if (type === 'avatar') setAvatar(base64String)
        else setIcon(base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Optimistically update context
      updateConfig({ name, directive, description });

      const formData = new FormData();
      formData.append("name", name);
      formData.append("directive", directive);
      formData.append("description", description);

      // Serialize multilingual greeting as Json[] (single-element array)
      formData.append("greeting", JSON.stringify([config.greeting]));

      // Images — only send if newly uploaded (base64)
      if (avatar && avatar.startsWith('data:image')) {
        const blob = await fetch(avatar).then(r => r.blob());
        formData.append("avatar", blob, "avatar.png");
      }
      if (icon && icon.startsWith('data:image')) {
        const blob = await fetch(icon).then(r => r.blob());
        formData.append("icon", blob, "icon.png");
      }

      const response = await fetch(`/api/chatbots/${config.id}`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      await refreshConfig();
      toast.success("Changes saved successfully!");
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  }

  if (!config.id) {
    return (
      <div className="flex min-h-[100px] w-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeLangMeta = SUPPORTED_LANGUAGES.find(l => l.code === activeLang)!

  return (
    <div className="space-y-6">

      {/* ── Images ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/30">
        {/* Avatar */}
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
              <p className="text-[10px] text-muted-foreground mt-1">Recommended: 200x200px PNG</p>
            </div>
          </div>
        </div>

        {/* Icon */}
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
              <p className="text-[10px] text-muted-foreground mt-1">Recommended: 100x100px PNG</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Name ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor="name" className="text-sm font-medium">Chatbot Name</Label>
          <Info className="w-4 h-4 text-muted-foreground" />
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

      {/* ── Description ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
          <Info className="w-4 h-4 text-muted-foreground" />
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

      {/* ── Greeting (multilingual) ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Label className="text-sm font-medium">Greeting Message</Label>
          <Info className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Language picker — same pattern as suggestions tab */}
        <div className="flex flex-wrap gap-2 mb-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isFilled = !!config.greeting[lang.code]?.trim()
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setActiveLang(lang.code)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium
                  transition-colors relative
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
                {/* Green dot if this language has a value */}
                {isFilled && (
                  <span className={`
                    w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-0.5
                    ${activeLang === lang.code ? 'bg-primary-foreground/70' : 'bg-green-500'}
                  `} />
                )}
              </button>
            )
          })}
        </div>

        {/* Textarea for active language */}
        <Textarea
          key={activeLang}   // remount on lang switch so dir/placeholder refresh
          value={config.greeting[activeLang] || ""}
          onChange={(e) => updateGreetingField(activeLang, e.target.value)}
          dir={activeLangMeta.dir}
          className={`min-h-[120px] resize-none ${activeLang === 'ar' ? 'text-right' : ''}`}
          placeholder={activeLangMeta.placeholder}
          rows={4}
        />

        <div className="text-xs text-muted-foreground mt-2 space-y-1">
          <p>The first message users see when they open the chatbot.</p>
          <p>
            Filled in&nbsp;
            <span className="font-medium text-foreground">
              {SUPPORTED_LANGUAGES.filter(l => config.greeting[l.code]?.trim()).length}
              /{SUPPORTED_LANGUAGES.length}
            </span>
            &nbsp;languages — missing translations are auto-filled on save.
          </p>
        </div>
      </div>

      {/* ── Directive ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor="directive" className="text-sm font-medium">
            Instructions & Personality
          </Label>
          <Info className="w-4 h-4 text-muted-foreground" />
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

      {/* ── Save ── */}
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