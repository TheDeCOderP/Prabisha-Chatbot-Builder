import { prisma } from '../src/lib/prisma';

async function main() {
  const chatbot = await prisma.chatbot.findFirst({
    where: { name: { contains: 'Mira', mode: 'insensitive' } },
    include: { knowledgeBases: { select: { id: true, name: true } } }
  });

  if (!chatbot) { console.log('❌ Mira not found'); return; }

  console.log('Chatbot:', chatbot.name, '| ID:', chatbot.id);

  const kbIds = chatbot.knowledgeBases.map(kb => kb.id);

  // Find all thin/useless documents
  const allDocs = await prisma.document.findMany({
    where: { knowledgeBaseId: { in: kbIds } },
    select: { id: true, source: true, content: true, knowledgeBaseId: true }
  });

  const THIN_THRESHOLD = 80; // words
  const USELESS_PATTERNS = [
    'no destinations found',
    'sign in to manage your account',
    'welcome back',
    '0 destinations',
    'no posts found',
    'check back soon',
  ];

  const toDelete: string[] = [];
  const toKeep: any[] = [];

  for (const doc of allDocs) {
    const words = doc.content ? doc.content.trim().split(/\s+/).length : 0;
    const contentLower = (doc.content || '').toLowerCase();
    const isUseless = USELESS_PATTERNS.some(p => contentLower.includes(p));
    const isThin = words < THIN_THRESHOLD;

    if (isUseless || isThin) {
      toDelete.push(doc.id);
      console.log(`🗑️  DELETE [${words}w] ${(doc.source || '').substring(0, 70)}`);
    } else {
      toKeep.push(doc);
    }
  }

  console.log(`\nTo delete: ${toDelete.length} | To keep: ${toKeep.length}`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  // Delete vectors first
  const vectorsDeleted = await prisma.documentVector.deleteMany({
    where: { documentId: { in: toDelete } }
  });
  console.log(`\n✅ Deleted ${vectorsDeleted.count} vectors`);

  // Delete documents
  const docsDeleted = await prisma.document.deleteMany({
    where: { id: { in: toDelete } }
  });
  console.log(`✅ Deleted ${docsDeleted.count} documents`);

  // Clear question cache for this chatbot
  const cacheDeleted = await prisma.questionCache.deleteMany({
    where: { chatbotId: chatbot.id }
  });
  console.log(`✅ Cleared ${cacheDeleted.count} cached responses`);

  // Final stats
  const remaining = await prisma.documentVector.count({
    where: { chatbotId: chatbot.id }
  });
  console.log(`\n📊 Remaining vectors: ${remaining}`);
  console.log('Done! KB is now cleaner — re-run check-mira.ts to verify.');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
