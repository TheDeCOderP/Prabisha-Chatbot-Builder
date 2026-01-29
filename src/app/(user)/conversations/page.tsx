"use client"
import DOMPurify from 'dompurify';
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { 
  MessageSquare, 
  User, 
  Bot, 
  Calendar, 
  Clock, 
  Search,
  ChevronRight,
  MoreVertical,
  Loader2,
  Building,
  Mail,
  Phone,
  Globe,
  Download,
  Filter
} from 'lucide-react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Message } from '@/types/chat';

interface Conversation {
  id: string;
  title: string | null;
  chatbot: {
    id: string;
    name: string;
    workspace: {
      id: string;
      name: string;
    };
  };
  workspace: {
    id: string;
    name: string;
  };
  lead: {
    id: string;
    createdAt: string;
    data: Record<string, any>;
  } | null;
  isActive: boolean;
  messageCount: number;
  firstMessage: string | null;
  firstMessageType: string | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const sanitizedHTML = (html: string) => DOMPurify.sanitize(html);

export default function ConversationsPage() {
  const params = useParams()
  const chatbotId = params.id as string

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [showLeadDetails, setShowLeadDetails] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations()
  }, [page, selectedWorkspace, selectedStatus])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    } else {
      setMessages([])
    }
  }, [selectedId])

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchQuery && { search: searchQuery }),
        ...(selectedWorkspace !== 'all' && { workspaceId: selectedWorkspace }),
        ...(selectedStatus !== 'all' && { status: selectedStatus }),
        ...(chatbotId && { chatbotId }),
      });

      const res = await fetch(`/api/conversations?${params.toString()}`)
      const data = await res.json()
      
      if (data.conversations) {
        setConversations(data.conversations)
        setPagination(data.pagination)
        
        // Extract unique workspaces
        const uniqueWorkspaces: string[] = Array.from(
          new Set(data.conversations.map((conv: Conversation) => conv.workspace.name))
        );
        setWorkspaces(uniqueWorkspaces);
        
        if (data.conversations.length > 0 && !selectedId) {
          setSelectedId(data.conversations[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (convId: string) => {
    setMessagesLoading(true)
    try {
      // Get the conversation to find the chatbot ID
      const conversation = conversations.find(c => c.id === convId);
      if (!conversation) return;
      
      const res = await fetch(`/api/conversations/${convId}`)
      const data = await res.json()
      setMessages(data)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const filteredConversations = conversations.filter(conv => 
    (conv.title || 'Untitled Conversation').toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.firstMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.chatbot.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedConversation = conversations.find(c => c.id === selectedId)

  const handleExportConversation = async () => {
    if (!selectedConversation) return;
    
    try {
      const messagesRes = await fetch(`/api/chatbots/${selectedConversation.chatbot.id}/conversations/${selectedConversation.id}`);
      const messagesData = await messagesRes.json();
      
      const csvData = [
        ['Timestamp', 'Sender', 'Message'],
        ...messagesData.map((msg: Message) => [
          msg.createdAt ? format(new Date(msg.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
          msg.senderType === 'USER' ? 'User' : 'Assistant',
          msg.content.replace(/"/g, '""')
        ])
      ].map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(',')).join('\n');
      
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation_${selectedConversation.id}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  const LeadDetailsModal = () => {
    if (!selectedConversation?.lead) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold">Lead Information</h3>
                <p className="text-muted-foreground text-sm">
                  Collected from conversation
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowLeadDetails(false)}>
                ✕
              </Button>
            </div>

            <Card className="mb-6">
              <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(selectedConversation.lead.data).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                      <div className="p-3 bg-muted rounded-md text-sm">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-background">
      {/* Left Column: Conversation List */}
      <div className="w-96 border-r flex flex-col overflow-auto bg-muted/5 no-scrollbar">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Conversations
            </h2>
            {pagination && (
              <Badge variant="secondary">{pagination.total}</Badge>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-8 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchConversations();
                  }
                }}
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="All Workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {workspaces.map(workspace => (
                    <SelectItem key={workspace} value={workspace}>{workspace}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="p-2 space-y-2">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group flex flex-col gap-1 border ${
                    selectedId === conv.id 
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                    : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold truncate text-sm flex-1">
                      {conv.title || conv.firstMessage?.substring(0, 30) || `Conversation #${conv.id.slice(-4)}`}
                    </span>
                    <span className={`text-xs shrink-0 ${selectedId === conv.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {format(new Date(conv.updatedAt), 'MMM d')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`truncate ${selectedId === conv.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      {conv.chatbot.name}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-current opacity-30"></span>
                    <span className={`${selectedId === conv.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      {conv.messageCount} messages
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] h-5 ${
                        conv.isActive 
                        ? 'bg-green-500/10 text-green-600 border-green-200' 
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {conv.isActive ? 'Active' : 'Closed'}
                      </Badge>
                      {conv.lead && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-600 border-blue-200">
                          Lead
                        </Badge>
                      )}
                    </div>
                    <div className={`text-xs ${selectedId === conv.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {conv.workspace.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4 text-center">
              <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">No conversations found</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                setSearchQuery('');
                setSelectedWorkspace('all');
                setSelectedStatus('all');
              }}>
                Clear filters
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Message View */}
      <div className="flex-1 flex flex-col h-full relative bg-background">
        {selectedId ? (
          <>
            {/* Header */}
            <div className="h-16 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 border shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedConversation?.chatbot.name.charAt(0) || 'C'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm leading-tight truncate">
                      {selectedConversation?.title || 
                       selectedConversation?.firstMessage?.substring(0, 40) || 
                       'Conversation Details'}
                    </h3>
                    <Badge variant={selectedConversation?.isActive ? "default" : "secondary"} className="h-5 text-xs">
                      {selectedConversation?.isActive ? 'Active' : 'Closed'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <Building className="w-3 h-3" />
                      {selectedConversation?.workspace.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {selectedConversation?.chatbot.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {selectedConversation && format(new Date(selectedConversation.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedConversation?.lead && (
                  <Button variant="outline" size="sm" onClick={() => setShowLeadDetails(true)}>
                    View Lead
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExportConversation}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>
                      Mark as {selectedConversation?.isActive ? 'Closed' : 'Active'}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      Add Summary
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      Delete Conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto flex flex-col">
              <ScrollArea className="flex-1 px-6" scrollHideDelay={0}>
                <div className="py-8 space-y-6 max-w-4xl mx-auto" ref={scrollRef}>
                  {messagesLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Loading messages...</p>
                    </div>
                  ) : messages.length > 0 ? (
                    <>
                      <div className="text-center mb-8">
                        <Badge variant="outline" className="text-xs">
                          Started {selectedConversation && format(new Date(selectedConversation.createdAt), 'PPpp')}
                        </Badge>
                      </div>
                      {messages.map((msg, index) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex gap-4 ${msg.senderType === 'USER' ? 'flex-row-reverse' : ''}`}
                        >
                          <Avatar className={`h-8 w-8 mt-1 border shrink-0 ${msg.senderType === 'USER' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {msg.senderType === 'USER' ? (
                              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                            ) : (
                              <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                            )}
                          </Avatar>
                          <div className={`flex flex-col gap-1 max-w-[75%] ${msg.senderType === 'USER' ? 'items-end' : ''}`}>
                            <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                              msg.senderType === 'USER' 
                              ? 'bg-primary text-primary-foreground rounded-tr-none' 
                              : 'bg-muted/50 border rounded-tl-none'
                            }`}>
                              <div 
                                className={`
                                  prose prose-sm max-w-none
                                  ${msg.senderType === 'USER' ? 'text-primary-foreground' : 'text-foreground'}
                                `}
                                dangerouslySetInnerHTML={{ 
                                  __html: sanitizedHTML(msg.content).replace(/<a /g, `<a target="_blank" rel="noopener noreferrer" `)
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground px-1">
                              {msg.createdAt ? format(new Date(msg.createdAt), 'yyyy-MM-dd HH:mm:ss') : ''}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                      <p>No messages in this conversation</p>
                      <p className="text-sm mt-1">This conversation might be empty or failed to load</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Select a conversation</h3>
            <p className="text-sm text-center max-w-xs mt-1">
              Choose a conversation from the left to view the messages and details.
            </p>
          </div>
        )}
      </div>

      {showLeadDetails && selectedConversation?.lead && <LeadDetailsModal />}
    </div>
  )
}