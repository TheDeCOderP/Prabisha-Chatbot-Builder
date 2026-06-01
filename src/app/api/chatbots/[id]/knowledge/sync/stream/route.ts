import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { scrapePage } from '@/lib/langchain/knowledge/web-scraper';
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: 'start', total: urlDocs.length });

        const summary = { updated: 0, unchanged: 0, failed: 0 };
        const updatedDetails: Array<{ url: string; oldWords: number; newWords: number }> = [];
        const failedDetails: Array<{ url: string; error: string }> = [];

        for (let i = 0; i < urlDocs.length; i++) {
          const doc = urlDocs[i];
          const meta = (doc.metadata as Record<string, any>) || {};
          const docUrl = doc.source?.startsWith('http')
            ? doc.source
            : (meta?.url || meta?.source || doc.source);

          send({ type: 'progress', current: i + 1, total: urlDocs.length, url: docUrl });

          try {
            const scraped = await scrapePage(docUrl);

            if (scraped.wordCount < 50) {
              const errMsg = `Too thin (${scraped.wordCount} words)`;
              summary.failed++;
              failedDetails.push({ url: docUrl, error: errMsg });
              send({ type: 'page', current: i + 1, total: urlDocs.length, url: docUrl, result: 'failed', error: errMsg });
              continue;
            }

            const oldHash = hashContent(doc.content || '');
            const newHash = hashContent(scraped.content);

            if (oldHash === newHash) {
              summary.unchanged++;
              send({ type: 'page', current: i + 1, total: urlDocs.length, url: docUrl, result: 'unchanged' });
              continue;
            }

            const oldWords = (doc.content || '').trim().split(/\s+/).filter(Boolean).length;
            const newWords = scraped.wordCount;

            await prisma.document.update({
              where: { id: doc.id },
              data: {
                content: scraped.content,
                metadata: {
                  ...(doc.metadata as object || {}),
                  title: scraped.title,
                  wordCount: newWords,
                  syncedAt: new Date().toISOString(),
                },
              },
            });

            send({ type: 'saving', url: docUrl, current: i + 1, total: urlDocs.length });

            await deleteDocument(doc.id);
            await embedAndStore({
              documentId: doc.id,
              content: scraped.content,
              metadata: { chatbotId, knowledgeBaseId, source: doc.source, title: scraped.title, type: 'url' },
              chatbotId,
              knowledgeBaseId,
            });

            summary.updated++;
            updatedDetails.push({ url: docUrl, oldWords, newWords });
            send({ type: 'page', current: i + 1, total: urlDocs.length, url: docUrl, result: 'updated', oldWords, newWords });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            summary.failed++;
            failedDetails.push({ url: docUrl, error: errMsg });
            send({ type: 'page', current: i + 1, total: urlDocs.length, url: docUrl, result: 'failed', error: errMsg });
          }
        }

        await prisma.questionCache.deleteMany({ where: { chatbotId } });

        send({
          type: 'done',
          summary: { total: urlDocs.length, ...summary },
          details: { updated: updatedDetails, failed: failedDetails },
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
