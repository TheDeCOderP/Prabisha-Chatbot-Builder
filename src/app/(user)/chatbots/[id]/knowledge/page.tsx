"use client"

import { useParams } from "next/navigation"
import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { useKnowledgeUpload, type ScrapeProgress } from "@/hooks/useKnowledgeUpload"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Icons - Aliased to prevent conflicts with standard Types
import {
  Plus,
  Globe,
  Table as TableIcon,
  FileText,
  X,
  Upload,
  File as FileIcon,
  CheckCircle2,
  Loader2,
  Trash2,
  Book,
  Package,
  Globe as WebIcon,
  FileQuestion,
  Calendar,
  ChevronDown,
  RefreshCw,
  ArrowUpCircle,
  MinusCircle,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

// --- Helper for conditional classes (removes dependency on @/lib/utils) ---
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ")
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Types ---
interface KnowledgeBase {
  id: string
  name: string
  type: string
  indexName: string
  autoUpdate: boolean
  createdAt: string
  updatedAt: string
  documents: Array<{
    id: string
    source: string
    metadata: any
    createdAt: string
  }>
}

interface Document {
  id: string
  source: string
  metadata: any
  createdAt: string
}

// --- Sub-Component: Knowledge Base Item (Collapsible) ---
interface SyncResult {
  summary: { total: number; updated: number; unchanged: number; failed: number };
  details: {
    updated: Array<{ url: string; oldWords: number; newWords: number }>;
    unchanged: string[];
    failed: Array<{ url: string; error: string }>;
  };
  syncedAt: string;
}

const KnowledgeBaseItem = ({
  kb,
  chatbotId,
  onDeleteKb,
  onDeleteDoc,
}: {
  kb: KnowledgeBase;
  chatbotId: string;
  onDeleteKb: (kb: KnowledgeBase) => void;
  onDeleteDoc: (kbId: string, doc: Document) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showSyncResult, setShowSyncResult] = useState(false);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/knowledge/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBaseId: kb.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncResult(data);
      setShowSyncResult(true);
      toast.success(`Sync complete — ${data.summary.updated} pages updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Get icon for KB type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PRODUCT': return <Package className="w-4 h-4" />
      case 'PAGE': return <WebIcon className="w-4 h-4" />
      case 'FAQ': return <FileQuestion className="w-4 h-4" />
      case 'DOC': return <FileText className="w-4 h-4" />
      default: return <Book className="w-4 h-4" />
    }
  }

  return (
    <div className="border rounded-md bg-card transition-all hover:shadow-sm">
      {/* Header / Trigger */}
      <div 
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors",
          isOpen ? "border-b bg-accent/20" : ""
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {getTypeIcon(kb.type)}
          </div>
          <div>
            <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
              {kb.name || "Untitled Knowledge Base"}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {kb.createdAt ? formatDistanceToNow(new Date(kb.createdAt), { addSuffix: true }) : 'Just now'}
              </span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {kb.documents?.length || 0} items
              </span>
              {kb.updatedAt && kb.updatedAt !== kb.createdAt && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <span className="flex items-center gap-1 text-primary/70">
                    <RefreshCw className="w-3 h-3" />
                    synced {formatDistanceToNow(new Date(kb.updatedAt), { addSuffix: true })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {kb.type === 'PAGE' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors"
              onClick={handleSync}
              disabled={syncing}
              title="Sync — re-scrape all URLs"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive transition-colors"
            onClick={(e) => { e.stopPropagation(); onDeleteKb(kb); }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <div className={cn("text-muted-foreground transition-transform duration-200", isOpen ? "rotate-180" : "")}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && showSyncResult && (
        <div className="border-t bg-muted/30 px-4 py-3 text-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
              Sync Result — {new Date(syncResult.syncedAt).toLocaleString()}
            </span>
            <button onClick={() => setShowSyncResult(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              <ArrowUpCircle className="w-3 h-3" />
              {syncResult.summary.updated} updated
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              <MinusCircle className="w-3 h-3" />
              {syncResult.summary.unchanged} unchanged
            </span>
            {syncResult.summary.failed > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                <AlertCircle className="w-3 h-3" />
                {syncResult.summary.failed} failed
              </span>
            )}
          </div>

          {/* Updated pages detail */}
          {syncResult.details.updated.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-green-700">Changed pages:</p>
              {syncResult.details.updated.map((u) => (
                <div key={u.url} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowUpCircle className="w-3 h-3 text-green-500 shrink-0" />
                  <span className="truncate flex-1">{u.url}</span>
                  <span className="shrink-0 text-muted-foreground/70">{u.oldWords}w → {u.newWords}w</span>
                </div>
              ))}
            </div>
          )}

          {/* Failed pages */}
          {syncResult.details.failed.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-600">Failed:</p>
              {syncResult.details.failed.map((f) => (
                <div key={f.url} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                  <span className="truncate flex-1">{f.url}</span>
                  <span className="shrink-0 text-red-400">{f.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Content */}
      {isOpen && (
        <div className="bg-muted/10 animate-in slide-in-from-top-2 duration-200">
          {kb.documents && kb.documents.length > 0 ? (
            <div className="border-t-0">
               <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="pl-6 h-9 text-xs">Source Name</TableHead>
                    <TableHead className="h-9 text-xs">Type</TableHead>
                    <TableHead className="pr-6 text-right h-9 text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kb.documents.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/50 border-border/50">
                      <TableCell className="pl-6 font-medium max-w-75 truncate py-3">
                        <div className="flex items-center gap-2 text-sm">
                          {doc.metadata?.url ? (
                            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <FileIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate" title={doc.metadata?.fileName || doc.source}>
                            {doc.metadata?.fileName || doc.source}
                          </span>
                        </div>
                      </TableCell>
                       <TableCell className="py-3 text-xs text-muted-foreground">
                        {doc.metadata?.url ? "Webpage" : "File"}
                       </TableCell>
                      <TableCell className="pr-6 text-right py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteDoc(kb.id, doc)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground italic">
              No documents found in this knowledge base.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Main Page Component ---
export default function KnowledgePage() {
  const params = useParams();
  const chatbotId = params.id as string;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("webpage");

  const [webpageUrl, setWebpageUrl] = useState("");
  const [sourceName, setSourceName] = useState(""); // Kept sourceName state even if not used in UI for future use
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [crawlSubpages, setCrawlSubpages] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadedTables, setUploadedTables] = useState<File[]>([])
  
  // State for knowledge bases
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [kbToDelete, setKbToDelete] = useState<KnowledgeBase | null>(null)
  const [docToDelete, setDocToDelete] = useState<{ kbId: string, doc: Document } | null>(null)

  const { uploading, progress, scrapeProgress, uploadFiles, uploadWebpage, reset } = useKnowledgeUpload(chatbotId)

  // Fetch knowledge bases
  const fetchKnowledgeBases = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/chatbots/${chatbotId}/knowledge`)
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBases(data)
      }
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error)
    } finally {
      setLoading(false)
    }
  }, [chatbotId])

  // Delete knowledge base
  const deleteKnowledgeBase = async (kbId: string) => {
    try {
      const response = await fetch(
        `/api/chatbots/${chatbotId}/knowledge?knowledgeBaseId=${kbId}`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        setKnowledgeBases(prev => prev.filter(kb => kb.id !== kbId))
        setDeleteDialogOpen(false)
        setKbToDelete(null)
        toast.success('Knowledge base deleted')
      }
    } catch (error) {
      console.error('Failed to delete knowledge base:', error)
      toast.error('Failed to delete')
    }
  }

  // Delete document
  const deleteDocument = async (kbId: string, docId: string) => {
    try {
      const response = await fetch(
        `/api/chatbots/${chatbotId}/knowledge?documentId=${docId}`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        setKnowledgeBases(prev =>
          prev.map(kb =>
            kb.id === kbId
              ? { ...kb, documents: kb.documents.filter(doc => doc.id !== docId) }
              : kb
          )
        )
        setDeleteDialogOpen(false)
        setDocToDelete(null)
        toast.success('Document deleted')
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      toast.error('Failed to delete')
    }
  }

  useEffect(() => {
    fetchKnowledgeBases()
  }, [fetchKnowledgeBases])

  // File upload dropzone
  const onFileDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps: getFileRootProps, getInputProps: getFileInputProps, isDragActive: isFileDragActive } = useDropzone({
    onDrop: onFileDrop,
    accept: {
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 12097152, // ~12MB
  })

  // Table upload dropzone
  const onTableDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedTables((prev) => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps: getTableRootProps, getInputProps: getTableInputProps, isDragActive: isTableDragActive } = useDropzone({
    onDrop: onTableDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".sql"],
      "application/sql": [".sql"],
    },
    maxSize: 5242880, // 5MB
  })

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeTable = (index: number) => {
    setUploadedTables((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    try {
      if (selectedType === 'file' && uploadedFiles.length > 0) {
        await uploadFiles(uploadedFiles, 'file', sourceName)
        setUploadedFiles([])
        setIsDialogOpen(false)
        reset()
        fetchKnowledgeBases()
      } else if (selectedType === 'table' && uploadedTables.length > 0) {
        await uploadFiles(uploadedTables, 'table', sourceName)
        setUploadedTables([])
        setIsDialogOpen(false)
        reset()
        fetchKnowledgeBases()
      } else if (selectedType === 'webpage' && webpageUrl) {
        await uploadWebpage(webpageUrl, crawlSubpages, autoUpdate)
        setWebpageUrl('')
        setIsDialogOpen(false)
        fetchKnowledgeBases()
      }
      setSourceName('')
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  const canSubmit = () => {
    if (selectedType === 'file') return uploadedFiles.length > 0
    if (selectedType === 'table') return uploadedTables.length > 0
    if (selectedType === 'webpage') return webpageUrl.trim() !== ''
    return false
  }

  return (
    <>
      <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header Section */}
        <Button onClick={() => setIsDialogOpen(true)} className="shadow-sm w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>

        {/* Knowledge Bases List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-md border border-dashed">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <span className="text-sm text-muted-foreground">Syncing knowledge base...</span>
            </div>
          ) : knowledgeBases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-md bg-muted/5 border-dashed">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Book className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No knowledge sources yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Connect a website, upload a document, or add a table to train your chatbot.
              </p>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                Add your first source
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {knowledgeBases.map((kb) => (
                <KnowledgeBaseItem
                  key={kb.id}
                  kb={kb}
                  chatbotId={chatbotId}
                  onDeleteKb={(k) => {
                    setKbToDelete(k)
                    setDeleteDialogOpen(true)
                  }}
                  onDeleteDoc={(kbId, doc) => {
                    setDocToDelete({ kbId, doc })
                    setDeleteDialogOpen(true)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADD SOURCE DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-150 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Knowledge Source</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Source Type</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "webpage", icon: Globe, label: "Webpage" },
                  { id: "file", icon: FileText, label: "File" },
                  { id: "table", icon: TableIcon, label: "Table" },
                ].map((type) => (
                  <div 
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 gap-2 rounded-md border cursor-pointer transition-all hover:bg-muted/50",
                      selectedType === type.id 
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                        : "border-border bg-background"
                    )}
                  >
                    <type.icon className={cn("w-6 h-6", selectedType === type.id ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", selectedType === type.id ? "text-primary" : "text-foreground")}>
                      {type.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Webpage URL Input */}
            {selectedType === "webpage" && !(uploading && scrapeProgress) && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={webpageUrl}
                    onChange={(e) => setWebpageUrl(e.target.value)}
                  />
                  <p className="text-[0.8rem] text-muted-foreground">Publicly accessible URL to index.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3 p-3 rounded-md border">
                    <Checkbox
                      id="crawl-subpages"
                      checked={crawlSubpages}
                      onCheckedChange={(checked) => setCrawlSubpages(checked === true)}
                    />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="crawl-subpages" className="font-medium cursor-pointer">
                        Crawl Subpages
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Index all links found on this page.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-md border">
                    <Checkbox
                      id="auto-update"
                      checked={autoUpdate}
                      onCheckedChange={(checked) => setAutoUpdate(checked === true)}
                    />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="auto-update" className="font-medium cursor-pointer">
                        Auto-Sync
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Re-crawl periodically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload UI */}
            {selectedType === "file" && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div
                  {...getFileRootProps()}
                  className={cn(
                    "border border-dashed rounded-md p-8 text-center cursor-pointer transition-colors",
                    isFileDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                >
                  <input {...getFileInputProps()} />
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT (Max 12MB)</p>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Ready to Upload</Label>
                    <div className="space-y-2 max-h-37.5 overflow-y-auto pr-1">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/10 text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(index)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Table Upload UI */}
            {selectedType === "table" && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div
                  {...getTableRootProps()}
                  className={cn(
                    "border border-dashed rounded-md p-8 text-center cursor-pointer transition-colors",
                    isTableDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                >
                  <input {...getTableInputProps()} />
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload structured data</p>
                  <p className="text-xs text-muted-foreground mt-1">CSV, XLS, XLSX (Max 5MB)</p>
                </div>

                {uploadedTables.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Ready to Upload</Label>
                    <div className="space-y-2 max-h-37.5 overflow-y-auto pr-1">
                      {uploadedTables.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/10 text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <TableIcon className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeTable(index)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Webpage scrape live progress */}
            {uploading && selectedType === 'webpage' && scrapeProgress && (
              <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {scrapeProgress.phase === 'done'
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  }
                  <span>
                    {scrapeProgress.phase === 'storing'
                      ? 'Saving to knowledge base...'
                      : scrapeProgress.phase === 'done'
                      ? 'Done!'
                      : 'Scraping pages...'}
                  </span>
                </div>

                {/* Current URL */}
                <div className="text-xs text-muted-foreground truncate bg-muted/40 px-3 py-2 rounded-md font-mono border">
                  {scrapeProgress.currentUrl || 'Initializing...'}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {scrapeProgress.phase === 'storing'
                        ? `Storing ${scrapeProgress.storedCurrent} / ${scrapeProgress.storedTotal}`
                        : `${scrapeProgress.current} / ${scrapeProgress.total || '?'} pages`}
                    </span>
                    <span>{formatBytes(scrapeProgress.bytesTotal)}</span>
                  </div>
                  <Progress
                    value={
                      scrapeProgress.phase === 'storing' && scrapeProgress.storedTotal > 0
                        ? (scrapeProgress.storedCurrent / scrapeProgress.storedTotal) * 100
                        : scrapeProgress.total > 0
                        ? (scrapeProgress.current / scrapeProgress.total) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                {/* Stats row */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    {scrapeProgress.pagesOk} useful pages
                  </span>
                  {scrapeProgress.total > 0 && scrapeProgress.current < scrapeProgress.total && scrapeProgress.phase === 'scraping' && (
                    <span>{scrapeProgress.total - scrapeProgress.current} remaining</span>
                  )}
                </div>
              </div>
            )}

            {/* File/Table upload progress */}
            {uploading && selectedType !== 'webpage' && progress.length > 0 && (
              <div className="space-y-3 pt-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Processing</Label>
                {progress.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {item.status === 'success' ? <CheckCircle2 className="w-3 h-3 text-green-500"/> : <Loader2 className="w-3 h-3 animate-spin"/>}
                        <span className="truncate max-w-50">{item.fileName}</span>
                      </div>
                      <span>{item.progress}%</span>
                    </div>
                    <Progress value={item.progress} className="h-1" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit() || uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {uploading ? 'Processing...' : 'Add Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {kbToDelete 
                ? `This will permanently delete "${kbToDelete.name}" and remove all associated documents from the index.`
                : "This will permanently remove this document from the knowledge base."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setKbToDelete(null)
              setDocToDelete(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (kbToDelete) {
                  deleteKnowledgeBase(kbToDelete.id)
                } else if (docToDelete) {
                  deleteDocument(docToDelete.kbId, docToDelete.doc.id)
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}