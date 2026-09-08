"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, RotateCcw, Plus, PhoneCall, Mic, Phone, Link2, Trash, PhoneForwarded } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns"
import { useWorkspace } from "@/providers/workspace-provider"
import Link from "next/link"

// Form validation schema
const formSchema = z.object({
  agentName: z.string().min(1, "Agent name is required").max(50, "Name must be less than 50 characters").trim(),
  phoneNumber: z.string().min(1, "Phone number is required").trim(),
  chatbotId: z.string().min(1, "Please select a linked chatbot to provide knowledge"),
})

type FormValues = z.infer<typeof formSchema>

interface VoiceAgent {
  id: string
  agentName: string
  phoneNumber: string
  method: string
  voiceId: string
  chatbotId: string
  createdAt: string
  updatedAt: string
  chatbot: {
    name: string
  }
  _count?: {
    callLogs: number
  }
}

export default function VoiceAgentsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [voiceAgents, setVoiceAgents] = useState<VoiceAgent[]>([])
  const [availableChatbots, setAvailableChatbots] = useState<{id: string, name: string}[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<VoiceAgent | null>(null)

  const { activeWorkspace } = useWorkspace();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { agentName: "", phoneNumber: "", chatbotId: "" },
    mode: "onChange",
  })

  const { handleSubmit, formState: { isSubmitting, isValid }, reset } = form

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchData()
    }
  }, [activeWorkspace?.id])

  const fetchData = async () => {
    if (!activeWorkspace?.id) return;
    try {
      setIsLoading(true)
      setError(null)
      
      // Fetch Voice Agents and Chatbots in parallel
      const [agentsRes, chatbotsRes] = await Promise.all([
        fetch(`/api/voice-agents?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/chatbots?workspaceId=${activeWorkspace.id}`)
      ]);

      if (!agentsRes.ok || !chatbotsRes.ok) throw new Error('Failed to fetch data');

      const agentsData = await agentsRes.json();
      const chatbotsData = await chatbotsRes.json();
      
      setVoiceAgents(agentsData);
      setAvailableChatbots(chatbotsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error("Failed to load voice agents")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (agent: VoiceAgent) => {
    setAgentToDelete(agent)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!agentToDelete) return
    try {
      const response = await fetch(`/api/chatbots/${agentToDelete.chatbotId}/voice`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete agent')

      setVoiceAgents(voiceAgents.filter(a => a.id !== agentToDelete.id))
      toast.success(`${agentToDelete.agentName} has been deleted.`);
    } catch (err) {
      toast.error("Failed to delete voice agent");
    } finally {
      setDeleteDialogOpen(false)
      setAgentToDelete(null)
    }
  }

  const onSubmit = async (data: FormValues) => {
    try {
      const response = await fetch('/api/voice-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: data.agentName,
          phoneNumber: data.phoneNumber,
          chatbotId: data.chatbotId,
          workspaceId: activeWorkspace?.id,
        }),
      })

      const responseData = await response.json()
      if (!response.ok) throw new Error(responseData.error || 'Failed to create agent')

      setIsCreateDialogOpen(false)
      reset()
      fetchData()
      toast.success("Voice Agent created successfully!");

      // Redirect to the chatbot's voice settings page to configure the SIP trunk
      router.push(`/voice-agents/${data.chatbotId}/settings`) // Adjust this route to wherever your VoiceSettingsTab lives
    } catch (error: any) {
      toast.error(error.message || "Failed to create voice agent")
    }
  }

  const filteredAgents = voiceAgents.filter((agent) =>
    agent.agentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    agent.phoneNumber.includes(searchQuery)
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-lg border mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableHead key={i}><Skeleton className="h-6 w-24" /></TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the voice agent{" "}
              <span className="font-semibold">{agentToDelete?.agentName}</span> and disconnect its phone number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAgentToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Agents</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your AI phone assistants and SIP trunks.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Deploy New Voice Agent</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
                <FormField
                  control={form.control}
                  name="agentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sarah (Sales)" disabled={isSubmitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="+919876543210" disabled={isSubmitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="chatbotId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Knowledge Base <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a chatbot" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableChatbots.map((bot) => (
                            <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">The voice agent will use this chatbot's data to answer questions.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting || !isValid}>
                    {isSubmitting ? 'Deploying...' : 'Deploy Agent'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="ghost" size="icon" title="Refresh" onClick={fetchData}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">S.NO.</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Linked Chatbot</TableHead>
              <TableHead className="text-center">Call Logs</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Mic className="h-8 w-8 mb-1 opacity-50" />
                    <p>No voice agents found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAgents.map((agent, index) => (
                <TableRow key={agent.id}>
                  <TableCell className="text-center font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <Mic className="h-4 w-4 text-indigo-500" />
                      </div>
                      <Link href={`/voice-agents/${agent.id}`} className="flex flex-col">
                        <span className="font-medium text-sm">{agent.agentName}</span>
                        <span className="text-xs text-muted-foreground capitalize">Voice: {agent.voiceId}</span>
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {agent.phoneNumber}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Link2 className="h-4 w-4 text-emerald-500" />
                      {agent.chatbot?.name || "Unknown"}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                      <PhoneCall className="h-3.5 w-3.5" />
                      {agent._count?.callLogs || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(agent)}>
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}