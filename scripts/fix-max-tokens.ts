import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // Check current state
  const chatbots = await prisma.chatbot.findMany({
    select: { id: true, name: true, max_tokens: true, temperature: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n📋 Current chatbot settings:');
  console.table(chatbots.map(c => ({
    id: c.id,
    name: c.name,
    max_tokens: c.max_tokens,
    temperature: c.temperature,
  })));

  // Update max_tokens < 2048
  const lowTokens = chatbots.filter(c => c.max_tokens < 2048);
  if (lowTokens.length > 0) {
    console.log(`\n⚠️  Updating ${lowTokens.length} chatbot(s) with max_tokens < 2048`);
    const r1 = await prisma.chatbot.updateMany({
      where: { max_tokens: { lt: 2048 } },
      data: { max_tokens: 2048 },
    });
    console.log(`✅ Updated ${r1.count} chatbot(s) → max_tokens = 2048`);
  } else {
    console.log('\n✅ All chatbots already have max_tokens >= 2048');
  }

  // Update temperature < 0.7 (too deterministic / robotic)
  const lowTemp = chatbots.filter(c => c.temperature < 0.7);
  if (lowTemp.length > 0) {
    console.log(`\n⚠️  Updating ${lowTemp.length} chatbot(s) with temperature < 0.7`);
    const r2 = await prisma.chatbot.updateMany({
      where: { temperature: { lt: 0.7 } },
      data: { temperature: 0.9 },
    });
    console.log(`✅ Updated ${r2.count} chatbot(s) → temperature = 0.9`);
  } else {
    console.log('✅ All chatbots already have temperature >= 0.7');
  }

  // Final state
  const final = await prisma.chatbot.findMany({
    select: { id: true, name: true, max_tokens: true, temperature: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n📋 Final state:');
  console.table(final.map(c => ({
    name: c.name,
    max_tokens: c.max_tokens,
    temperature: c.temperature,
  })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
