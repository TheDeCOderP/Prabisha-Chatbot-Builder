"use client"

import Link from "next/link"
import Image from "next/image"
import type React from "react"
import { useState, useRef } from "react"
import { Mail, Phone, Twitter, Linkedin, Instagram, MapPin, Facebook, Copy, Check } from "lucide-react"

export default function Footer() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeHover, setActiveHover] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.preventDefault() // Prevent the link from triggering
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleMouseEnter = (id: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActiveHover(id)
  }

  const handleMouseLeave = () => {
    // Keep visible for 300ms so the user has time to move the cursor to the icon
    timeoutRef.current = setTimeout(() => {
      setActiveHover(null)
    }, 300)
  }

  const socialLinks = [
    { icon: Twitter, href: "https://x.com/PrabishaC", label: "Twitter" },
    { icon: Linkedin, href: "https://www.linkedin.com/company/prabisha", label: "LinkedIn" },
    { icon: Facebook, href: "http://facebook.com/prabishaconsulting/", label: "Facebook" },
    { icon: Instagram, href: "https://www.instagram.com/prabishauk/", label: "Instagram" },
  ]

  // Reusable Contact Item Component for cleaner code
  const ContactItem = ({ id, icon: Icon, label, value, href, copyValue }: any) => (
    <div 
      className="relative flex items-start space-x-3 group w-fit"
      onMouseEnter={() => handleMouseEnter(id)}
      onMouseLeave={handleMouseLeave}
    >
      <Icon className="w-5 h-5 text-primary mt-1 shrink-0" />
      <div className="flex flex-col">
        {label && <p className="text-xs font-semibold text-foreground uppercase opacity-70">{label}</p>}
        <div className="flex items-center space-x-2">
          <a 
            href={href} 
            target={href.startsWith('http') ? "_blank" : undefined}
            className="font-medium text-foreground hover:text-primary transition-colors leading-tight"
          >
            {value}
          </a>
          
          {/* Inline Copy Button - Visible on hover with delay */}
          <button
            onClick={(e) => handleCopy(e, copyValue || value, id)}
            className={`transition-all duration-200 p-1 hover:bg-muted rounded ${
              activeHover === id ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
            }`}
            title="Copy to clipboard"
          >
            {copiedId === id ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <footer className="relative bg-background text-foreground border-t border-border">
      <div className="relative p-10">
        <div className="grid lg:grid-cols-6 md:grid-cols-2 gap-12 mb-16">
          
          {/* Brand & Contact Section */}
          <div className="lg:col-span-2 space-y-6">
            <Image src="/icons/logo.png" alt="logo" height={60} width={200} unoptimized />
            <p className="text-muted-foreground leading-relaxed text-lg max-w-md">
              Empowering businesses with AI-driven marketing automation solutions.
            </p>

            <div className="space-y-5">
              <ContactItem 
                id="email"
                icon={Mail}
                value="info@prabisha.com"
                href="mailto:info@prabisha.com"
              />
              
              <ContactItem 
                id="india-tel"
                icon={Phone}
                label="India Office"
                value="+91-9599824600"
                href="tel:+919599824600"
              />

              <ContactItem 
                id="uk-tel"
                icon={Phone}
                label="UK Office"
                value="+44-7867090363"
                href="tel:+447867090363"
              />

              <ContactItem 
                id="address"
                icon={MapPin}
                label="Address"
                value="Delhi, India | London, UK"
                href="https://www.google.com/maps/search/Prabisha+Consulting"
                copyValue="Delhi, India | London, UK"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-6">
            <h3 className="font-bold text-xl text-foreground relative w-fit">
              Company
              <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-primary rounded-full"></div>
            </h3>
            <ul className="space-y-4">
              {[{ name: "About Us", href: "https://prabisha.com/about/" }, { name: "Careers", href: "https://hr.prabisha.com/" }, { name: "Contact", href: "https://prabisha.com/contact/" }].map((link, i) => (
                <li key={i}>
                  <Link href={link.href} className="text-muted-foreground hover:text-primary transition-all duration-200 hover:translate-x-1 inline-block">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect & Newsletter */}
          <div className="space-y-6 lg:col-span-2">
            <h3 className="text-2xl font-bold text-foreground">Connect</h3>
            <div className="flex space-x-4">
              {socialLinks.map((social, index) => (
                <a key={index} href={social.href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-muted hover:bg-primary rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 group">
                  <social.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                </a>
              ))}
            </div>

            <div className="pt-4">
              <h3 className="text-xl font-bold text-foreground mb-2">Stay in the Loop</h3>
              <form onSubmit={(e) => { e.preventDefault(); setIsSubmitting(true); setTimeout(() => setIsSubmitting(false), 1000); }} className="flex flex-col sm:flex-row gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Your email"
                  required
                  className="flex-1 p-2 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary text-sm"
                />
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50">
                  {isSubmitting ? "..." : "Join"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8 text-center md:text-left text-muted-foreground text-sm">
          © {new Date().getFullYear()} Prabisha Consulting. All rights reserved.
        </div>
      </div>
    </footer>
  )
}