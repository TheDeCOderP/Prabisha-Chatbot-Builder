import { searchSimilar } from '../src/lib/langchain/vector-store';
import { prisma } from '../src/lib/prisma';

const CHATBOT_ID = 'cmmufc6bw0007lstxrqwix6oo';

const testQueries = [
  'What is AI Nexus World?',
  'How can I contact you?',
  'What are the top AI companies?',
  'Tell me about the platform features',
  'privacy policy',
];

async function main() {
  console.log(`\n🔍 Testing KB retrieval for chatbot: ${CHATBOT_ID}\n`);
  console.log('='.repeat(60));

  // Check vector count
  const vectorCount = await prisma.documentVector.count({ where: { chatbotId: CHATBOT_ID } });
  console.log(`Total vector chunks in DB: ${vectorCount}\n`);

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('-'.repeat(50));

    const results = await searchSimilar({
      query,
      chatbotId: CHATBOT_ID,
      limit: 3,
      threshold: 0.3,
    });

    if (results.length === 0) {
      console.log('  ❌ No results found (score below threshold)');
    } else {
      results.forEach((r, i) => {
        const source = (r.metadata as any)?.source || 'unknown';
        const preview = r.content.substring(0, 120).replace(/\n/g, ' ');
        console.log(`  ${i + 1}. Score: ${(r.score * 100).toFixed(1)}% | Source: ${source}`);
        console.log(`     "${preview}..."`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete');
}

main().catch(console.error).finally(() => prisma.$disconnect());
