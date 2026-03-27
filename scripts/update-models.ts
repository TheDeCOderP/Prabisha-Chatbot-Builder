// scripts/update-models.ts
// Updates all old Gemini model names in the Chatbot table to gemini-2.5-flash

import { prisma } from "@/lib/prisma";

const OLD_MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-2.0-flash-lite"];
const NEW_MODEL = "gemini-2.5-flash";

async function updateModels() {
  console.log("🚀 Starting model update...\n");

  // Check current state
  const all = await prisma.chatbot.findMany({ select: { id: true, name: true, model: true } });
  console.log(`Total chatbots: ${all.length}`);

  const toUpdate = all.filter(c => OLD_MODELS.includes(c.model));
  const alreadyNew = all.filter(c => c.model === NEW_MODEL);

  console.log(`Already on ${NEW_MODEL}: ${alreadyNew.length}`);
  console.log(`Need update: ${toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log("\n✅ All chatbots already on latest model.");
    return;
  }

  console.log("\nChatbots to update:");
  toUpdate.forEach(c => console.log(`  - ${c.name} (${c.model})`));

  // Update all old models to gemini-2.5-flash
  const result = await prisma.chatbot.updateMany({
    where: { model: { in: OLD_MODELS } },
    data: { model: NEW_MODEL },
  });

  console.log(`\n✅ Updated ${result.count} chatbot(s) to ${NEW_MODEL}`);
}

updateModels()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
