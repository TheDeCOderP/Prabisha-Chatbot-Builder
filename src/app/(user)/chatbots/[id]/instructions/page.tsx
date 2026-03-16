"use client"

import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Loader2, Save, Bot, FileText, MessageSquare, Cpu, ImageIcon, User, Languages, TextInitial, Check } from "lucide-react"
import { useChatbot, SUPPORTED_LANGUAGES, LanguageCode } from "@/providers/chatbot-provider"
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
  const [name, setName]               = useState("");
  const [directive, setDirective]     = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar]           = useState("");
  const [icon, setIcon]               = useState("");

  useEffect(() => {
    if (config.id) {
      setName(config.name || "");
      setDirective(config.directive || "");
      setDescription(config.description || "");
      setAvatar(config.avatar || "");
      setIcon(config.icon || "");
    }
  }, [config.id, config.name, config.directive, config.description, config.avatar, config.icon]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'icon') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        type === 'avatar' ? setAvatar(base64) : setIcon(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      updateConfig({ name, directive, description });

      const formData = new FormData();
      formData.append("name", name);
      formData.append("directive", directive);
      formData.append("description", description);
      formData.append("greeting", JSON.stringify([config.greeting]));

      if (avatar?.startsWith('data:image')) {
        const blob = await fetch(avatar).then(r => r.blob());
        formData.append("avatar", blob, "avatar.png");
      }
      if (icon?.startsWith('data:image')) {
        const blob = await fetch(icon).then(r => r.blob());
        formData.append("icon", blob, "icon.png");
      }

      const res = await fetch(`/api/chatbots/${config.id}`, { method: "PUT", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      await refreshConfig();
      toast.success("Changes saved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  };

  if (!config.id) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeLangMeta = SUPPORTED_LANGUAGES.find(l => l.code === activeLang)!;
  const filledLangs = SUPPORTED_LANGUAGES.filter(l => config.greeting[l.code]?.trim()).length;

  return (
    <div className="space-y-6">

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="name">
          <Bot className="h-5 w-5 text-violet-500" />
          Chatbot Name
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aria, HelpBot, SupportAI…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          <TextInitial className="h-5 w-5 text-sky-500" />
          Description
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px] resize-none"
          placeholder="Describe your chatbot's purpose and functionality…"
          rows={3}
        />
        <p className="text-xs text-muted-foreground pl-0.5">
          A brief description of what your chatbot does.
        </p>
      </div>

      <hr />

      {/* ── Visuals ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Label>
          <ImageIcon className="h-5 w-5 text-pink-500" />
          Images
        </Label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avatar */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-1.5 mb-1">
              <User className="h-5 w-5 text-orange-500" />
              <span className="text-xs font-medium">Avatar</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Header image</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 rounded-lg border-2 bg-background flex items-center justify-center overflow-hidden">
                {avatar
                  ? <Image src={avatar} alt="Avatar" width={56} height={56} className="h-full w-full object-contain" />
                  : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 space-y-1">
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs cursor-pointer h-8"
                  onChange={(e) => handleImageUpload(e, 'avatar')}
                />
                <p className="text-[10px] text-muted-foreground">200×200px PNG recommended</p>
              </div>
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Bot className="h-5 w-5 text-teal-500" />
              <span className="text-xs font-medium">Bot Icon</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Message bubble</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 rounded-lg border-2 bg-background flex items-center justify-center overflow-hidden">
                {icon
                  ? <Image src={icon} alt="Icon" width={56} height={56} className="h-full w-full object-contain" />
                  : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 space-y-1">
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs cursor-pointer h-8"
                  onChange={(e) => handleImageUpload(e, 'icon')}
                />
                <p className="text-[10px] text-muted-foreground">100×100px PNG recommended</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr />

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Label>
          <Languages className="h-5 w-5 text-emerald-500" />
          Greeting Message
        </Label>

        {/* Language tabs */}
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isFilled = !!config.greeting[lang.code]?.trim();
            const isActive = activeLang === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setActiveLang(lang.code)}
                className={`
                  relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium
                  transition-colors
                  ${isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-input hover:bg-muted'
                  }
                `}
              >
                <img
                  src={lang.img}
                  alt={lang.name}
                  className="w-4 h-4 rounded-sm object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                {lang.name}
                {isFilled && (
                  <span className={`
                    absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full
                    ${isActive ? 'bg-primary-foreground/70' : 'bg-emerald-500'}
                  `} />
                )}
              </button>
            );
          })}
        </div>

        <Textarea
          key={activeLang}
          value={config.greeting[activeLang] || ""}
          onChange={(e) => updateGreetingField(activeLang, e.target.value)}
          dir={activeLangMeta.dir}
          className={`min-h-[120px] resize-none ${activeLang === 'ar' ? 'text-right' : ''}`}
          placeholder={activeLangMeta.placeholder}
          rows={4}
        />
        <p className="text-xs text-muted-foreground pl-0.5">
          The first message users see when they open the chatbot. Missing translations are auto-filled on save.
        </p>
      </div>

      <hr />

      {/* ── Directive ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="directive">
          <Cpu className="h-5 w-5 text-amber-500" />
          Instructions & Personality
        </Label>

        <Textarea
          id="directive"
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          className="min-h-[280px] font-mono text-sm resize-none"
          placeholder={`Example: You are a helpful customer support assistant for an e-commerce store.\n- Always be polite and professional\n- Keep responses concise\n- If you don't know something, offer to connect with a human agent\n- Never share internal company information`}
          rows={12}
        />
        <div className="flex justify-between text-xs text-muted-foreground pl-0.5">
          <span>Define personality, tone, response length, and limitations.</span>
          <span className="font-mono tabular-nums">{directive.length} chars</span>
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