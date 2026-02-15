"use client";
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Zap, Brain, ArrowRight, MessageSquare, Settings, Gauge } from "lucide-react"

import Header from "@/components/layout/header"
import Footer from "@/components/layout/footer"
import { handleLogin } from "@/lib/auth";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Navigation */}
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 border border-secondary/40">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Chatbots</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-balance">
              Build powerful chatbots
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary">
                without writing code
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Create intelligent conversational AI in minutes. Connect to your favorite tools, train on your data, and
              deploy instantly. No technical expertise required.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button onClick={() => handleLogin()} size="lg" className="gap-2">
                Start Building Free
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline">
                Watch Demo
              </Button>
            </div>

            {/* Social Proof */}
            <div className="pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">Trusted by leading companies</p>
              <div className="flex flex-wrap gap-8 items-center justify-center opacity-60">
                {["TechCorp", "CloudServices", "DataFlow", "InnovateLabs", "FutureAI"].map((company) => (
                  <div key={company} className="text-sm font-medium">
                    {company}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Everything you need</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to help you build smarter chatbots faster
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Card className="bg-card/40 border-border/50 p-6 hover:bg-card/60 transition">
              <Brain className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">AI-Powered Intelligence</h3>
              <p className="text-sm text-muted-foreground">
                Leverage the latest AI models to create conversations that feel natural and intelligent
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-card/40 border-border/50 p-6 hover:bg-card/60 transition">
              <Gauge className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">No-Code Builder</h3>
              <p className="text-sm text-muted-foreground">
                Drag-and-drop interface to design conversations and workflows without writing a single line
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-card/40 border-border/50 p-6 hover:bg-card/60 transition">
              <Settings className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">1000+ Integrations</h3>
              <p className="text-sm text-muted-foreground">
                Connect to Slack, Teams, WhatsApp, Salesforce, HubSpot and thousands of other tools
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-card/40 border-border/50 p-6 hover:bg-card/60 transition">
              <Zap className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Instant Deployment</h3>
              <p className="text-sm text-muted-foreground">
                Deploy to production with one click. Go live in minutes, not weeks
              </p>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-card/40 border-border/50 p-6 hover:bg-card/60 transition">
              <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Continuous Learning</h3>
              <p className="text-sm text-muted-foreground">
                Automatically improve through conversations. Your chatbot gets smarter every day
              </p>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-card/40 border-border/50 p-6 hover:bg-card/60 transition">
              <MessageSquare className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">24/7 Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Real-time insights into conversations, performance, and customer satisfaction metrics
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">10K+</div>
              <p className="text-muted-foreground">Active Chatbots</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">500M+</div>
              <p className="text-muted-foreground">Conversations</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <p className="text-muted-foreground">Uptime</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">50ms</div>
              <p className="text-muted-foreground">Response Time</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Traditional vs ChatFlow</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card/40 border-border/50 p-8">
              <h3 className="font-semibold text-lg mb-6">Traditional Development</h3>
              <ul className="space-y-3">
                <li className="flex gap-3 text-muted-foreground text-sm">
                  <span>⏱️</span> <span>Weeks to build</span>
                </li>
                <li className="flex gap-3 text-muted-foreground text-sm">
                  <span>💰</span> <span>Expensive infrastructure</span>
                </li>
                <li className="flex gap-3 text-muted-foreground text-sm">
                  <span>👥</span> <span>Requires specialized team</span>
                </li>
                <li className="flex gap-3 text-muted-foreground text-sm">
                  <span>🔧</span> <span>Complex integrations</span>
                </li>
              </ul>
            </Card>
            <Card className="bg-linear-to-br from-primary/10 to-secondary/10 border-primary/30 p-8">
              <h3 className="font-semibold text-lg mb-6 text-primary">ChatFlow</h3>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span>Minutes to deploy</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span>Pay per conversation</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span>No coding required</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span>1-click integrations</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">Ready to build your chatbot?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of companies creating smarter customer experiences
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2">
              Create Your First Chatbot
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline">
              Schedule a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  )
}
