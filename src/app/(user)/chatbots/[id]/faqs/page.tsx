"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import TextEditor from "@/components/features/text-editor";
import { 
  Plus, 
  HelpCircle, 
  Edit, 
  Trash2, 
  ChevronDown,
  Loader2,
  CheckCircle2,
  X,
  Calendar,
  FileQuestion,
  Save
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// --- Helper for conditional classes ---
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface FAQ {
  id: string;
  normalizedQ: string;
  htmlResponse: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- Sub-Component: FAQ Item (Simplified to remove inline editing) ---
const FAQItem = ({ 
  faq, 
  onEdit, 
  onDelete,
  isLoading
}: { 
  faq: FAQ, 
  onEdit: (faq: FAQ) => void, 
  onDelete: (faq: FAQ) => void,
  isLoading: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-md bg-card transition-all hover:shadow-sm">
      <div 
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors",
          isOpen ? "border-b bg-accent/20" : ""
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground flex items-center gap-2 break-words">
              {faq.normalizedQ}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {faq.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDistanceToNow(new Date(faq.createdAt), { addSuffix: true })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <FileQuestion className="w-3 h-3" />
                FAQ
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(faq);
            }}
            disabled={isLoading}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(faq);
            }}
            disabled={isLoading}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <div className={cn("text-muted-foreground transition-transform duration-200", isOpen ? "rotate-180" : "")}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="bg-muted/10 animate-in slide-in-from-top-2 duration-200">
          <div className="p-6">
            <div className="prose max-w-none dark:prose-invert">
              <div dangerouslySetInnerHTML={{ __html: faq.htmlResponse }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function FAQsPage() {
  const params = useParams();
  const chatbotId = params.id as string;

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for TinyMCE editors
  const editEditorRef = useRef<any>(null);
  const addEditorRef = useRef<any>(null);
  
  // Edit states
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [editContent, setEditContent] = useState("");
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ status: string; progress: number } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [faqToDelete, setFaqToDelete] = useState<FAQ | null>(null);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chatbots/${chatbotId}/faqs`);
      if (!response.ok) throw new Error('Failed to fetch FAQs');
      const data = await response.json();
      setFaqs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch FAQs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFAQs(); }, [chatbotId]);

  const handleEditClick = (faq: FAQ) => {
    setEditingFaq(faq);
    setEditContent(faq.htmlResponse);
  };

  const handleSave = async () => {
    if (!editingFaq) return;
    setUploading(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/faqs/${editingFaq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlResponse: editContent }),
      });
      if (!response.ok) throw new Error('Failed to save FAQ');
      setFaqs(faqs.map(f => f.id === editingFaq.id ? { ...f, htmlResponse: editContent } : f));
      setEditingFaq(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (faq: FAQ) => {
    setFaqToDelete(faq);
    setDeleteDialogOpen(true);
  };

  const deleteFAQ = async () => {
    if (!faqToDelete) return;
    setUploading(true);
    try {
      await fetch(`/api/chatbots/${chatbotId}/faqs/${faqToDelete.id}`, { method: 'DELETE' });
      setFaqs(faqs.filter(f => f.id !== faqToDelete.id));
      setDeleteDialogOpen(false);
    } finally {
      setUploading(false);
    }
  };

  const handleAddFAQ = async () => {
    setUploading(true);
    setProgress({ status: 'processing', progress: 10 });
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/faqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normalizedQ: newQuestion.trim(), htmlResponse: newResponse }),
      });
      if (!response.ok) throw new Error('Failed');
      const newFAQ = await response.json();
      setFaqs([...faqs, newFAQ]);
      setProgress({ status: 'success', progress: 100 });
      setTimeout(() => {
        setIsDialogOpen(false);
        setNewQuestion('');
        setNewResponse('');
        setProgress(null);
      }, 800);
    } catch {
      setProgress({ status: 'error', progress: 0 });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
        <Button onClick={() => setIsDialogOpen(true)} className="shadow-sm w-full">
          <Plus className="w-4 h-4 mr-2" /> Add FAQ
        </Button>

        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-md border border-dashed">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : faqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-md border border-dashed">
              <HelpCircle className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No FAQs yet. Add your first one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <FAQItem 
                  key={faq.id} 
                  faq={faq} 
                  onEdit={handleEditClick} 
                  onDelete={handleDeleteClick} 
                  isLoading={uploading} 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- FULL SCREEN ABSOLUTE EDITOR POPUP --- */}
      {editingFaq && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-5xl h-full max-h-[90vh] border rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between bg-muted/30">
              <div>
                <h2 className="text-xl font-semibold">Editing FAQ</h2>
                <p className="text-sm text-muted-foreground">{editingFaq.normalizedQ}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingFaq(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-background">
              <div className="space-y-4 h-full">
                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Response Content</Label>
                <div className="min-h-[400px]">
                  <TextEditor
                    editorRef={editEditorRef}
                    handleInputChange={(e: any) => setEditContent(e.target.value)}
                    name="editContent"
                    value={editContent}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-muted/30 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingFaq(null)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={uploading} className="min-w-[120px]">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add FAQ Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New FAQ</DialogTitle>
            <DialogDescription>
              Create a new frequently asked question with a detailed answer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Input 
                placeholder="e.g., What is the return policy?" 
                value={newQuestion} 
                onChange={(e) => setNewQuestion(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Answer</Label>
              <TextEditor 
                editorRef={addEditorRef}
                handleInputChange={(e: any) => setNewResponse(e.target.value)} 
                name="newResponse" 
                value={newResponse} 
              />
            </div>
            {progress && (
               <div className="space-y-1">
                 <div className="flex justify-between text-xs mb-1">
                    <span>{progress.status === 'success' ? 'Success!' : progress.status === 'error' ? 'Error!' : 'Processing...'}</span>
                    <span>{progress.progress}%</span>
                 </div>
                 <Progress value={progress.progress} className="h-1" />
                 {progress.status === 'error' && (
                   <p className="text-xs text-destructive">Failed to add FAQ. Please try again.</p>
                 )}
               </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFAQ} disabled={!newQuestion || !newResponse || uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add FAQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFAQ} className="bg-destructive hover:bg-destructive/90">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}