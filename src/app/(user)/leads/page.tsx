"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Eye,
  MoreVertical,
  User,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  X,
  FileDown,
  Tag,
  Building,
  RefreshCw,
  Filter,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface LeadData {
  [key: string]: string | number | boolean;
}

interface Lead {
  id: string;
  data: LeadData;
  createdAt: string;
  chatbot: {
    id: string;
    name: string;
    workspace: { id: string; name: string };
  };
  form: {
    id: string;
    title: string;
    leadTiming: string;
    leadFormStyle: string;
    fields?: any[];
  };
  conversation?: {
    id: string;
    createdAt: string;
    messages?: Array<{ content: string }>;
  };
  conversationPreview?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ChatbotInfo {
  id: string;
  name: string;
  fields: string[];
}

interface ExportConfig {
  exportType: "all" | "selected";
  selectedChatbotIds: string[];
  includeConversation: boolean;
  includeAllFields: boolean;
  customFields: string[];
  format: "csv" | "json";
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AllLeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive state from URL
  const urlPage = Math.max(parseInt(searchParams.get("page") || "1"), 1);
  const urlSearch = searchParams.get("search") || "";
  const urlChatbot = searchParams.get("chatbotId") || "all";
  const urlWorkspace = searchParams.get("workspaceId") || "all";
  const urlDateFrom = searchParams.get("dateFrom") || "";
  const urlDateTo = searchParams.get("dateTo") || "";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [chatbots, setChatbots] = useState<ChatbotInfo[]>([]);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [showExportConfig, setShowExportConfig] = useState(false);
  const [showFilters, setShowFilters] = useState(
    !!(urlWorkspace !== "all" || urlDateFrom || urlDateTo)
  );

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    exportType: "all",
    selectedChatbotIds: [],
    includeConversation: true,
    includeAllFields: true,
    customFields: [],
    format: "csv",
  });

  const debouncedSearch = useDebounce(searchInput, 400);

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

  // Sync debounced search → URL
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      updateParams({ search: debouncedSearch || null, page: null });
    }
  }, [debouncedSearch]);

  // Fetch on filter change
  useEffect(() => {
    fetchLeads();
  }, [urlPage, urlSearch, urlChatbot, urlWorkspace, urlDateFrom, urlDateTo]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: urlPage.toString(), limit: "15" });
      if (urlSearch) params.set("search", urlSearch);
      if (urlChatbot !== "all") params.set("chatbotId", urlChatbot);
      if (urlWorkspace !== "all") params.set("workspaceId", urlWorkspace);
      if (urlDateFrom) params.set("dateFrom", urlDateFrom);
      if (urlDateTo) params.set("dateTo", urlDateTo);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();

      if (data.leads) {
        setLeads(data.leads);
        setPagination(data.pagination);

        // Build chatbot list from results
        const cbMap = new Map<string, ChatbotInfo>();
        const wsMap = new Map<string, { id: string; name: string }>();

        data.leads.forEach((lead: Lead) => {
          if (!cbMap.has(lead.chatbot.id)) {
            const fields = extractFieldsFromForm(lead.form.fields);
            cbMap.set(lead.chatbot.id, {
              id: lead.chatbot.id,
              name: lead.chatbot.name,
              fields,
            });
          }
          wsMap.set(lead.chatbot.workspace.id, lead.chatbot.workspace);
        });

        setChatbots(Array.from(cbMap.values()));
        setWorkspaces(Array.from(wsMap.values()));
      }
    } catch (error) {
      console.error("Failed to load leads", error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    router.push(pathname, { scroll: false });
  };

  const hasActiveFilters =
    urlSearch ||
    urlChatbot !== "all" ||
    urlWorkspace !== "all" ||
    urlDateFrom ||
    urlDateTo;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const extractContactInfo = (data: LeadData) => {
    const info = { name: "", email: "", phone: "" };

    Object.entries(data).forEach(([key, value]) => {
      const str = String(value);
      if (!info.email && str.includes("@") && str.includes(".")) {
        info.email = str;
      } else if (
        !info.phone &&
        /^[\+]?[1-9][\d]{6,14}$/.test(str.replace(/[\s\-\(\)]/g, ""))
      ) {
        info.phone = str;
      } else if (
        !info.name &&
        (key.toLowerCase().includes("name") || key === "1")
      ) {
        info.name = str;
      }
    });

    if (!info.name) {
      Object.values(data).find((val) => {
        if (typeof val === "string" && /^[A-Za-z\s]{2,}$/.test(val.trim())) {
          info.name = val;
          return true;
        }
      });
    }

    return info;
  };

  const extractFieldsFromForm = (fields: any[] | undefined): string[] => {
    if (!fields || !Array.isArray(fields)) return ["Name", "Email", "Phone"];
    return fields
      .map((f: any) => f.label || f.name || `Field ${f.id}`)
      .filter(Boolean);
  };

  const getFieldValue = (lead: Lead, fieldName: string): string => {
    const data = lead.data;
    if (data[fieldName] !== undefined) return String(data[fieldName]);
    const lower = fieldName.toLowerCase();
    for (const key in data) {
      if (key.toLowerCase() === lower) return String(data[key]);
    }
    for (const key in data) {
      if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
        return String(data[key]);
      }
    }
    const contact = extractContactInfo(data);
    if (lower.includes("name") && contact.name) return contact.name;
    if (lower.includes("email") && contact.email) return contact.email;
    if (lower.includes("phone") && contact.phone) return contact.phone;
    return "—";
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const getAllAvailableFields = (): string[] => {
    const all = new Set<string>();
    chatbots.forEach((cb) => cb.fields.forEach((f) => all.add(f)));
    return Array.from(all);
  };

  const buildCSV = (leadsToExport: Lead[], fieldsToInclude: string[]) => {
    const headers = [
      "ID",
      "Chatbot",
      "Workspace",
      "Form",
      "Date",
      ...fieldsToInclude,
      ...(exportConfig.includeConversation ? ["Conversation Preview"] : []),
    ];
    const rows = leadsToExport.map((lead) => {
      const row = [
        lead.id,
        lead.chatbot.name,
        lead.chatbot.workspace.name,
        lead.form.title,
        format(new Date(lead.createdAt), "yyyy-MM-dd HH:mm"),
        ...fieldsToInclude.map((fn) => getFieldValue(lead, fn)),
        ...(exportConfig.includeConversation
          ? [lead.conversationPreview || ""]
          : []),
      ];
      return row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    return [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");
  };

  const handleQuickExport = () => {
    if (!leads.length) return;
    const allFields = new Set<string>();
    leads.forEach((l) =>
      (l.form.fields || []).forEach((f: any) => {
        if (f.label) allFields.add(f.label);
      })
    );
    const fields = allFields.size ? Array.from(allFields) : ["Name", "Email", "Phone"];
    const blob = new Blob([buildCSV(leads, fields)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAdvancedExport = () => {
    let leadsToExport =
      exportConfig.exportType === "selected" && exportConfig.selectedChatbotIds.length
        ? leads.filter((l) => exportConfig.selectedChatbotIds.includes(l.chatbot.id))
        : leads;

    if (!leadsToExport.length) return;

    const fields = exportConfig.includeAllFields
      ? getAllAvailableFields()
      : exportConfig.customFields;

    if (exportConfig.format === "json") {
      const jsonData = leadsToExport.map((lead) => {
        const obj: any = {
          id: lead.id,
          chatbot: lead.chatbot.name,
          workspace: lead.chatbot.workspace.name,
          form: lead.form.title,
          submissionDate: lead.createdAt,
        };
        fields.forEach((fn) => (obj[fn] = getFieldValue(lead, fn)));
        if (exportConfig.includeConversation)
          obj.conversationPreview = lead.conversationPreview || "";
        return obj;
      });
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([buildCSV(leadsToExport, fields)], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setShowExportConfig(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-6 space-y-5 max-w-7xl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading
              ? "Loading…"
              : `${pagination?.total ?? 0} lead${pagination?.total !== 1 ? "s" : ""} captured`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleQuickExport} disabled={loading || !leads.length}>
            <FileDown className="h-4 w-4 mr-2" />
            Quick Export
          </Button>
          <Button size="sm" onClick={() => setShowExportConfig(true)} disabled={loading || !leads.length}>
            <Download className="h-4 w-4 mr-2" />
            Advanced Export
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            {/* Primary row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, chatbot…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-8 h-9"
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

              <Select
                value={urlChatbot}
                onValueChange={(v) => updateParams({ chatbotId: v, page: null })}
              >
                <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
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

              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="h-9 shrink-0"
                onClick={() => setShowFilters((p) => !p)}
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filters
                {(urlWorkspace !== "all" || urlDateFrom || urlDateTo) && (
                  <Badge className="ml-1.5 h-4 text-[10px] px-1.5">
                    {[urlWorkspace !== "all", urlDateFrom, urlDateTo].filter(Boolean).length}
                  </Badge>
                )}
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground px-2"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Expanded filter row */}
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-3 pt-1 border-t">
                <Select
                  value={urlWorkspace}
                  onValueChange={(v) => updateParams({ workspaceId: v, page: null })}
                >
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <Building className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Workspaces" />
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

                <div className="flex gap-2 items-center flex-1">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={urlDateFrom}
                      onChange={(e) =>
                        updateParams({ dateFrom: e.target.value || null, page: null })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={urlDateTo}
                      onChange={(e) =>
                        updateParams({ dateTo: e.target.value || null, page: null })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {loading ? (
                "Loading…"
              ) : (
                <>
                  {leads.length > 0 ? (
                    <span>
                      Showing {(urlPage - 1) * 15 + 1}–
                      {Math.min(urlPage * 15, pagination?.total ?? 0)} of{" "}
                      {pagination?.total ?? 0} leads
                    </span>
                  ) : (
                    "No leads found"
                  )}
                </>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={fetchLeads}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-6">Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead className="hidden sm:table-cell">Form</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10 pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-3.5 w-28" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="h-3.5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-20" />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <User className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">No leads found</p>
                        {hasActiveFilters && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => {
                    const contact = extractContactInfo(lead.data);
                    return (
                      <TableRow
                        key={lead.id}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowLeadDetails(true);
                        }}
                      >
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm leading-tight">
                                {contact.name || (
                                  <span className="text-muted-foreground">Anonymous</span>
                                )}
                              </p>
                              {contact.email && (
                                <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">
                                  {contact.email}
                                </p>
                              )}
                              {!contact.email && contact.phone && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {contact.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <div>
                            <p className="text-sm font-medium leading-tight">
                              {lead.chatbot.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {lead.chatbot.workspace.name}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {lead.form.title}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm leading-tight">
                            {format(new Date(lead.createdAt), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(lead.createdAt), "h:mm a")}
                          </div>
                        </TableCell>

                        <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel className="text-xs">
                                Actions
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                className="text-sm"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setShowLeadDetails(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {contact.email && (
                                <DropdownMenuItem
                                  className="text-sm"
                                  onClick={() =>
                                    window.open(`mailto:${contact.email}`, "_blank")
                                  }
                                >
                                  <Mail className="h-4 w-4 mr-2" />
                                  Email
                                </DropdownMenuItem>
                              )}
                              {contact.phone && (
                                <DropdownMenuItem
                                  className="text-sm"
                                  onClick={() =>
                                    window.open(`tel:${contact.phone}`, "_blank")
                                  }
                                >
                                  <Phone className="h-4 w-4 mr-2" />
                                  Call
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Page {urlPage} of {pagination.totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => updateParams({ page: String(Math.max(1, urlPage - 1)) })}
                  disabled={urlPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() =>
                    updateParams({
                      page: String(Math.min(pagination.totalPages, urlPage + 1)),
                    })
                  }
                  disabled={urlPage === pagination.totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Lead Details Dialog ── */}
      <Dialog open={showLeadDetails} onOpenChange={setShowLeadDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              {selectedLead &&
                `Submitted ${format(new Date(selectedLead.createdAt), "PPpp")}`}
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-5 mt-1">
              {/* Source info */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Chatbot</p>
                  <p className="font-medium">{selectedLead.chatbot.name}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Workspace</p>
                  <p className="font-medium">{selectedLead.chatbot.workspace.name}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Form</p>
                  <p className="font-medium">{selectedLead.form.title}</p>
                </div>
              </div>

              <Separator />

              {/* Form data */}
              <div>
                <h4 className="text-sm font-medium mb-3">Submitted Data</h4>
                <div className="space-y-2">
                  {selectedLead.form.fields && selectedLead.form.fields.length > 0 ? (
                    selectedLead.form.fields.map((field: any, idx: number) => {
                      const label = field.label || field.name || `Field ${idx + 1}`;
                      const value = getFieldValue(selectedLead, label);
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-3 gap-3 py-2 border-b last:border-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            {field.type && (
                              <p className="text-xs text-muted-foreground capitalize">
                                {field.type.toLowerCase()}
                              </p>
                            )}
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm">{value}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    Object.entries(selectedLead.data).map(([key, val]) => (
                      <div
                        key={key}
                        className="grid grid-cols-3 gap-3 py-2 border-b last:border-0"
                      >
                        <p className="text-sm font-medium">{key}</p>
                        <p className="col-span-2 text-sm">{String(val)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Conversation preview */}
              {selectedLead.conversationPreview && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Conversation Preview</h4>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground italic">
                      "{selectedLead.conversationPreview}"
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              {(() => {
                const contact = extractContactInfo(selectedLead.data);
                return (contact.email || contact.phone) ? (
                  <>
                    <Separator />
                    <div className="flex gap-2 justify-end">
                      {contact.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`mailto:${contact.email}`, "_blank")
                          }
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                      )}
                      {contact.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`tel:${contact.phone}`, "_blank")
                          }
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                      )}
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Advanced Export Dialog ── */}
      <Dialog open={showExportConfig} onOpenChange={setShowExportConfig}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Export Leads</DialogTitle>
            <DialogDescription>
              Configure what to include in your export
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="scope" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="scope">Scope</TabsTrigger>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="format">Format</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4 space-y-1">
              {/* Scope tab */}
              <TabsContent value="scope" className="space-y-4 m-0">
                <div className="space-y-1.5">
                  <Label>Export Type</Label>
                  <Select
                    value={exportConfig.exportType}
                    onValueChange={(v: "all" | "selected") =>
                      setExportConfig({ ...exportConfig, exportType: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Chatbots</SelectItem>
                      <SelectItem value="selected">Selected Chatbots</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {exportConfig.exportType === "selected" && (
                  <div className="space-y-2">
                    <Label>Select Chatbots</Label>
                    <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                      {chatbots.map((cb) => (
                        <div key={cb.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`cb-${cb.id}`}
                            checked={exportConfig.selectedChatbotIds.includes(cb.id)}
                            onCheckedChange={(checked) => {
                              const ids = checked
                                ? [...exportConfig.selectedChatbotIds, cb.id]
                                : exportConfig.selectedChatbotIds.filter(
                                    (id) => id !== cb.id
                                  );
                              setExportConfig({
                                ...exportConfig,
                                selectedChatbotIds: ids,
                              });
                            }}
                          />
                          <label htmlFor={`cb-${cb.id}`} className="text-sm">
                            {cb.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="inc-conv"
                    checked={exportConfig.includeConversation}
                    onCheckedChange={(checked) =>
                      setExportConfig({
                        ...exportConfig,
                        includeConversation: checked as boolean,
                      })
                    }
                  />
                  <label htmlFor="inc-conv" className="text-sm">
                    Include conversation preview
                  </label>
                </div>
              </TabsContent>

              {/* Fields tab */}
              <TabsContent value="fields" className="space-y-4 m-0">
                <div className="space-y-3">
                  <div className="space-y-2">
                    {[
                      { value: true, label: "All available fields" },
                      { value: false, label: "Select specific fields" },
                    ].map(({ value, label }) => (
                      <div key={label} className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={`field-opt-${value}`}
                          checked={exportConfig.includeAllFields === value}
                          onChange={() =>
                            setExportConfig({
                              ...exportConfig,
                              includeAllFields: value,
                            })
                          }
                        />
                        <label htmlFor={`field-opt-${value}`} className="text-sm">
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>

                  {!exportConfig.includeAllFields && (
                    <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                      {getAllAvailableFields().map((field) => (
                        <div key={field} className="flex items-center gap-2">
                          <Checkbox
                            id={`f-${field}`}
                            checked={exportConfig.customFields.includes(field)}
                            onCheckedChange={(checked) => {
                              const fields = checked
                                ? [...exportConfig.customFields, field]
                                : exportConfig.customFields.filter((f) => f !== field);
                              setExportConfig({ ...exportConfig, customFields: fields });
                            }}
                          />
                          <label htmlFor={`f-${field}`} className="text-sm">
                            {field}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Format tab */}
              <TabsContent value="format" className="space-y-4 m-0">
                <div className="space-y-1.5">
                  <Label>Export Format</Label>
                  <Select
                    value={exportConfig.format}
                    onValueChange={(v: "csv" | "json") =>
                      setExportConfig({ ...exportConfig, format: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                      <SelectItem value="json">JSON (Structured Data)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium mb-1.5">Export Summary</p>
                  <p className="text-muted-foreground">
                    Format: <span className="text-foreground">{exportConfig.format.toUpperCase()}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Scope:{" "}
                    <span className="text-foreground">
                      {exportConfig.exportType === "all"
                        ? "All chatbots"
                        : `${exportConfig.selectedChatbotIds.length} chatbot(s)`}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Fields:{" "}
                    <span className="text-foreground">
                      {exportConfig.includeAllFields
                        ? "All"
                        : `${exportConfig.customFields.length} selected`}
                    </span>
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowExportConfig(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdvancedExport}>
              <Download className="h-4 w-4 mr-2" />
              Export {leads.length} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
