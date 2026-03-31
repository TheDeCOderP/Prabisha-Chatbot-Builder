"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTypewriter } from "react-simple-typewriter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Zap,
  Users,
  Shield,
  ArrowRight,
  Play,
  X,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  BarChart3,
  UserPlus,
  TrendingUp,
  Globe,
  Sparkles,
  MessageSquare,
  Calendar,
  PieChart,
  Link2,
  Brain,
  Languages,
  Zap as ZapIcon,
  BarChart,
  Settings,
  Briefcase,
  CircleChevronRight,
} from "lucide-react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import Image from "next/image";
import InfiniteCarousel from "@/components/layout/carousel";
import { signIn } from "next-auth/react";

// ==================== Types ====================
interface Stat {
  icon: React.ElementType;
  label: string;
  value: string;
  change: string;
}

interface Feature {
  icon: React.ElementType;
  title: string;
  desc: string;
}

// ==================== Chat Widget Component ====================
interface ChatWidgetProps {
  className?: string;
  showTypewriter?: boolean;
  typewriterTexts?: string[];
  isDisabled?: boolean; // New prop to disable interaction
}


const handleLogin = async (callbackUrl = "/dashboard") => {
  try {
    await signIn("central-auth", { callbackUrl }, { prompt: "login" });
  } catch (error) {
    console.error("Central login error:", error);
  }
};

