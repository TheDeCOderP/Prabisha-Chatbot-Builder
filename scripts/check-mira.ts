import { prisma } from '../src/lib/prisma';

async function main() {
  const chatbot = await prisma.chatbot.findFirst({
    where: { name: { contains: 'Mira', mode: 'insensitive' } },
    include: {
      knowledgeBases: {
        include: {
          documents: {
            select: { id: true, source: true, content: true, metadata: true, createdAt: true }
          }
        }
      }
    }
  });

  if (!chatbot) { console.log('❌ Mira not found'); return; }

  console.log('\n========== CHATBOT ==========');
  console.log('ID     :', chatbot.id);
  console.log('Name   :', chatbot.name);
  console.log('Model  :', chatbot.model);
  console.log('Temp   :', chatbot.temperature);
  console.log('Tokens :', chatbot.max_tokens);
  console.log('KBs    :', chatbot.knowledgeBases.length);

  let totalDocs = 0;
  let totalWords = 0;
  let emptyDocs = 0;

  for (const kb of chatbot.knowledgeBases) {
    console.log(`\n----- KB: "${kb.name}" | Type: ${kb.type} -----`);
    console.log('Documents:', kb.documents.length);
    totalDocs += kb.documents.length;

    for (const doc of kb.documents) {
      const words = doc.content ? doc.content.trim().split(/\s+/).length : 0;
      totalWords += words;
      if (!doc.content || words < 10) emptyDocs++;

      const flag = words < 10 ? '⚠️  EMPTY' : words < 100 ? '🟡 THIN' : '✅';
      console.log(`  ${flag} [${words} words] ${(doc.source ?? 'no source').substring(0, 80)}`);
      if (doc.content && words >= 10) {
        console.log(`        Preview: "${doc.content.substring(0, 200).replace(/\n/g, ' ')}"`);
      }
    }
  }

  // Vector chunk stats
  const stats = await prisma.$queryRawUnsafe<any[]>(`
    SELECT kb.name as kb_name,
           COUNT(dv.id) as chunks,
           ROUND(AVG(LENGTH(dv.content))) as avg_chars,
           MIN(LENGTH(dv.content)) as min_chars,
           MAX(LENGTH(dv.content)) as max_chars
    FROM "DocumentVector" dv
    JOIN "KnowledgeBase" kb ON dv."knowledgeBaseId" = kb.id
    WHERE dv."chatbotId" = $1
    GROUP BY kb.name
    ORDER BY chunks DESC
  `, chatbot.id);

  console.log('\n========== VECTOR CHUNKS ==========');
  if (stats.length === 0) {
    console.log('❌ NO VECTORS FOUND — data was never embedded!');
  } else {
    for (const s of stats) {
      console.log(`  KB: "${s.kb_name}"`);
      console.log(`      Chunks: ${s.chunks} | Avg: ${s.avg_chars} chars | Min: ${s.min_chars} | Max: ${s.max_chars}`);
    }
  }

  // Sample 3 chunks
  const sampleChunks = await prisma.$queryRawUnsafe<any[]>(`
    SELECT dv.content, kb.name as kb_name
    FROM "DocumentVector" dv
    JOIN "KnowledgeBase" kb ON dv."knowledgeBaseId" = kb.id
    WHERE dv."chatbotId" = $1
    ORDER BY RANDOM()
    LIMIT 3
  `, chatbot.id);

  console.log('\n========== SAMPLE CHUNKS (random) ==========');
  for (let i = 0; i < sampleChunks.length; i++) {
    const c = sampleChunks[i];
    console.log(`\n[Sample ${i+1}] KB: ${c.kb_name} | ${c.content?.length} chars`);
    console.log(`"${c.content?.substring(0, 400)}"`);
  }

  // Cache count
  const cacheCount = await prisma.questionCache.count({ where: { chatbotId: chatbot.id } });

  console.log('\n========== SUMMARY ==========');
  console.log('Total documents :', totalDocs);
  console.log('Total words     :', totalWords);
  console.log('Empty/thin docs :', emptyDocs);
  console.log('Avg words/doc   :', totalDocs > 0 ? Math.round(totalWords / totalDocs) : 0);
  console.log('Cached questions:', cacheCount);

  if (totalDocs === 0) {
    console.log('\n🔴 CRITICAL: No documents at all!');
  } else if (stats.length === 0) {
    console.log('\n🔴 CRITICAL: Documents exist but NO vectors — embeddings never ran!');
  } else if (emptyDocs > totalDocs * 0.3) {
    console.log('\n🟡 WARNING: Many empty/thin docs — scraping likely failed on many pages');
  } else if (totalWords / totalDocs < 100) {
    console.log('\n🟡 WARNING: Docs are very thin on average');
  } else {
    console.log('\n✅ Data looks healthy');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
