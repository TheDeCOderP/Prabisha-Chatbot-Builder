// scripts/migrate-embeddings.ts
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/langchain/vector-store";

async function migrateEmbeddings() {
  console.log("🚀 Starting migration to 3072 dimensions...");

  try {
    // 1. Fetch all documents that need re-embedding
    const documents = await prisma.document.findMany({
      include: {
        knowledgeBase: true,
      },
    });

    console.log(`found ${documents.length} documents to process.`);

    for (const doc of documents) {
      console.log(`📦 Processing Document: ${doc.source}`);

      // 2. Split content into chunks (using your existing chunking logic)
      const chunks = chunkText(doc.content, 1000);
      
      // 3. Delete OLD 768-dimension vectors for this specific document
      await prisma.documentVector.deleteMany({
        where: { documentId: doc.id },
      });

      // 4. Generate new 3072 embeddings and save
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i]);

        // Use Raw SQL to insert the 3072 vector
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
            ${doc.id},
            ${doc.knowledgeBaseId},
            ${doc.knowledgeBase.chatbotId},
            ${i},
            ${chunks[i]},
            ${`[${embedding.join(",")}]`}::vector(3072),
            ${JSON.stringify(doc.metadata)}::jsonb,
            NOW()
          )
        `;
        
        // Small sleep to prevent rate limiting (Gemini Free/Pay-as-you-go limits)
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      console.log(`✅ Successfully re-embedded: ${doc.source} (${chunks.length} chunks)`);
    }

    console.log("✨ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

// Helper: Standard chunking logic (match your existing implementation)
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

migrateEmbeddings();