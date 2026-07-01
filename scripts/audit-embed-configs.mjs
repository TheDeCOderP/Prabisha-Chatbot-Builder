/**
 * audit-embed-configs.mjs
 * ------------------------------------------------------------------
 * READ-ONLY (by default) audit of every chatbot's embed/greeting/teaser
 * configuration. Surfaces the settings that cause the client-reported
 * "how may I help you / Not now bubble aata rehta hai" noise.
 *
 * Runs directly on the pg Pool (the same driver the Prisma pg adapter
 * wraps in src/lib/prisma.ts) so it needs no compiled Prisma client.
 *
 *   node scripts/audit-embed-configs.mjs          # report only (safe)
 *   node scripts/audit-embed-configs.mjs --fix    # apply the safe fixes
 *
 * The --fix pass ONLY turns voiceGreeting OFF where the widget also
 * auto-opens (the "speaks a greeting on every load" case). It never
 * touches colours, KB, models, greeting text, or anything else.
 * ------------------------------------------------------------------ */
import 'dotenv/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const APPLY = process.argv.includes('--fix');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GENERIC_GREETING_RE = /how (may|can) i (help|assist) you/i;

async function main() {
  console.log(`\n🔎 Embed config audit  ${APPLY ? '(APPLY / --fix mode)' : '(read-only)'}\n`);

  const { rows } = await pool.query(`
    SELECT c.id,
           c.name,
           c."isPublished",
           c.popup_onload                         AS cb_popup,
           array_length(c.greeting, 1)            AS greeting_len,
           (c.greeting[1])::jsonb ->> 'en'        AS greeting_en,
           t.id                                   AS theme_id,
           t."embedMode",
           t.popup_onload                         AS th_popup,
           t."voiceGreeting",
           t."teaserEnabled",
           t."teaserDelay",
           t."notificationSound"
    FROM "Chatbot" c
    LEFT JOIN "ChatbotTheme" t ON t."chatbotId" = c.id
    ORDER BY c."createdAt" ASC
  `);

  console.log(`Found ${rows.length} chatbots.\n`);

  const flagged = [];
  let noGreeting = 0, genericGreeting = 0, autoOpenSpeak = 0, teaserAndPopup = 0, lowTeaserDelay = 0;

  for (const r of rows) {
    const popup = r.th_popup ?? r.cb_popup;
    const gText = r.greeting_en || '';
    const issues = [];

    if (r.voiceGreeting && popup) {
      issues.push('voiceGreeting + popup_onload → speaks greeting on every page load');
      autoOpenSpeak++;
    }
    if (r.embedMode !== 'INLINE' && r.teaserEnabled && popup) {
      issues.push('teaserEnabled + popup_onload → teaser bubble AND auto-open both fire');
      teaserAndPopup++;
    }
    if (r.teaserEnabled && (r.teaserDelay ?? 3) <= 1) {
      issues.push(`teaserDelay=${r.teaserDelay}s → bubble pops almost immediately`);
      lowTeaserDelay++;
    }
    if (gText && GENERIC_GREETING_RE.test(gText)) {
      issues.push(`greeting text is generic: "${gText.slice(0, 60)}"`);
      genericGreeting++;
    }
    if (!gText && (r.greeting_len ?? 0) === 0) { issues.push('no greeting configured'); noGreeting++; }

    if (issues.length) flagged.push({ r, gText, issues });
  }

  for (const f of flagged) {
    const r = f.r;
    console.log(`── ${r.name}  (${r.id})`);
    console.log(`   published:${r.isPublished}  embedMode:${r.embedMode ?? 'n/a'}  ` +
      `popup_onload:${r.th_popup ?? r.cb_popup}  voiceGreeting:${r.voiceGreeting ?? false}  ` +
      `teaserEnabled:${r.teaserEnabled ?? 'n/a'}  teaserDelay:${r.teaserDelay ?? 'n/a'}`);
    for (const i of f.issues) console.log(`     ⚠️  ${i}`);
    console.log('');
  }

  console.log('──────── SUMMARY ────────');
  console.log(`  Total chatbots            : ${rows.length}`);
  console.log(`  Flagged                   : ${flagged.length}`);
  console.log(`  voiceGreeting + auto-open : ${autoOpenSpeak}`);
  console.log(`  teaser + auto-open        : ${teaserAndPopup}`);
  console.log(`  teaserDelay <= 1s         : ${lowTeaserDelay}`);
  console.log(`  generic "how may I help"  : ${genericGreeting}`);
  console.log(`  no greeting configured    : ${noGreeting}`);

  if (APPLY) {
    console.log('\n🛠  Applying SAFE fixes (voiceGreeting → false where it also auto-opens)...');
    let fixed = 0;
    for (const f of flagged) {
      const r = f.r;
      const popup = r.th_popup ?? r.cb_popup;
      if (r.voiceGreeting && popup && r.theme_id) {
        await pool.query('UPDATE "ChatbotTheme" SET "voiceGreeting" = false, "updatedAt" = now() WHERE id = $1', [r.theme_id]);
        console.log(`   ✔ ${r.name}: voiceGreeting → false`);
        fixed++;
      }
    }
    console.log(`\n✅ Applied ${fixed} fix(es).`);
  } else {
    console.log('\nℹ️  Read-only. Re-run with --fix to apply the safe greeting fixes.');
  }
}

main()
  .catch((e) => { console.error('❌ audit failed:', e.message); process.exitCode = 1; })
  .finally(async () => { await pool.end().catch(() => {}); });
