import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouterParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouterParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: chatbotId } = await context.params;
    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get('knowledgeBaseId');

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: 'knowledgeBaseId required' }, { status: 400 });
    }

    // Verify ownership
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        workspace: { members: { some: { userId: session.user.id } } },
      },
    });
    if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch KB with full document content
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, chatbotId },
      include: {
        documents: {
          select: {
            id: true,
            source: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });

    // Build export payload
    const exportData = {
      version: '1.0',
      format: 'prabisha-kb',
      name: kb.name,
      type: kb.type,
      autoUpdate: kb.autoUpdate,
      exportedAt: new Date().toISOString(),
      chatbotName: chatbot.name,
      stats: {
        documentCount: kb.documents.length,
        totalWords: kb.documents.reduce((sum, doc) => {
          const wc = (doc.metadata as any)?.wordCount ?? 0;
          return sum + (typeof wc === 'number' ? wc : 0);
        }, 0),
      },
      documents: kb.documents.map(doc => ({
        source: doc.source,
        content: doc.content,
        metadata: doc.metadata,
      })),
    };

    const fileName = `${kb.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_kb_export.json`;
    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': Buffer.byteLength(json, 'utf8').toString(),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
