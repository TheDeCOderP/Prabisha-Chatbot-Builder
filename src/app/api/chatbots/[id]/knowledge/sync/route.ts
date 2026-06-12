import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { scrapePage, closeBrowser } from '@/lib/langchain/knowledge/web-scraper';
import { embedAndStore, deleteDocument } from '@/lib/langchain/vector-store';
import { createHash } from 'crypto';

interface RouterParams {
  params: Promise<{ id: string }>;
}

function hashContent(content: string): string {
  return createHash('md5').update(content.trim()).digest('hex');
}

export async function POST(request: NextRequest, context: RouterParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: chatbotId } = await context.params;
    const { knowledgeBaseId } = await request.json();

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: 'knowledgeBaseId required' }, { status: 400 });
    }

    // Verify ownership
    const kb = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        chatbotId,
        chatbot: { workspace: { members: { some: { userId: session.user.id } } } },
      },
      include: {
        documents: {
          select: { id: true, source: true, content: true, metadata: true },
        },
      },
    });

    if (!kb) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    if (kb.type !== 'PAGE') {
      return NextResponse.json({ error: 'Sync only works for webpage knowledge bases' }, { status: 400 });
    }

    // Only sync documents that are URLs (not file uploads)
    // Check both source field and metadata.url / metadata.source
    const urlDocs = kb.documents.filter(doc => {
      const meta = doc.metadata as Record<string, any> || {};
      const src = doc.source || meta?.url || meta?.source || '';
      return src.startsWith('http://') || src.startsWith('https://');
    });

    console.log(`[sync] KB "${kb.name}" — total docs: ${kb.documents.length}, url docs: ${urlDocs.length}`);
    console.log('[sync] sample sources:', kb.documents.slice(0, 3).map(d => d.source));

    if (urlDocs.length === 0) {
      return NextResponse.json({
        error: 'No URL documents to sync',
        debug: {
          totalDocs: kb.documents.length,
          sampleSources: kb.documents.slice(0, 5).map(d => d.source),
        }
      }, { status: 400 });
    }

    const results = {
      updated: [] as Array<{ url: string; oldWords: number; newWords: number }>,
      unchanged: [] as string[],
      failed: [] as Array<{ url: string; error: string }>,
      totalDocs: urlDocs.length,
    };

    try {
    for (const doc of urlDocs) {
      const meta = doc.metadata as Record<string, any> || {};
      const docUrl = doc.source?.startsWith('http') ? doc.source : (meta?.url || meta?.source || doc.source);

      try {
        const scraped = await scrapePage(docUrl);

        // Skip if too thin
        if (scraped.wordCount < 50) {
          results.failed.push({ url: docUrl, error: `Too thin (${scraped.wordCount} words)` });
          continue;
        }

        const oldHash = hashContent(doc.content || '');
        const newHash = hashContent(scraped.content);

        // No change — skip
        if (oldHash === newHash) {
          results.unchanged.push(docUrl);
          continue;
        }

        // Content changed — update document and re-embed
        const oldWords = (doc.content || '').trim().split(/\s+/).length;
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

        // Delete old vectors and re-embed
        await deleteDocument(doc.id);
        await embedAndStore({
          documentId: doc.id,
          content: scraped.content,
          metadata: {
            chatbotId,
            knowledgeBaseId,
            source: doc.source,
            title: scraped.title,
            type: 'url',
          },
          chatbotId,
          knowledgeBaseId,
        });

        results.updated.push({ url: docUrl, oldWords, newWords });
      } catch (err) {
        results.failed.push({
          url: docUrl,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    } finally {
      await closeBrowser();
    }

    // Clear question cache so stale responses don't get served
    await prisma.questionCache.deleteMany({ where: { chatbotId } });

    return NextResponse.json({
      success: true,
      knowledgeBaseId,
      syncedAt: new Date().toISOString(),
      summary: {
        total: urlDocs.length,
        updated: results.updated.length,
        unchanged: results.unchanged.length,
        failed: results.failed.length,
      },
      details: results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
