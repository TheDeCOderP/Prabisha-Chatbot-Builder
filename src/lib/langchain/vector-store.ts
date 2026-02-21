// lib/langchain/vector-store.ts
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { prisma } from "@/lib/prisma";
import { TaskType } from "@google/generative-ai";

// Enable vector extension in your database
export async function enableVectorExtension() {
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('PostgreSQL vector extension enabled');
  } catch (error) {
    console.error('Error enabling vector extension:', error);
  }
}

interface EmbedAndStoreParams {
  documentId: string;
  content: string;
  metadata: Record<string, any>;
  chatbotId: string;
  knowledgeBaseId: string;
}

export async function embedAndStore({
  documentId,
  content,
  metadata,
  chatbotId,
  knowledgeBaseId,
}: EmbedAndStoreParams) {
  try {
    // Split content into chunks
    const chunks = chunkText(content, 1000);
    
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    
    // Generate embeddings for all chunks
    const embeddingsPromises = chunks.map(chunk => generateEmbedding(chunk));
    const embeddings = await Promise.all(embeddingsPromises);
    
    console.log(`Storing ${chunks.length} chunks in PostgreSQL...`);
    
    // Store using raw SQL (required for vector type with Prisma)
    let storedCount = 0;
    
    for (let idx = 0; idx < chunks.length; idx++) {
      const metadataObj = {
        ...metadata,
        chatbotId,
        knowledgeBaseId,
        documentId,
        chunkIndex: idx,
      };
      
      try {
        // Use raw SQL to insert with vector type
        await prisma.$executeRaw`
          INSERT INTO "DocumentVector" (
            "id",
            "documentId",
            "knowledgeBaseId",
            "chatbotId",
            "chunkIndex",
            "content",
            "embedding",
            "metadata",
            "createdAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${documentId},
            ${knowledgeBaseId},
            ${chatbotId},
            ${idx},
            ${chunks[idx]},
            ${`[${embeddings[idx].join(',')}]`}::vector(3072), -- Change 768 to 3072 here
            ${JSON.stringify(metadataObj)}::jsonb,
            NOW()
          )
          ON CONFLICT ("documentId", "chunkIndex")
          DO UPDATE SET
            "content" = EXCLUDED."content",
            "embedding" = EXCLUDED."embedding",
            "metadata" = EXCLUDED."metadata",
            "createdAt" = NOW()
        `;
        storedCount++;
      } catch (error) {
        console.error(`Error storing chunk ${idx}:`, error);
        throw error;
      }
    }
    
    console.log(`Successfully stored ${storedCount} chunks in PostgreSQL`);
    
    return {
      documentId,
      chunksStored: storedCount,
    };
  } catch (error) {
    console.error('Error storing data in PostgreSQL:', error);
    throw new Error('Failed to store data');
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey: process.env.GEMINI_API_KEY!,
      model: "gemini-embedding-001",
    });

    const embedding = await embeddings.embedQuery(text);
    console.log('Generated Gemini embedding with length:', embedding.length);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

interface SearchParams {
  query: string;
  chatbotId: string;
  knowledgeBaseId?: string;
  limit?: number;
  filters?: Record<string, any>;
  threshold?: number;
}

