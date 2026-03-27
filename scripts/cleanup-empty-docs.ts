import { prisma } from '../src/lib/prisma';

async function main() {
  // Find documents with empty or very short content (< 50 chars = basically nothing)
  const emptyDocs = await prisma.document.findMany({
    where: {
      OR: [
        { content: '' },
        { content: { equals: '' } },
      ]
    },
    select: { id: true, source: true, content: true }
  });

  // Also find docs with very little content via raw query
  const thinDocs = await prisma.$queryRawUnsafe<{ id: string; source: string; content: string }[]>(
    `SELECT id, source, content FROM "Document" WHERE LENGTH(content) < 50`
  );

  const allIds = [...new Set(thinDocs.map(d => d.id))];

  console.log(`Found ${allIds.length} empty/thin documents to remove`);
  thinDocs.forEach(d => console.log(`  - [${d.content.length} chars] ${d.source}`));

  if (allIds.length === 0) {
    console.log('No empty documents found.');
  } else {
    // Delete vectors first (FK constraint)
    const deletedVectors = await prisma.documentVector.deleteMany({
      where: { documentId: { in: allIds } }
    });
    console.log(`\nDeleted ${deletedVectors.count} vector chunks`);

    const deletedDocs = await prisma.document.deleteMany({
      where: { id: { in: allIds } }
    });
    console.log(`Deleted ${deletedDocs.count} documents`);
  }

  // Always clean up empty KBs regardless
  const emptyKBs = await prisma.knowledgeBase.findMany({
    where: { documents: { none: {} } },
    select: { id: true, name: true }
  });

  if (emptyKBs.length > 0) {
    console.log(`\nFound ${emptyKBs.length} now-empty knowledge bases:`);
    emptyKBs.forEach(kb => console.log(`  - ${kb.name} (${kb.id})`));
    await prisma.knowledgeBase.deleteMany({ where: { id: { in: emptyKBs.map(k => k.id) } } });
    console.log(`Deleted ${emptyKBs.length} empty knowledge bases`);
  }

  console.log('\n✅ Cleanup complete');
}

main().catch(console.error).finally(() => prisma.$disconnect());
