import { prisma } from '../src/lib/prisma';

const CHATBOT_ID = 'cmmufc6bw0007lstxrqwix6oo';

async function main() {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: CHATBOT_ID },
    include: {
      knowledgeBases: {
        include: {
          documents: {
            select: { id: true, source: true, createdAt: true, content: true }
          }
        }
      }
    }
  });

  if (!chatbot) { console.log('Chatbot not found'); return; }

  console.log(`\n🤖 Chatbot: ${chatbot.name} (${chatbot.id})`);
  console.log(`   Model: ${chatbot.model || 'default'}`);
  console.log(`   Knowledge Bases: ${chatbot.knowledgeBases.length}`);

  let totalChars = 0;
  let totalDocs = 0;

  for (const kb of chatbot.knowledgeBases) {
    console.log(`\n📚 KB: "${kb.name}" (${kb.id})`);
    console.log(`   Documents: ${kb.documents.length}`);
    for (const doc of kb.documents) {
      const chars = doc.content?.length ?? 0;
      totalChars += chars;
      totalDocs++;
      console.log(`   - ${doc.source} — ${(chars / 1024).toFixed(1)} KB`);
    }
  }

  // Vector chunks
  const vectorCount = await prisma.documentVector.count({ where: { chatbotId: CHATBOT_ID } });
  const vectorContentSize = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COALESCE(SUM(LENGTH(content)), 0) as total FROM "DocumentVector" WHERE "chatbotId" = $1`,
    CHATBOT_ID
  );

  const vectorChars = Number(vectorContentSize[0]?.total ?? 0);

  console.log(`\n📊 Summary:`);
  console.log(`   Total documents : ${totalDocs}`);
  console.log(`   Raw content size: ${(totalChars / 1024).toFixed(1)} KB (${totalChars.toLocaleString()} chars)`);
  console.log(`   Vector chunks   : ${vectorCount}`);
  console.log(`   Vector content  : ${(vectorChars / 1024).toFixed(1)} KB (${vectorChars.toLocaleString()} chars)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
