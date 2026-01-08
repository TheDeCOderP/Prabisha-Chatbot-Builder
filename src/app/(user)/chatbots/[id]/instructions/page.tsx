"use client"

import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Info, Smartphone, Loader2 } from "lucide-react"

import Chat from "@/components/features/chat" 

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatbotData {
  id: string;
  name: string;
  greeting: string;
  directive: string;
}

export default function InstructionsPage() {
  const params = useParams()
  const chatbotId = params.id as string
  
  const [chatbotData, setChatbotData] = useState<ChatbotData | null>(null)
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(true)

  const [name, setName] = useState("")
  const [directive, setDirective] = useState("")
  const [greeting, setGreeting] = useState("How can I help you today?")

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "How can I help you today?" }
  ])
  const [isGeneratingGreeting, setIsGeneratingGreeting] = useState(false)

  // Fetch chatbot data on component mount
  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}`)
      .then((res) => res.json())
      .then((data) => {
        setName(data.name)
        setChatbotData(data)
        setGreeting(data.greeting)
        setDirective(data.directive)
        setIsLoadingChatbot(false)
      })
  }, [chatbotId])

  const handleGenerateGreeting = async () => {
    setIsGeneratingGreeting(true)
    try {
      // Call AI greeting generation API
      const response = await fetch("/api/generate-greeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatbotId, directive }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.greeting) {
        setGreeting(data.greeting)
        toast.success("Greeting generated successfully!")
      } else {
        throw new Error("No greeting returned")
      }
    } catch (error) {
      console.error("Error generating greeting:", error)
      toast.error("Failed to generate greeting")
    } finally {
      setIsGeneratingGreeting(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!chatbotData) return
    
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          greeting,
          directive,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      // Update the initial greeting in the chat if it's the first message
      if (messages.length === 1 && messages[0].role === "assistant") {
        setMessages([{ role: "assistant", content: greeting }])
      }
      
      toast.success("Changes saved successfully!")
    } catch (error) {
      console.error("Error saving changes:", error)
      toast.error("Failed to save changes")
    }
  }

  // Custom message handler for the Chat component
  const handleSendMessage = async (userMessage: string, previousMessages: Message[]): Promise<string> => {
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: userMessage,
          prompt: directive,
          messages: previousMessages,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      return data.message || "I'm sorry, I couldn't process that request."
      
    } catch (error) {
      console.error("Error while sending message:", error)
      return "Sorry, I encountered an error. Please try again."
    }
  }

  if (isLoadingChatbot) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!chatbotData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="p-6">
          <p className="text-lg">Chatbot not found</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex w-full max-h-[calc(100vh-7rem)]">
      {/* Left Panel - Instructions */}
      <div className="w-full lg:w-1/2 border-r border-border overflow-y-auto no-scrollbar">
        <div className="p-8 max-h-screen">
          <h1 className="text-2xl font-semibold mb-8">Instructions</h1>

          {/* Greeting Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="greeting" className="text-sm font-medium">
                Greeting
              </Label>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
            <Textarea
              id="greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="min-h-[100px] resize-none"
              placeholder="Enter greeting message..."
            />
          </div>

          {/* Directive Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="directive" className="text-sm font-medium">
                Directive
              </Label>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
            <Textarea
              id="directive"
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              className="min-h-[280px] font-mono text-sm resize-none"
              placeholder="Enter directive instructions..."
            />
          </div>

          {/* Save Button */}
          <Button 
            size="lg" 
            className="w-full mb-6"
            onClick={handleSaveChanges}
          >
            Save changes
          </Button>
        </div>
      </div>

      {/* Right Panel - Chat Preview */}
      <div className="hidden lg:block w-1/2">
        <Chat
          id={chatbotId}
          name={name}
          greeting={greeting}
          directive={directive}
          initialMessages={messages}
          onSendMessage={handleSendMessage}
          showPreviewControls={true}
        />
      </div>

      {/* Mobile Chat Preview Button */}
      <div className="lg:hidden fixed bottom-6 right-6">
        <Button
          size="lg"
          className="rounded-full shadow-lg"
          onClick={() => {
            // Implement mobile preview modal or drawer
            toast.info("Preview available on desktop view")
          }}
        >
          <Smartphone className="w-5 h-5 mr-2" />
          Preview
        </Button>
      </div>
    </div>
  )
}