// hooks/useKnowledgeUpload.ts
import { useState } from 'react';
import { toast } from 'sonner'; // or your toast library

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
}

export function useKnowledgeUpload(chatbotId: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);

  const uploadFiles = async (files: File[], type: 'file' | 'table', name?: string) => {
    setUploading(true);
    setProgress(
      files.map(file => ({
        fileName: file.name,
        progress: 0,
        status: 'pending',
      }))
    );

    try {
      const formData = new FormData();
      formData.append('type', type);
      if (name) formData.append('name', name);
      
      files.forEach(file => {
        formData.append('files', file);
      });

      // Update progress to uploading
      setProgress(prev =>
        prev.map(p => ({ ...p, status: 'uploading', progress: 50 }))
      );

      const response = await fetch(`/api/chatbots/${chatbotId}/knowledge`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      // Update progress based on results
      setProgress(prev =>
        prev.map(p => {
          const fileResult = result.results.find(
            (r: any) => r.fileName === p.fileName
          );
          if (fileResult) {
            return {
              ...p,
              status: fileResult.success ? 'success' : 'error',
              progress: 100,
              error: fileResult.error,
            };
          }
          return p;
        })
      );

      const successCount = result.results.filter((r: any) => r.success).length;
      const failCount = result.results.filter((r: any) => !r.success).length;

      if (successCount > 0) {
        toast.success(
          `Successfully uploaded ${successCount} ${type === 'file' ? 'file(s)' : 'table(s)'}`
        );
      }

      if (failCount > 0) {
        toast.error(`Failed to upload ${failCount} ${type === 'file' ? 'file(s)' : 'table(s)'}`);
      }

      return result;
    } catch (error) {
      setProgress(prev =>
        prev.map(p => ({
          ...p,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      );
      toast.error('Upload failed. Please try again.');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const uploadWebpage = async (url: string, crawlSubpages: boolean, name?: string) => {
    setUploading(true);

    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'webpage',
          url,
          crawlSubpages,
          name,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to crawl webpage');
      }

      const result = await response.json();
      toast.success(`Successfully crawled ${result.pageCount} page(s)`);
      return result;
    } catch (error) {
      toast.error('Failed to crawl webpage');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setProgress([]);
  };

  return {
    uploading,
    progress,
    uploadFiles,
    uploadWebpage,
    reset,
  };
}