const ChatWidget = ({ 
  className = "", 
  showTypewriter = false,
  typewriterTexts = ["Type your message...", "Ask about pricing...", "Get support here..."],
  isDisabled = false 
}: ChatWidgetProps) => {
  const [inputValue, setInputValue] = useState(""); 
  
  const [typewriterEffect] = useTypewriter({
    words: typewriterTexts,
    loop: true,
    typeSpeed: 80,
    deleteSpeed: 50,
    delaySpeed: 2000,
  });

  const handleSuggestionClick = (text: string) => {
    if (!isDisabled) {
      setInputValue(text);
    }
  };

  return (
    <Card className={`w-[340px] flex-shrink-0 rounded-2xl shadow-2xl border-slate-100 overflow-hidden gap-0 py-0 ${isDisabled ? "opacity-70" : ""} ${className}`}>
      {/* Header */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/logo1.png" alt="AI Avatar" width={32} height={32} className="w-8 h-8 rounded-full" />
          <div>
            <div className="text-[12.5px] font-bold text-slate-800">Prabisha AI Assistant</div>
            <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Online · Instant Responses
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="w-5.5 h-5.5 bg-slate-100 rounded-full flex items-center justify-center cursor-pointer text-secondary text-[11px] hover:bg-slate-200 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </div>
          <div className="w-5.5 h-5.5 bg-slate-100 rounded-full flex items-center justify-center cursor-pointer text-secondary text-[11px] hover:bg-slate-200 transition-colors">
            <X className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Chat Body */}
      <div className="p-4 bg-slate-50 flex flex-col gap-3">
        <div className="self-end bg-primary text-primary-foreground rounded-[18px_18px_4px_18px] p-2.5 text-[12px] max-w-[80%]">
          Hi, I'm interested in your services.
        </div>
        <div className="flex items-start gap-2">
          <Image src="/logo1.png" alt="AI Avatar" width={26} height={26} className="w-6.5 h-6.5 rounded-full flex-shrink-0" />
          <div className="bg-white rounded-[18px_18px_18px_4px] p-2.5 text-[12px] text-slate-700 max-w-[80%] shadow-sm border border-slate-100">
            Hello! 👋 I'd be happy to help you. Can you tell me more about your requirements?
          </div>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1.5 pl-[34px]">
          {["Book a Demo", "Ask a Question", "Get a Quote"].map((text) => (
            <button
              key={text}
              disabled={isDisabled}
              onClick={() => handleSuggestionClick(text)}
              className={`text-[10px] border border-primary/30 text-primary rounded-full px-2.5 py-1 bg-transparent transition-colors font-medium ${
                isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-primary/10 active:scale-95"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-100">
        <div className={`flex items-center gap-2 bg-slate-50 rounded-full p-2 px-3.5 transition-all ${isDisabled ? "bg-slate-100" : "focus-within:ring-1 focus-within:ring-primary/20"}`}>
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isDisabled}
            placeholder={showTypewriter ? typewriterEffect : "Type your message..."}
            className="shadow-none rounded-none flex-1 bg-transparent border-none text-[12px] text-slate-600 placeholder:text-secondary focus-visible:ring-0 p-0 h-auto disabled:cursor-not-allowed"
          />
          <button 
            disabled={isDisabled || !inputValue.trim()}
            className="w-7 h-7 flex-shrink-0 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-none disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors hover:opacity-90"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </Card>
  );
};

// ==================== Hero Section Component ====================
const HeroSection = () => {
  return (
    <section className="overflow-hidden pt-[120px] pb-10 px-10 relative bg-gradient-to-br from-primary/5 via-white to-secondary/5">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-60px] right-[-60px] w-[500px] h-[500px] rounded-full bg-radial from-primary/10 to-transparent" />
      <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-radial from-secondary/5 to-transparent" />
      
      <div className="max-w-[1200px] mx-auto flex gap-20 relative z-10">
        <div className="flex-1 max-w-[560px]">
          {/* Badge using Primary/Secondary */}
          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide mb-5">
            <Star className="w-3 h-3 mr-1.5" />
            AI Chatbots for Business Growth
          </Badge>

          <h1 className="text-[52px] font-black leading-[1.08] tracking-tighter mb-[18px]">
            <span className="text-primary">AI</span> Chatbots That Convert<br />Conversations into Revenue
          </h1>

          <p className="text-[16.5px] text-slate-500 leading-relaxed mb-8">
            Automate support, capture leads, and scale customer interactions with intelligent AI — built for real business impact.
          </p>

          <div className="flex items-center gap-3 mb-9">
            {/* Primary Action Button */}
            <Button onClick={() => handleLogin()} className="rounded-full bg-primary text-primary-foreground text-[14.5px] font-bold h-auto py-3 px-6 flex items-center gap-2 hover:opacity-90 transition-opacity">
              Get Your AI Chatbot
              <ArrowRight className="w-4 h-4" />
            </Button>

            {/* Secondary Action Button */}
            <Button variant="outline" className="rounded-full border-slate-200 text-slate-800 text-[14.5px] font-bold h-auto py-3 px-6 flex items-center gap-2 hover:bg-slate-50">
              <Play className="w-4 h-4 fill-current" />
              See Live Demo
            </Button>
          </div>

          <div className="flex items-center gap-7 text-[13px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-secondary" />
              Trusted by 100+ businesses
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-secondary" />
              70% Cost Reduction
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-secondary" />
              GDPR Compliant
            </div>
          </div>
        </div>

        {/* Chat Widgets */}
        <div className="relative">
          <ChatWidget isDisabled />
          <ChatWidget 
            className="absolute top-20 left-24" 
            showTypewriter={true}
            typewriterTexts={["Ask about features...", "Get pricing info...", "Book a demo..."]}
          />
        </div>
      </div>
    </section>
  );
};

type TrustItem = {
  id: string;
  name: string;
  icon: any;
  logo?: string;
};

interface TrustBarProps {
  items?: TrustItem[];
  pauseOnHover?: boolean;
  showGradientOverlay?: boolean;
  showArrows?: boolean;
  autoPlay?: boolean;
  speed?: 'slow' | 'normal' | 'fast';
  direction?: 'forward' | 'backward';
}

// ==================== Trust Bar Component ====================
const TrustBar = ({ 
  items: propItems,
  pauseOnHover = true,
  showGradientOverlay = true,
  showArrows = false,
  autoPlay = true,
  speed = 'normal',
  direction = 'forward'
}: TrustBarProps) => {
  // Map speed to actual values for AutoScroll
  const getSpeedValue = () => {
    switch(speed) {
      case 'slow': return 0.5;
      case 'fast': return 2;
      default: return 1;
    }
  };

  // Default companies if no items provided
  const defaultItems: TrustItem[] = [
    { id: "1", name: "UKBiz", logo: '/carousel/ukbiz.png', icon: Briefcase },
    { id: "2", name: "Prabisha", logo: '/carousel/prabisha.png', icon: Briefcase },
    { id: "3", name: "EcoKartUk", logo: '/carousel/ecokartuk.webp', icon: Briefcase },
    { id: "4", name: "AINexus", logo: '/carousel/ainexus.avif', icon: Briefcase },
  ];

  const items = propItems || defaultItems;
  const finalSpeed = getSpeedValue();

  return (
    <section className="py-9 border-y border-slate-100 bg-white overflow-hidden group">
      <div className="text-center mb-5">
        <div className="text-[11px] tracking-[0.1em] uppercase text-slate-400 font-semibold">
          Trusted by growing businesses worldwide
        </div>
      </div>
      
      <InfiniteCarousel 
        items={items}
        speed={finalSpeed}
        pauseOnHover={pauseOnHover}
        showGradientOverlay={showGradientOverlay}
        showArrows={showArrows}
        autoPlay={autoPlay}
        direction={direction}
      />
    </section>
  );
};

// ==================== Pain Value Section Component ====================
const PainValueSection = () => {
  const painPoints = [
    "Visitors leave without engaging",
    "Slow response times kill conversions",
    "Support teams are overwhelmed",
    "Leads go unqualified",
  ];

  const valuePoints = [
    "Instantly responds to every visitor",
    "Qualifies leads automatically",
    "Books meetings & captures data",
    "Works round the clock without breaks",
  ];

  return (
    <section className="py-20 px-10 bg-slate-50/30">
      <div className="max-w-[1100px] mx-auto">
        <div className="relative grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          
          {/* Pain Side - Problem */}
          <div className="p-12 md:p-16 border-b md:border-b-0 md:border-r border-slate-100">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">
                  The Old Way
                </h3>
                <p className="text-[14px] text-slate-500 font-medium">
                  Most businesses lose leads before they even respond.
                </p>
              </div>
            </div>
            
            <ul className="space-y-4">
              {painPoints.map((item) => (
                <li key={item} className="flex items-center gap-3.5 text-[14.5px] text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <CircleChevronRight   className="w-16 h-16 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

          {/* Value Side - The AI Solution */}
          <div className="p-12 md:p-16 bg-gradient-to-br from-primary/[0.03] via-primary/[0.06] to-transparent relative group">
            {/* Subtle Brand Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
            
            <div className="flex items-start gap-4 mb-8 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-sm border border-primary/10">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-black text-primary leading-tight mb-2">
                  The Prabisha AI Way
                </h3>
                <p className="text-[14px] text-slate-600 font-medium">
                  Your 24/7 AI Sales & Support Assistant.
                </p>
              </div>
            </div>
            
            <ul className="space-y-4 relative z-10">
              {valuePoints.map((item) => (
                <li key={item} className="flex items-center gap-3.5 text-[14.5px] text-slate-700 font-semibold">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
};

// ==================== Demo Section Component ====================
const DemoSection = () => {
  const [activeTab, setActiveTab] = useState("support");
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial messages
  const [messages, setMessages] = useState([
    { id: 1, role: 'bot', text: "Hi there! How can I help you today?" },
    { id: 2, role: 'user', text: "I need help with pricing and plans." },
    { id: 3, role: 'bot', text: "Of course! I can help with that. Would you like to see our pricing plans or speak with our team for a custom quote?" },
  ]);

  const [isTyping, setIsTyping] = useState(false);

  const tabs = [
    { id: "support", label: "Customer Support", icon: Users },
    { id: "sales", label: "Sales Assistant", icon: Briefcase },
    { id: "booking", label: "Appointment Booking", icon: Calendar },
  ];

  const stats = [
    { icon: Users, label: "Conversations Today", value: "128", change: "+24%" },
    { icon: UserPlus, label: "Leads Captured", value: "32", change: "+18%" },
    { icon: TrendingUp, label: "Conversion Rate", value: "1.30%", change: "+12%" },
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = { id: Date.now(), role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const botMsg = { 
        id: Date.now() + 1, 
        role: 'bot', 
        text: "I've noted that down! Our team will get back to you shortly, or I can provide more details here." 
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1500);
  };

  return (
    <section className="py-20 px-10 bg-white">
      <div className="text-center mb-12">
        <h2 className="text-[38px] font-black tracking-tighter text-slate-900 mb-3">
          See How Your AI Chatbot Works in Real-Time
        </h2>
        <p className="text-[15px] text-slate-500">
          Simulate real conversations across sales, support, and customer engagement.
        </p>
      </div>

      <div className="flex justify-center mb-9">
        <div className="bg-slate-100 rounded-full p-1 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-[13.5px] font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "bg-transparent text-slate-600 hover:bg-slate-200"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto grid md:grid-cols-[2fr_1fr] gap-6 items-stretch">
        {/* Chat Interface */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 p-5 border-b border-slate-100 bg-white z-10">
            <Image src="/logo1.png" alt="AI Avatar" width={32} height={32} className="w-8 h-8 rounded-full" />
            <div>
              <div className="text-[13px] font-bold text-slate-800">Prabisha AI Assistant</div>
              <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Online
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-2.5`}>
                {msg.role === 'bot' && (
                  <Image src="/logo1.png" alt="AI Avatar" width={26} height={26} className="w-6.5 h-6.5 rounded-full flex-shrink-0" />
                )}
                <div className={`max-w-[75%] p-3 text-[13px] shadow-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-[18px_18px_4px_18px]" 
                    : "bg-slate-50 text-slate-700 rounded-[18px_18px_18px_4px] border border-slate-100"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-start gap-2.5">
                <Image src="/logo1.png" alt="AI Avatar" width={26} height={26} className="w-6.5 h-6.5 rounded-full flex-shrink-0" />
                <div className="flex gap-1 p-3 bg-slate-50 rounded-[18px_18px_18px_4px] border border-slate-100 items-center">
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.15s]" />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded-full p-1.5 pl-4 border border-slate-200 focus-within:border-primary/40 transition-colors">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 bg-transparent border-none text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <button 
                type="submit"
                disabled={!inputValue.trim()}
                className="w-8 h-8 flex-shrink-0 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:opacity-90 disabled:bg-slate-300 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Analytics Column */}
        <div className="flex flex-col gap-4">
          <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 ml-1">Live Analytics</div>
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 flex-1">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[12px] text-slate-500 mb-0.5">{stat.label}</div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[26px] font-black text-slate-800">{stat.value}</span>
                  <span className="text-[12px] font-bold text-emerald-600">↑ {stat.change}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== Features Section Component ====================
const FeaturesSection = () => {
  const features = [
    { icon: Brain, title: "AI-Powered Conversations", desc: "Human-like responses trained on your business data for 24/7 accuracy." },
    { icon: Languages, title: "Multilingual AI Chatbot", desc: "Engage customers in 100+ languages instantly without any translation lag." },
    { icon: UserPlus, title: "Lead Generation Automation", desc: "Capture, qualify and route leads to your CRM automatically while you sleep." },
    { icon: Link2, title: "Website & WhatsApp Integration", desc: "Help businesses automate, engage, and grow effortlessly across all platforms." },
    { icon: BarChart, title: "Advanced Analytics Dashboard", desc: "Track your conversations, conversions, and ROI in real-time with deep insights." },
    { icon: ZapIcon, title: "Connect AI Workflows", desc: "Go live in minutes and stay for sales, support, and onboarding with ease." },
  ];

  return (
    <section className="p-10 bg-slate-50/50">
      {/* Improved Header Design */}
      <div className="text-center mb-16 max-w-[700px] mx-auto">
        <h2 className="text-[42px] font-black tracking-tighter text-slate-900 leading-tight mb-4">
          Powerful AI Chatbot Features <br />
          <span className="text-primary">Built for Real Results</span>
        </h2>
        <p className="text-slate-500 text-[16px]">
          Everything you need to automate your customer journey and scale your operations without increasing headcount.
        </p>
      </div>

      <div className="max-w-[1200px] mx-auto grid md:grid-cols-3 gap-6">
        {features.map((feature) => (
          <Card 
            key={feature.title} 
            className="group relative border-slate-200 rounded-2xl p-8 shadow-sm bg-white hover:shadow-xl hover:-translate-y-1 hover:border-primary/20 transition-all duration-300 cursor-default overflow-hidden"
          >
            {/* Subtle background glow on hover */}
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            
            {/* Icon Container with double layer */}
            <div className="relative w-14 h-14 mb-6">
              <div className="absolute inset-0 bg-primary/10 rounded-2xl rotate-6 group-hover:rotate-12 transition-transform duration-300" />
              <div className="relative inset-0 w-14 h-14 bg-white border border-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
                <feature.icon className="w-6 h-6" />
              </div>
            </div>

            <div className="text-[17px] font-black text-slate-800 mb-3 group-hover:text-primary transition-colors">
              {feature.title}
            </div>
            
            <div className="text-[14px] text-slate-500 leading-relaxed">
              {feature.desc}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};

// ==================== CTA Section Component ====================
const CTASection = () => {
  return (
    <section className="py-20 px-10 bg-white">
      <div className="max-w-[900px] mx-auto">
        {/* Updated Gradient to use Primary/Secondary */}
        <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-[72px_56px] text-center relative overflow-hidden">
          {/* Abstract Decorations */}
          <div className="absolute top-[-60px] right-[-60px] w-[280px] h-[280px] bg-white/10 rounded-full" />
          <div className="absolute bottom-[-60px] left-[-60px] w-[220px] h-[220px] bg-white/5 rounded-full" />
          
          <div className="relative z-10">
            <Badge variant="secondary" className="inline-flex bg-white/20 text-white border border-white/30 rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide mb-5">
              Get Started Today
            </Badge>
            
            <h2 className="text-[40px] font-black text-white leading-tight tracking-tighter mb-4">
              Ready to Turn Conversations<br />into Revenue?
            </h2>
            
            <p className="text-base text-white/70 mb-9 leading-relaxed">
              Join 100+ businesses already using Prabisha AI to automate<br />support and capture leads 24/7.
            </p>
            
            <div className="flex items-center justify-center gap-3.5">
              {/* Primary Action: White button with Primary text */}
              <Button onClick={() => handleLogin()} className="rounded-full bg-white text-primary text-[15px] font-extrabold h-auto py-3.5 px-8 flex items-center gap-2 hover:bg-slate-50 transition-colors">
                Get Your AI Chatbot
                <ArrowRight className="w-4 h-4" />
              </Button>
              
              {/* Secondary Action: Outlined white button */}
              <Button variant="outline" className="rounded-full border-white/40 text-white bg-transparent text-[15px] font-extrabold h-auto py-3.5 px-8 hover:bg-white/10 transition-colors">
                See Live Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== Main Landing Page Component ====================
const LandingPage = () => {
  return (
    <div className="font-outfit text-slate-900 bg-white">
      <Header />
      <HeroSection />
      <TrustBar />
      <PainValueSection />
      <DemoSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default LandingPage;