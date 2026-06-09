"use client";
import DOMPurify from "dompurify";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  MessageSquare,
  User,
  Bot,
  Calendar,
  Search,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Loader2,
  Building,
  Download,
  Filter,
  X,
  RefreshCw,
  CheckCircle2,
  Circle,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Message } from "@/types/chat";

interface Workspace {
  id: string;
  name: string;
}

interface Chatbot {
  id: string;
  name: string;
  workspace: Workspace;
}

interface Conversation {
  id: string;
  title: string | null;
  chatbot: Chatbot;
  workspace: Workspace;
  lead: {
    id: string;
    createdAt: string;
    data: Record<string, unknown>;
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

const sanitizedHTML = (html: string) =>
  typeof window !== "undefined" ? DOMPurify.sanitize(html) : html;

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ConversationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive filter state from URL params
  const urlPage = parseInt(searchParams.get("page") || "1");
  const urlSearch = searchParams.get("search") || "";
  const urlWorkspace = searchParams.get("workspaceId") || "all";
  const urlChatbot = searchParams.get("chatbotId") || "all";
  const urlStatus = searchParams.get("status") || "all";
  const urlHasLead = searchParams.get("hasLead") || "all";
  const urlSelected = searchParams.get("id") || null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(urlSelected);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 400);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Push URL param updates
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, val]) => {
        if (val === null || val === "" || val === "all") {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Sync debounced search to URL (reset page on new search)
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      updateParams({ search: debouncedSearch || null, page: null });
    }
  }, [debouncedSearch]);

  // Fetch conversations whenever URL filter params change
  useEffect(() => {
    fetchConversations();
  }, [urlPage, urlSearch, urlWorkspace, urlChatbot, urlStatus, urlHasLead]);

  // Fetch messages when selected conversation changes
  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: urlPage.toString(),
        limit: "20",
      });
      if (urlSearch) params.set("search", urlSearch);
      if (urlWorkspace !== "all") params.set("workspaceId", urlWorkspace);
      if (urlChatbot !== "all") params.set("chatbotId", urlChatbot);
      if (urlStatus !== "all") params.set("status", urlStatus);
      if (urlHasLead !== "all") params.set("hasLead", urlHasLead);

      const res = await fetch(`/api/conversations?${params.toString()}`);
      const data = await res.json();

      if (data.conversations) {
        setConversations(data.conversations);
        setPagination(data.pagination);

        // Build unique workspace list from results
        const wsMap = new Map<string, Workspace>();
        const cbMap = new Map<string, Chatbot>();
        data.conversations.forEach((conv: Conversation) => {
          wsMap.set(conv.workspace.id, conv.workspace);
          cbMap.set(conv.chatbot.id, conv.chatbot);
        });
        setWorkspaces(Array.from(wsMap.values()));
        setChatbots(Array.from(cbMap.values()));

        // Auto-select first if nothing is selected
        if (!selectedId && data.conversations.length > 0) {
          const first = data.conversations[0].id;
          setSelectedId(first);
          updateParams({ id: first });
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    updateParams({ id });
  };

  const handleStatusToggle = async () => {
    if (!selectedConversation) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(
        `/api/conversations?conversationId=${selectedConversation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !selectedConversation.isActive }),
        }
      );
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, isActive: !c.isActive }
              : c
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      const res = await fetch(
        `/api/conversations?conversationId=${selectedConversation.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const remaining = conversations.filter(
          (c) => c.id !== selectedConversation.id
        );
        setConversations(remaining);
        const next = remaining[0]?.id || null;
        setSelectedId(next);
        updateParams({ id: next });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportConversation = async () => {
    if (!selectedConversation || messages.length === 0) return;

    const csvData = [
      ["Timestamp", "Sender", "Message"],
      ...messages.map((msg: Message) => [
        msg.createdAt ? format(new Date(msg.createdAt), "yyyy-MM-dd HH:mm:ss") : "",
        msg.senderType === "USER" ? "User" : "Assistant",
        msg.content.replace(/"/g, '""'),
      ]),
    ]
      .map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation_${selectedConversation.id}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchInput("");
    router.push(pathname, { scroll: false });
    setSelectedId(null);
  };

  const hasActiveFilters =
    urlSearch || urlWorkspace !== "all" || urlChatbot !== "all" || urlStatus !== "all" || urlHasLead !== "all";

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* ── Left sidebar: Conversation list ── */}
      <div className="w-[360px] shrink-0 border-r flex flex-col bg-muted/5">
        {/* Header + filters */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Conversations
            </h2>
            <div className="flex items-center gap-1">
              {pagination && (
                <Badge variant="secondary" className="text-xs">
                  {pagination.total}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchConversations}
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-8 pr-8 h-9 bg-background text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-2.5"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex gap-2">
            <Select
              value={urlWorkspace}
              onValueChange={(v) => updateParams({ workspaceId: v, page: null })}
            >
              <SelectTrigger className="flex-1 h-8 text-xs">
                <Building className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workspaces</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={urlStatus}
              onValueChange={(v) => updateParams({ status: v, page: null })}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Secondary filter row */}
          <div className="flex gap-2">
            <Select
              value={urlChatbot}
              onValueChange={(v) => updateParams({ chatbotId: v, page: null })}
            >
              <SelectTrigger className="flex-1 h-8 text-xs">
                <MessageSquare className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="All Chatbots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chatbots</SelectItem>
                {chatbots.map((cb) => (
                  <SelectItem key={cb.id} value={cb.id}>
                    {cb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={urlHasLead}
              onValueChange={(v) => updateParams({ hasLead: v, page: null })}
            >
              <SelectTrigger className="flex-1 h-8 text-xs">
                <Tag className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Leads" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conversations</SelectItem>
                <SelectItem value="true">With Lead</SelectItem>
                <SelectItem value="false">No Lead</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-2 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : conversations.length > 0 ? (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-150 flex flex-col gap-1.5 border ${
                    selectedId === conv.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-transparent hover:bg-muted/60 hover:border-border"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium truncate text-sm leading-tight flex-1">
                      {conv.title ||
                        conv.firstMessage?.substring(0, 35) ||
                        `Conversation #${conv.id.slice(-6)}`}
                    </span>
                    <span
                      className={`text-[11px] shrink-0 ${
                        selectedId === conv.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {format(new Date(conv.updatedAt), "MMM d")}
                    </span>
                  </div>

                  <div
                    className={`text-xs truncate ${
                      selectedId === conv.id
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {conv.chatbot.name} · {conv.workspace.name}
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4 px-1.5 border-0 ${
                        selectedId === conv.id
                          ? conv.isActive
                            ? "bg-green-500/20 text-green-200"
                            : "bg-white/10 text-primary-foreground/60"
                          : conv.isActive
                          ? "bg-green-500/10 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {conv.isActive ? "Active" : "Closed"}
                    </Badge>
                    {conv.lead && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 px-1.5 border-0 ${
                          selectedId === conv.id
                            ? "bg-blue-500/20 text-blue-200"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        Lead
                      </Badge>
                    )}
                    <span
                      className={`ml-auto text-[10px] ${
                        selectedId === conv.id
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground"
                      }`}
                    >
                      {conv.messageCount} msg
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4 text-center">
              <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No conversations found</p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {urlPage} of {pagination.totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  updateParams({ page: String(Math.max(1, urlPage - 1)) })
                }
                disabled={urlPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  updateParams({
                    page: String(Math.min(pagination.totalPages, urlPage + 1)),
                  })
                }
                disabled={urlPage === pagination.totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: Message view ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selectedConversation ? (
          <>
            {/* Conversation header */}
            <div className="h-14 border-b flex items-center justify-between px-5 shrink-0 bg-background/95 backdrop-blur-sm">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-8 w-8 border shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {selectedConversation.chatbot.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {selectedConversation.title ||
                        selectedConversation.firstMessage?.substring(0, 40) ||
                        "Untitled Conversation"}
                    </span>
                    <Badge
                      variant={selectedConversation.isActive ? "default" : "secondary"}
                      className="h-4 text-[10px] px-1.5 shrink-0"
                    >
                      {selectedConversation.isActive ? "Active" : "Closed"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {selectedConversation.workspace.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {selectedConversation.chatbot.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(selectedConversation.createdAt), "MMM d, yyyy")}
                    </span>
                    <span className="text-muted-foreground">
                      {selectedConversation.messageCount} messages
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                {selectedConversation.lead && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowLeadDetails(true)}
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    Lead
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleExportConversation}
                  disabled={messages.length === 0}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleStatusToggle}
                      disabled={statusUpdating}
                      className="text-sm"
                    >
                      {statusUpdating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : selectedConversation.isActive ? (
                        <Circle className="h-4 w-4 mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Mark as {selectedConversation.isActive ? "Closed" : "Active"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDeleteConversation}
                      className="text-destructive text-sm"
                    >
                      Delete Conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6">
              <div className="py-6 space-y-5 max-w-3xl mx-auto" ref={scrollRef}>
                {messagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading messages…</p>
                  </div>
                ) : messages.length > 0 ? (
                  <>
                    <div className="text-center">
                      <Badge variant="outline" className="text-xs">
                        Started{" "}
                        {format(new Date(selectedConversation.createdAt), "PPpp")}
                      </Badge>
                    </div>
                    {messages.map((msg, index) => (
                      <motion.div
                        key={msg.id ?? index}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.04, 0.4) }}
                        className={`flex gap-3 ${
                          msg.senderType === "USER" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar
                          className={`h-7 w-7 mt-1 border shrink-0 ${
                            msg.senderType === "USER"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {msg.senderType === "USER" ? (
                            <AvatarFallback>
                              <User className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          ) : (
                            <AvatarFallback>
                              <Bot className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div
                          className={`flex flex-col gap-1 max-w-[72%] ${
                            msg.senderType === "USER" ? "items-end" : ""
                          }`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                              msg.senderType === "USER"
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-muted/60 border rounded-tl-none"
                            }`}
                          >
                            <div
                              className={`prose prose-sm max-w-none ${
                                msg.senderType === "USER"
                                  ? "text-primary-foreground"
                                  : "text-foreground"
                              }`}
                              dangerouslySetInnerHTML={{
                                __html: sanitizedHTML(msg.content).replace(
                                  /<a /g,
                                  `<a target="_blank" rel="noopener noreferrer" `
                                ),
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground px-1">
                            {msg.createdAt
                              ? format(
                                  new Date(msg.createdAt),
                                  "yyyy-MM-dd HH:mm:ss"
                                )
                              : ""}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                    {selectedConversation.endedAt && (
                      <div className="text-center">
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Ended{" "}
                          {format(new Date(selectedConversation.endedAt), "PPpp")}
                        </Badge>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">No messages in this conversation</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 opacity-20" />
            </div>
            <h3 className="text-base font-medium text-foreground">
              Select a conversation
            </h3>
            <p className="text-sm text-center max-w-xs mt-1">
              Choose a conversation from the list to view messages and details.
            </p>
          </div>
        )}
      </div>

      {/* Lead Details Dialog */}
      <Dialog open={showLeadDetails} onOpenChange={setShowLeadDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lead Information</DialogTitle>
            <DialogDescription>
              Collected from this conversation on{" "}
              {selectedConversation?.lead?.createdAt
                ? format(new Date(selectedConversation.lead.createdAt), "PPpp")
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedConversation?.lead && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {Object.entries(selectedConversation.lead.data).map(
                ([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                    </p>
                    <div className="bg-muted rounded-md px-3 py-2 text-sm break-all">
                      {String(value)}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
