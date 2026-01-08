// app/api/chatbot/[chatbotId]/knowledge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

import { embedAndStore } from '@/lib/langchain/vector-store';
import { processURL } from '@/lib/langchain/knowledge/web-scraper';
import { processFile, processTable } from '@/lib/langchain/knowledge/processor';

interface RouterParams {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: chatbotId } = await context.params;

    // Verify user has access to this chatbot
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle JSON body for webpage scraping
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { type, url, crawlSubpages, name } = body;

      if (type !== 'webpage') {
        return NextResponse.json({ error: 'Invalid type for JSON request' }, { status: 400 });
      }

      if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }

      // Create knowledge base
      const knowledgeBase = await prisma.knowledgeBase.create({
        data: {
          chatbotId,
          name: name || `Webpage - ${new Date().toLocaleDateString()}`,
          type: 'PAGE',
          indexName: `kb_${chatbotId}_${Date.now()}`,
        },
      });

      try {
        console.log(`Starting scraping: ${url} (crawl: ${crawlSubpages})`);
        
        // Process URL with crawling option
        const { content, metadata, pages } = await processURL(url, crawlSubpages, 50);
        console.log(`Finished scraping: ${url} (crawl: ${crawlSubpages})`);

        if (pages && pages.length > 0) {
          // Store each page as a separate document
          const documentPromises = pages.map(async (page) => {
            const document = await prisma.document.create({
              data: {
                knowledgeBaseId: knowledgeBase.id,
                source: page.url,
                content: page.content,
                metadata: {
                  ...page.metadata,
                  title: page.title,
                  url: page.url,
                },
              },
            });

            // Embed and store
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

            return {
              success: true,
              url: page.url,
              title: page.title,
              documentId: document.id,
            };
          });

          const results = await Promise.allSettled(documentPromises);
          
          const successResults = results
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<any>).value);
          
          const errorResults = results
            .filter(r => r.status === 'rejected')
            .map(r => ({
              success: false,
              error: (r as PromiseRejectedResult).reason?.message || 'Unknown error',
            }));

          return NextResponse.json({
            knowledgeBaseId: knowledgeBase.id,
            pagesScraped: pages.length,
            results: [...successResults, ...errorResults],
            metadata: {
              totalPages: pages.length,
              totalWords: metadata.totalWordCount,
              crawled: crawlSubpages,
            },
          });
        } else {
          // Single page
          const document = await prisma.document.create({
            data: {
              knowledgeBaseId: knowledgeBase.id,
              source: url,
              content,
              metadata,
            },
          });

          await embedAndStore({
            documentId: document.id,
            content,
            metadata: {
              chatbotId,
              knowledgeBaseId: knowledgeBase.id,
              source: url,
              type: 'url',
            },
            chatbotId,
            knowledgeBaseId: knowledgeBase.id,
          });

          return NextResponse.json({
            knowledgeBaseId: knowledgeBase.id,
            documentId: document.id,
            success: true,
            url,
          });
        }
      } catch (error) {
        // Delete the knowledge base if scraping failed
        await prisma.knowledgeBase.delete({
          where: { id: knowledgeBase.id },
        });

        throw error;
      }
    }

    // Handle FormData for file uploads
    const formData = await request.formData();
    const type = formData.get('type') as string;
    const name = formData.get('name') as string;

    if (type === 'file') {
      const files = formData.getAll('files') as File[];
      
      if (files.length === 0) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 });
      }

      const knowledgeBase = await prisma.knowledgeBase.create({
        data: {
          chatbotId,
          name: name || `Files - ${new Date().toLocaleDateString()}`,
          type: 'DOC',
          indexName: `kb_${chatbotId}_${Date.now()}`,
        },
      });

      const results = [];

      for (const file of files) {
        try {
          const { content, metadata } = await processFile(file);

          const document = await prisma.document.create({
            data: {
              knowledgeBaseId: knowledgeBase.id,
              source: file.name,
              content,
              metadata: {
                ...metadata,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
              },
            },
          });

          await embedAndStore({
            documentId: document.id,
            content,
            metadata: {
              chatbotId,
              knowledgeBaseId: knowledgeBase.id,
              source: file.name,
            },
            chatbotId,
            knowledgeBaseId: knowledgeBase.id,
          });

          results.push({
            success: true,
            fileName: file.name,
            documentId: document.id,
          });
        } catch (error) {
          results.push({
            success: false,
            fileName: file.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({
        knowledgeBaseId: knowledgeBase.id,
        results,
      });
    } else if (type === 'table') {
      const files = formData.getAll('files') as File[];
      
      if (files.length === 0) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 });
      }

      const knowledgeBase = await prisma.knowledgeBase.create({
        data: {
          chatbotId,
          name: name || `Tables - ${new Date().toLocaleDateString()}`,
          type: 'FAQ',
          indexName: `kb_${chatbotId}_${Date.now()}`,
        },
      });

      const results = [];

      for (const file of files) {
        try {
          const { rows, metadata } = await processTable(file);

          const chunks = chunkArray(rows, 100);

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const content = formatTableContent(chunk, metadata);

            const document = await prisma.document.create({
              data: {
                knowledgeBaseId: knowledgeBase.id,
                source: `${file.name} (batch ${i + 1})`,
                content,
                metadata: {
                  ...metadata,
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                  batchNumber: i + 1,
                  totalBatches: chunks.length,
                  rowCount: chunk.length,
                },
              },
            });

            await embedAndStore({
              documentId: document.id,
              content,
              metadata: {
                chatbotId,
                knowledgeBaseId: knowledgeBase.id,
                source: file.name,
                type: 'table',
              },
              chatbotId,
              knowledgeBaseId: knowledgeBase.id,
            });
          }

          results.push({
            success: true,
            fileName: file.name,
            rowCount: rows.length,
            batches: chunks.length,
          });
        } catch (error) {
          results.push({
            success: false,
            fileName: file.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({
        knowledgeBaseId: knowledgeBase.id,
        results,
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error processing knowledge:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function formatTableContent(rows: any[], metadata: any): string {
  if (rows.length === 0) return '';
  
  const headers = Object.keys(rows[0]);
  let content = `Table: ${metadata.tableName || 'Data'}\n\n`;
  content += `Columns: ${headers.join(', ')}\n\n`;
  
  rows.forEach((row, idx) => {
    content += `Row ${idx + 1}:\n`;
    headers.forEach(header => {
      content += `  ${header}: ${row[header]}\n`;
    });
    content += '\n';
  });
  
  return content;
}