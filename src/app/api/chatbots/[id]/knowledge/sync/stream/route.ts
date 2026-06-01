import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processURL } from '@/lib/langchain/knowledge/web-scraper';
import { embedAndStore, deleteDocument } from '@/lib/langchain/vector-store';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RouterParams {
  params: Promise<{ id: string }>;
}

function hashContent(content: string): string {
  return createHash('md5').update(content.trim()).digest('hex');
}

export async function POST(request: NextRequest, context: RouterParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id: chatbotId } = await context.params;
  const { knowledgeBaseId } = await request.json();

  if (!knowledgeBaseId) {
    return new Response(JSON.stringify({ error: 'knowledgeBaseId required' }), { status: 400 });
  }

  const kb = await prisma.knowledgeBase.findFirst({
    where: {
      id: knowledgeBaseId,
      chatbotId,
      chatbot: { workspace: { members: { some: { userId: session.user.id } } } },
    },
    include: {
      documents: { select: { id: true, source: true, content: true, metadata: true } },
    },
  });

  if (!kb) {
    return new Response(JSON.stringify({ error: 'Knowledge base not found' }), { status: 404 });
  }

  if (kb.type !== 'PAGE') {
    return new Response(JSON.stringify({ error: 'Sync only works for webpage knowledge bases' }), { status: 400 });
  }

  const urlDocs = kb.documents.filter(doc => {
    const meta = (doc.metadata as Record<string, any>) || {};
    const src = doc.source || meta?.url || meta?.source || '';
    return src.startsWith('http://') || src.startsWith('https://');
  });

  if (urlDocs.length === 0) {
    return new Response(JSON.stringify({ error: 'No URL documents to sync' }), { status: 400 });
  }

  // Derive the base URL from existing documents (use origin of first stored URL)
  const firstUrl = urlDocs[0].source?.startsWith('http')
    ? urlDocs[0].source
    : ((urlDocs[0].metadata as any)?.url || urlDocs[0].source);
  const baseUrl = new URL(firstUrl).origin;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
      };

      try {
        send({ type: 'start' });

        // Track skipped/failed counts across crawl_progress events
        let pagesSkipped = 0;
        let pagesFailed = 0;

        // Full re-crawl from the base URL — discovers sitemap + all pages
        const { pages: crawledPages } = await processURL(
          baseUrl,
          true,   // crawlSubpages = true
          3000,
          (current, total, url, bytes, pagesOk, pageStatus) => {
            if (pageStatus === 'skipped') pagesSkipped++;
            if (pageStatus === 'failed')  pagesFailed++;
            send({ type: 'crawl_progress', current, total, url, bytes, pagesOk, pagesSkipped, pagesFailed, pageStatus });
          },
        );

        const discovered = crawledPages ?? [];
        send({ type: 'crawl_done', totalFound: discovered.length });

        if (discovered.length === 0) {
          send({ type: 'done', summary: { crawled: 0, added: 0, updated: 0, unchanged: 0, failed: 0 }, syncedAt: new Date().toISOString() });
          controller.close();
          return;
        }

        // Build URL → existing doc lookup
        const existingByUrl = new Map(urlDocs.map(doc => {
          const src = doc.source?.startsWith('http')
            ? doc.source
            : ((doc.metadata as any)?.url || (doc.metadata as any)?.source || doc.source);
          return [src, doc];
        }));

        let added = 0, updated = 0, unchanged = 0, failed = 0;

        for (let i = 0; i < discovered.length; i++) {
          const page = discovered[i];
          const existing = existingByUrl.get(page.url);

          try {
            if (!existing) {
              // New page found by crawl — add it
              const doc = await prisma.document.upsert({
                where: { source: page.url },
                update: { content: page.content, knowledgeBaseId, metadata: { ...page.metadata, title: page.title, url: page.url } },
                create: { knowledgeBaseId, source: page.url, content: page.content, metadata: { ...page.metadata, title: page.title, url: page.url } },
              });
              await embedAndStore({
                documentId: doc.id,
                content: page.content,
                metadata: { chatbotId, knowledgeBaseId, source: page.url, title: page.title, type: 'url' },
                chatbotId,
                knowledgeBaseId,
              });
              added++;
              send({ type: 'page', url: page.url, result: 'added', current: i + 1, total: discovered.length, newWords: page.metadata.wordCount });
            } else {
              // Existing page — compare content hash
              const oldHash = hashContent(existing.content || '');
              const newHash = hashContent(page.content);

              if (oldHash === newHash) {
                unchanged++;
                send({ type: 'page', url: page.url, result: 'unchanged', current: i + 1, total: discovered.length });
              } else {
                const oldWords = (existing.content || '').trim().split(/\s+/).filter(Boolean).length;
                await prisma.document.update({
                  where: { id: existing.id },
                  data: {
                    content: page.content,
                    metadata: { ...(existing.metadata as object || {}), title: page.title, wordCount: page.metadata.wordCount, syncedAt: new Date().toISOString() },
                  },
                });
                await deleteDocument(existing.id);
                await embedAndStore({
                  documentId: existing.id,
                  content: page.content,
                  metadata: { chatbotId, knowledgeBaseId, source: existing.source, title: page.title, type: 'url' },
                  chatbotId,
                  knowledgeBaseId,
                });
                updated++;
                send({ type: 'page', url: page.url, result: 'updated', current: i + 1, total: discovered.length, oldWords, newWords: page.metadata.wordCount });
              }
            }
          } catch (err) {
            failed++;
            send({ type: 'page', url: page.url, result: 'failed', current: i + 1, total: discovered.length, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }

        await prisma.questionCache.deleteMany({ where: { chatbotId } });

        send({
          type: 'done',
          summary: { crawled: discovered.length, added, updated, unchanged, failed },
          syncedAt: new Date().toISOString(),
        });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Sync failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