export async function searchSimilar({
  query,
  chatbotId,
  knowledgeBaseId,
  limit = 5, // Reduced for speed
  threshold = 0.5,
}: SearchParams) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // Use parameterized queries for performance and security
    // We search by distance directly to utilize the HNSW/IVFFlat index effectively
    // Inside searchSimilar function
    const results = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        "id", "content", "metadata",
        1 - (embedding <=> $1::vector(3072)) as similarity -- Update here
      FROM "DocumentVector"
      WHERE "chatbotId" = $2
      ${knowledgeBaseId ? 'AND "knowledgeBaseId" = $3' : ''}
      ORDER BY embedding <=> $1::vector(3072) -- And here
      LIMIT $4
    `, vectorString, chatbotId, ...(knowledgeBaseId ? [knowledgeBaseId] : []), limit);

    return results
      .filter(r => r.similarity >= threshold)
      .map(r => ({ ...r, score: r.similarity }));
  } catch (error) {
    console.error('Vector search failed, falling back...', error);
    return [];
  }
}

async function fallbackTextSearch({
  query,
  chatbotId,
  knowledgeBaseId,
  limit = 5,
  filters = {},
}: Omit<SearchParams, 'threshold'>) {
  try {
    const whereClause: any = {
      chatbotId: chatbotId,
      ...(knowledgeBaseId && { knowledgeBaseId: knowledgeBaseId }),
      content: {
        contains: query,
        mode: 'insensitive',
      },
    };
    
    // Simple text search as fallback (using Prisma)
    const results = await prisma.documentVector.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    
    return results.map(result => ({
      id: result.id,
      documentId: result.documentId,
      knowledgeBaseId: result.knowledgeBaseId,
      chatbotId: result.chatbotId,
      chunkIndex: result.chunkIndex,
      content: result.content,
      metadata: result.metadata as Record<string, any>,
      score: 0.8, // Default score for fallback
    }));
  } catch (error) {
    console.error('Error in fallbackTextSearch:', error);
    return [];
  }
}

function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  // Split by sentences first
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed max chunk size and we already have content
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  // Add the last chunk if it exists
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // If no chunks were created (e.g., text is empty), return empty array
  return chunks.length > 0 ? chunks : [];
}

// Delete all vectors for a specific chatbot
export async function deleteChatbotKnowledge(chatbotId: string) {
  try {
    const result = await prisma.documentVector.deleteMany({
      where: { chatbotId }
    });
    
    console.log(`Deleted ${result.count} vectors for chatbot ${chatbotId}`);
    
    return {
      deletedCount: result.count,
    };
  } catch (error) {
    console.error('Error deleting chatbot knowledge:', error);
    throw new Error('Failed to delete chatbot knowledge');
  }
}

// Delete vectors for a specific knowledge base
export async function deleteKnowledgeBase(knowledgeBaseId: string) {
  try {
    const result = await prisma.documentVector.deleteMany({
      where: { knowledgeBaseId }
    });
    
    console.log(`Deleted ${result.count} vectors for knowledge base ${knowledgeBaseId}`);
    
    return {
      deletedCount: result.count,
    };
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    throw new Error('Failed to delete knowledge base');
  }
}

// Delete vectors for a specific document
export async function deleteDocument(documentId: string) {
  try {
    const result = await prisma.documentVector.deleteMany({
      where: { documentId }
    });
    
    console.log(`Deleted ${result.count} vectors for document ${documentId}`);
    
    return {
      deletedCount: result.count,
    };
  } catch (error) {
    console.error('Error deleting document vectors:', error);
    throw new Error('Failed to delete document vectors');
  }
}

// Get statistics about stored knowledge
export async function getKnowledgeStats(chatbotId: string) {
  try {
    // Use raw query to get stats
    const statsByKB = await prisma.$queryRaw<Array<{
      knowledgeBaseId: string;
      totalChunks: number;
      uniqueDocuments: number;
    }>>`
      SELECT 
        "knowledgeBaseId",
        COUNT(*) as "totalChunks",
        COUNT(DISTINCT "documentId") as "uniqueDocuments"
      FROM "DocumentVector"
      WHERE "chatbotId" = ${chatbotId}
      GROUP BY "knowledgeBaseId"
    `;

    const totalStats = await prisma.$queryRaw<Array<{
      totalChunks: number;
      totalDocuments: number;
      totalKnowledgeBases: number;
    }>>`
      SELECT 
        COUNT(*) as "totalChunks",
        COUNT(DISTINCT "documentId") as "totalDocuments",
        COUNT(DISTINCT "knowledgeBaseId") as "totalKnowledgeBases"
      FROM "DocumentVector"
      WHERE "chatbotId" = ${chatbotId}
    `;

    return {
      byKnowledgeBase: statsByKB.map(stat => ({
        knowledgeBaseId: stat.knowledgeBaseId,
        totalChunks: Number(stat.totalChunks),
        uniqueDocumentsCount: Number(stat.uniqueDocuments),
      })),
      total: {
        totalChunks: Number(totalStats[0]?.totalChunks || 0),
        totalDocuments: Number(totalStats[0]?.totalDocuments || 0),
        totalKnowledgeBases: Number(totalStats[0]?.totalKnowledgeBases || 0),
      },
    };
  } catch (error) {
    console.error('Error getting knowledge stats:', error);
    return {
      byKnowledgeBase: [],
      total: {
        totalChunks: 0,
        totalDocuments: 0,
        totalKnowledgeBases: 0,
      },
    };
  }
}

// Test the vector search connection
export async function testVectorSearchConnection() {
  try {
    // Enable vector extension
    await enableVectorExtension();
    
    // Create vector index for faster similarity search
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_documentvector_embedding ON "DocumentVector" 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `;
    
    // Try a simple query to test
    const testDoc = await prisma.documentVector.findFirst();
    
    return {
      connected: true,
      tableExists: true,
      indexesCreated: true,
      hasData: !!testDoc,
      message: 'PostgreSQL vector search connection successful',
    };
  } catch (error) {
    console.error('PostgreSQL vector search connection test failed:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'PostgreSQL vector search connection test failed',
    };
  }
}

// Create indexes for better performance
export async function createVectorIndexes() {
  try {
    console.log('Creating vector search indexes...');
    
    // Drop existing index if it exists
    await prisma.$executeRaw`DROP INDEX IF EXISTS idx_documentvector_embedding`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS idx_documentvector_embedding_hnsw`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS idx_documentvector_embedding_ivfflat`;
    
    // Try to create HNSW index (requires pgvector 0.5.0+)
    try {
      await prisma.$executeRaw`
        CREATE INDEX idx_documentvector_embedding_hnsw ON "DocumentVector" 
        USING hnsw (embedding vector_cosine_ops)
      `;
      console.log('HNSW vector index created successfully');
    } catch (error) {
      console.log('HNSW not available, creating IVFFlat index...');
      
      // Fallback to IVFFlat
      await prisma.$executeRaw`
        CREATE INDEX idx_documentvector_embedding_ivfflat ON "DocumentVector" 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `;
      console.log('IVFFlat vector index created successfully');
    }
  } catch (error) {
    console.error('Error creating vector indexes:', error);
  }
}

// Batch processing for large documents
export async function embedAndStoreBatch(
  documents: EmbedAndStoreParams[],
  batchSize: number = 10
) {
  const results = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(documents.length / batchSize)}`);
    
    const batchResults = await Promise.all(
      batch.map(doc => embedAndStore(doc))
    );
    
    results.push(...batchResults);
    
    // Small delay to avoid rate limiting
    if (i + batchSize < documents.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Update document vectors (delete old and create new)
export async function updateDocumentVectors(params: EmbedAndStoreParams) {
  try {
    // Delete existing vectors for this document
    await deleteDocument(params.documentId);
    
    // Create new vectors
    const result = await embedAndStore(params);
    
    return result;
  } catch (error) {
    console.error('Error updating document vectors:', error);
    throw new Error('Failed to update document vectors');
  }
}