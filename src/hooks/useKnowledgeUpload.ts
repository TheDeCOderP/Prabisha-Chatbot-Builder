import { useState } from 'react';
import { toast } from 'sonner';

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
}

export interface ScrapedPageEntry {
  url: string;
  status: 'ok' | 'skipped' | 'failed';
}

export interface ScrapeProgress {
  phase: 'scraping' | 'storing' | 'done';
  current: number;
  total: number;
  currentUrl: string;
  bytesTotal: number;
  pagesOk: number;
  pagesSkipped: number;
  pagesFailed: number;
  storedCurrent: number;
  storedTotal: number;
  log: ScrapedPageEntry[];       // per-page log for scrollable list
}

export function useKnowledgeUpload(chatbotId: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(null);

  const uploadFiles = async (files: File[], type: 'file' | 'table', name?: string) => {
    setUploading(true);
    setProgress(files.map(file => ({ fileName: file.name, progress: 0, status: 'pending' })));

    try {
      const formData = new FormData();
      formData.append('type', type);
      if (name) formData.append('name', name);
      files.forEach(file => formData.append('files', file));

      setProgress(prev => prev.map(p => ({ ...p, status: 'uploading', progress: 50 })));

      const response = await fetch(`/api/chatbots/${chatbotId}/knowledge`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();

      setProgress(prev =>
        prev.map(p => {
          const fileResult = result.results.find((r: any) => r.fileName === p.fileName);
          if (fileResult) return { ...p, status: fileResult.success ? 'success' : 'error', progress: 100, error: fileResult.error };
          return p;
        })
      );

      const successCount = result.results.filter((r: any) => r.success).length;
      const failCount    = result.results.filter((r: any) => !r.success).length;
      if (successCount > 0) toast.success(`Uploaded ${successCount} ${type === 'file' ? 'file(s)' : 'table(s)'}`);
      if (failCount    > 0) toast.error(`Failed to upload ${failCount} ${type === 'file' ? 'file(s)' : 'table(s)'}`);
      return result;
    } catch (error) {
      setProgress(prev => prev.map(p => ({ ...p, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })));
      toast.error('Upload failed. Please try again.');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const uploadWebpage = async (url: string, crawlSubpages: boolean, autoUpdate: boolean) => {
    setUploading(true);
    setScrapeProgress({
      phase: 'scraping',
      current: 0, total: 0,
      currentUrl: url,
      bytesTotal: 0,
      pagesOk: 0, pagesSkipped: 0, pagesFailed: 0,
      storedCurrent: 0, storedTotal: 0,
      log: [],
    });

    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/knowledge/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, crawlSubpages, autoUpdate, type: 'webpage' }),
      });

      if (!response.ok || !response.body) throw new Error('Failed to crawl webpage');

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'progress') {
              setScrapeProgress(prev => {
                const prevLog = prev?.log ?? [];
                // Add this URL to the log (avoid duplicates)
                const alreadyLogged = prevLog.some(e => e.url === event.url);
                const newLog: ScrapedPageEntry[] = alreadyLogged
                  ? prevLog
                  : [...prevLog, { url: event.url, status: event.pageStatus ?? 'ok' }];
                return {
                  phase: 'scraping',
                  current: event.current,
                  total: event.total,
                  currentUrl: event.url,
                  bytesTotal: event.bytes,
                  pagesOk: event.pagesOk,
                  pagesSkipped: event.pagesSkipped ?? 0,
                  pagesFailed: event.pagesFailed ?? 0,
                  storedCurrent: prev?.storedCurrent ?? 0,
                  storedTotal: prev?.storedTotal ?? 0,
                  log: newLog,
                };
              });
            } else if (event.type === 'storing') {
              setScrapeProgress(prev => ({
                ...(prev ?? { current: 0, total: 0, currentUrl: '', bytesTotal: 0, pagesOk: 0, pagesSkipped: 0, pagesFailed: 0, log: [] }),
                phase: 'storing',
                storedCurrent: event.current,
                storedTotal: event.total,
              }));
            } else if (event.type === 'done') {
              result = event;
              setScrapeProgress(prev => prev ? { ...prev, phase: 'done' } : null);
              toast.success(`Scraped ${event.pagesScraped} page(s) successfully`);
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

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
    setScrapeProgress(null);
  };

  return { uploading, progress, scrapeProgress, uploadFiles, uploadWebpage, reset };
}
