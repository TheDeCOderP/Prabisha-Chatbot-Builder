import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { embedAndStore } from '@/lib/langchain/vector-store';
import { processURL } from '@/lib/langchain/knowledge/web-scraper';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RouterParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouterParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: chatbotId } = await context.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: {
      id: chatbotId,
      workspace: { members: { some: { userId: session.user.id } } },
    },
  });

  if (!chatbot) {
    return new Response('Not found', { status: 404 });
  }

  const body = await request.json();
  const { url, crawlSubpages, name, autoUpdate } = body;

  if (!url) {
    return new Response('URL required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      let knowledgeBaseId: string | null = null;

      try {
        const knowledgeBase = await prisma.knowledgeBase.create({
          data: {
            chatbotId,
            autoUpdate: autoUpdate ?? false,
            name: name || `Webpage - ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())}`,
            type: 'PAGE',
            indexName: `kb_${chatbotId}_${Date.now()}`,
          },
        });
        knowledgeBaseId = knowledgeBase.id;

        send({ type: 'start', knowledgeBaseId: knowledgeBase.id });

        let pagesSkipped = 0;
        let pagesFailed  = 0;

        const { pages } = await processURL(
          url,
          crawlSubpages ?? false,
          3000,
          (current, total, currentUrl, bytes, pagesOk, pageStatus) => {
            if (pageStatus === 'skipped') pagesSkipped++;
            if (pageStatus === 'failed')  pagesFailed++;
            send({ type: 'progress', current, total, url: currentUrl, bytes, pagesOk, pagesSkipped, pagesFailed, pageStatus });
          },
        );

        const usefulPages = (pages ?? []).filter(p => p.metadata.wordCount >= 50);
        const skipped = (pages?.length ?? 0) - usefulPages.length;

        send({ type: 'storing', current: 0, total: usefulPages.length });

        let stored = 0;
        for (const page of usefulPages) {
          try {
            const document = await prisma.document.upsert({
              where: { source: page.url },
              update: {
                content: page.content,
                knowledgeBaseId: knowledgeBase.id,
                metadata: { ...page.metadata, title: page.title, url: page.url },
              },
              create: {
                knowledgeBaseId: knowledgeBase.id,
                source: page.url,
                content: page.content,
                metadata: { ...page.metadata, title: page.title, url: page.url },
              },
            });

            await embedAndStore({
              documentId: document.id,
              content: page.content,
              metadata: {
                chatbotId,
                knowledgeBaseId: knowledgeBase.id,
                source: page.url,
                title: page.title,
                type: 'url',
              },
              chatbotId,
              knowledgeBaseId: knowledgeBase.id,
            });

            stored++;
            send({ type: 'storing', current: stored, total: usefulPages.length });
          } catch { /* continue with remaining pages */ }
        }

        send({
          type: 'done',
          knowledgeBaseId: knowledgeBase.id,
          pagesScraped: usefulPages.length,
          pagesSkipped: skipped,
          pagesFailed,
        });
      } catch (error) {
        if (knowledgeBaseId) {
          await prisma.knowledgeBase.delete({ where: { id: knowledgeBaseId } }).catch(() => {});
        }
        send({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
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
