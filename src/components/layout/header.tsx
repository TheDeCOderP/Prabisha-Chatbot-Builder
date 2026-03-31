"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { 
  Menu, X, ChevronRight, 
  Monitor, TrendingUp, Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ThemeToggle from "../features/theme-toggle";

/* ---------------- DATA ---------------- */
const servicesData = [
  {
    title: "IT Services",
    description: "Software and infrastructure solutions.",
    icon: Monitor,
    items: [
      { title: "AI Chatbot Systems", href: "https://prabisha.com/services/ai-chatbot-solutions" },
      { title: "Custom Website Development", href: "https://prabisha.com/services/custom-website-development" },
      { title: "Ecommerce Development", href: "https://prabisha.com/services/ecommerce-development" },
      { title: "Mobile App Development", href: "https://prabisha.com/services/mobile-app-development" },
      { title: "Cloud Solutions", href: "https://prabisha.com/services/cloud-solutions" },
      { title: "UI/UX Design", href: "https://prabisha.com/services/ui-ux-design" },
    ],
  },
  {
    title: "Digital Marketing",
    description: "Data-driven growth strategies.",
    icon: TrendingUp,
    items: [
      { title: "SEO Services", href: "https://prabisha.com/services/search-engine-optimisation-services" },
      { title: "Social Media Marketing", href: "https://prabisha.com/services/social-media-marketing" },
      { title: "PPC Advertising", href: "https://prabisha.com/services/ppc-advertising" },
      { title: "Content Marketing", href: "https://prabisha.com/services/content-marketing" },
      { title: "Email Marketing", href: "https://prabisha.com/services/email-marketing" },
      { title: "Graphic Design", href: "https://prabisha.com/services/graphic-design" },
    ],
  },
  {
    title: "Human Resources",
    description: "Staffing and talent management.",
    icon: Users,
    items: [
      { title: "Recruitment & Staffing", href: "https://prabisha.com/services/recruitment-staffing" },
      { title: "Offshore Staffing", href: "https://prabisha.com/services/offshore-staffing-solutions" },
      { title: "Career Coaching", href: "https://prabisha.com/services/career-coaching" },
      { title: "ATS Resume Writing", href: "https://prabisha.com/services/ats-resume-writing" },
      { title: "LinkedIn Optimisation", href: "https://prabisha.com/services/linkedin-optimisation" },
      { title: "Training & Upskilling", href: "https://prabisha.com/services/training-upskilling" },
    ],
  },
];

/* ---------------- DESKTOP MEGA MENU ---------------- */
const DesktopMegaMenu = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex w-[800px] min-h-[400px] bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-[240px] shrink-0 p-6 pt-8 border-r border-border/50 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-6 px-2">
          Service Categories
        </p>
        <div className="space-y-1">
          {servicesData.map((cat, idx) => (
            <div
              key={cat.title}
              onMouseEnter={() => setActiveTab(idx)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300",
                activeTab === idx
                  ? "bg-primary/5 text-primary"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <cat.icon
                className={cn(
                  "w-4 h-4 mt-0.5 shrink-0",
                  activeTab === idx ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold leading-none mb-1.5">{cat.title}</h4>
                <p className="text-[11px] opacity-70 line-clamp-1 font-medium">{cat.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area — flex-1 + min-w-0 + overflow-hidden prevents blowout */}
      <div className="flex-1 min-w-0 p-8 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 flex flex-col min-w-0"
          >
            {/* Heading */}
            <div className="mb-6">
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
                {servicesData[activeTab].title}
              </h3>
              <div className="h-1 w-10 bg-primary rounded-full mt-2" />
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 gap-y-1 gap-x-6">
              {servicesData[activeTab].items.map((item) => (
                <NavigationMenuLink key={item.title} asChild>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-2 py-2.5 px-1 rounded-lg transition-all min-w-0 overflow-hidden"
                  >
                    <ChevronRight className="w-3 h-3 shrink-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[13px] font-semibold text-muted-foreground group-hover:text-primary transition-colors truncate">
                      {item.title}
                    </span>
                  </Link>
                </NavigationMenuLink>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-6 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground italic">
                Delivering excellence across industries.
              </span>
              <Link
                href="/services"
                className="text-xs font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all shrink-0"
              >
                View All Services <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ---------------- MAIN HEADER ---------------- */
export default function Header() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-xl z-50 border-b border-border transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <Image src="/icons/logo1.png" alt="logo" width={32} height={32} className="sm:w-10 sm:h-10" />
          <span className="text-lg sm:text-xl font-bold tracking-tight">Prabisha</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center">
          <NavigationMenu>
            <NavigationMenuList className="gap-1 xl:gap-2">
              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-sm font-semibold bg-transparent data-[state=open]:bg-transparent px-3 xl:px-4">
                  Services
                </NavigationMenuTrigger>
                {/* !w-auto lets the content use its own fixed width instead of being constrained */}
                <NavigationMenuContent className="!w-auto rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                  <DesktopMegaMenu />
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-sm font-semibold bg-transparent px-3 xl:px-4">
                  Company
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[200px] p-4 gap-1">
                    {["About Us", "Careers", "Contact"].map((item) => (
                      <li key={item}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={`/${item.toLowerCase().replace(" ", "-")}`}
                            className="block p-3 text-sm font-medium hover:text-primary hover:bg-muted rounded-xl transition-all"
                          >
                            {item}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <Button variant="ghost" className="hidden md:block font-bold text-sm sm:text-base">
            Sign In
          </Button>
          <Button className="rounded-full bg-primary font-bold px-4 sm:px-6 shadow-lg shadow-primary/20 text-sm sm:text-base">
            Get Started
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden absolute top-16 sm:top-20 left-0 w-full bg-background border-b border-border shadow-xl p-6 max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <div className="space-y-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Navigation</p>
              <div className="flex flex-col gap-4 pl-2">
                <Link href="/services" className="text-lg font-bold" onClick={() => setIsMobileOpen(false)}>Services</Link>
                <Link href="/about-us" className="text-lg font-bold" onClick={() => setIsMobileOpen(false)}>About Us</Link>
                <Link href="/careers" className="text-lg font-bold" onClick={() => setIsMobileOpen(false)}>Careers</Link>
                <Link href="/contact" className="text-lg font-bold" onClick={() => setIsMobileOpen(false)}>Contact</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}