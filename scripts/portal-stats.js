// Portal stats script — workspaces, users, stale data
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://n8n:vdkjvzxckjsdhfkzxncsd@cloud.prabisha.com:5432/prabisha_chatbot_builder?schema=public',
  connectionTimeoutMillis: 15000,
  ssl: false,
});

const STALE_DAYS = 30; // consider stale if no activity for 30+ days

async function run() {
  const client = await pool.connect();
  try {
    // ── 1. Total workspaces ───────────────────────────────────────
    const { rows: [{ total_workspaces }] } = await client.query(
      `SELECT COUNT(*) AS total_workspaces FROM "Workspace"`
    );

    // ── 2. Total users ───────────────────────────────────────────
    const { rows: [{ total_users }] } = await client.query(
      `SELECT COUNT(*) AS total_users FROM "User"`
    );

    // ── 3. Workspaces with zero chatbots ─────────────────────────
    const { rows: [{ empty_workspaces }] } = await client.query(
      `SELECT COUNT(*) AS empty_workspaces
       FROM "Workspace" w
       WHERE NOT EXISTS (
         SELECT 1 FROM "Chatbot" c WHERE c."workspaceId" = w.id
       )`
    );

    // ── 4. Stale workspaces: created > 30 days ago AND last conversation
    //        across all chatbots is also > 30 days ago (or no conversations) ──
    const { rows: [{ stale_workspaces }] } = await client.query(
      `SELECT COUNT(DISTINCT w.id) AS stale_workspaces
       FROM "Workspace" w
       WHERE w."createdAt" < NOW() - INTERVAL '${STALE_DAYS} days'
         AND NOT EXISTS (
           SELECT 1
           FROM "Conversation" conv
           JOIN "Chatbot" c ON conv."chatbotId" = c.id
           WHERE c."workspaceId" = w.id
             AND conv."createdAt" > NOW() - INTERVAL '${STALE_DAYS} days'
         )`
    );

    // ── 5. Stale users: not a member of any workspace ────────────
    const { rows: [{ users_no_workspace }] } = await client.query(
      `SELECT COUNT(*) AS users_no_workspace
       FROM "User" u
       WHERE NOT EXISTS (
         SELECT 1 FROM "WorkspaceMember" wm WHERE wm."userId" = u.id
       )`
    );

    // ── 6. Per-workspace breakdown ───────────────────────────────
    const { rows: workspaceDetails } = await client.query(
      `SELECT
         w.id,
         w.name,
         w."createdAt",
         COUNT(DISTINCT wm.id) AS member_count,
         COUNT(DISTINCT c.id)  AS chatbot_count,
         MAX(conv."createdAt") AS last_conversation,
         CASE
           WHEN w."createdAt" > NOW() - INTERVAL '${STALE_DAYS} days' THEN 'new'
           WHEN MAX(conv."createdAt") > NOW() - INTERVAL '${STALE_DAYS} days' THEN 'active'
           ELSE 'stale'
         END AS status
       FROM "Workspace" w
       LEFT JOIN "WorkspaceMember" wm ON wm."workspaceId" = w.id
       LEFT JOIN "Chatbot" c ON c."workspaceId" = w.id
       LEFT JOIN "Conversation" conv ON conv."chatbotId" = c.id
       GROUP BY w.id, w.name, w."createdAt"
       ORDER BY w."createdAt" DESC`
    );

    // ── 7. User breakdown ────────────────────────────────────────
    const { rows: userDetails } = await client.query(
      `SELECT
         u.id,
         u.email,
         u.name,
         u."createdAt",
         COUNT(DISTINCT wm."workspaceId") AS workspace_count
       FROM "User" u
       LEFT JOIN "WorkspaceMember" wm ON wm."userId" = u.id
       GROUP BY u.id, u.email, u.name, u."createdAt"
       ORDER BY u."createdAt" DESC`
    );

    // ── Print results ────────────────────────────────────────────
    console.log('\n========================================');
    console.log('         PORTAL STATS REPORT');
    console.log('========================================');
    console.log(`Total Workspaces  : ${total_workspaces}`);
    console.log(`Total Users       : ${total_users}`);
    console.log(`Empty Workspaces  : ${empty_workspaces}  (0 chatbots)`);
    console.log(`Stale Workspaces  : ${stale_workspaces}  (no activity in ${STALE_DAYS}d)`);
    console.log(`Users w/o workspace: ${users_no_workspace}`);
    console.log('----------------------------------------');

    console.log('\n📋 WORKSPACE DETAILS\n');
    console.log(
      'Name'.padEnd(30) +
      'Status'.padEnd(10) +
      'Members'.padEnd(10) +
      'Chatbots'.padEnd(10) +
      'Last Conv'.padEnd(25) +
      'Created'
    );
    console.log('-'.repeat(100));
    for (const w of workspaceDetails) {
      const lastConv = w.last_conversation
        ? new Date(w.last_conversation).toLocaleDateString()
        : 'never';
      console.log(
        w.name.slice(0, 29).padEnd(30) +
        w.status.padEnd(10) +
        String(w.member_count).padEnd(10) +
        String(w.chatbot_count).padEnd(10) +
        lastConv.padEnd(25) +
        new Date(w.createdAt).toLocaleDateString()
      );
    }

    console.log('\n👤 USER DETAILS\n');
    console.log('Email'.padEnd(40) + 'Name'.padEnd(25) + 'Workspaces'.padEnd(12) + 'Joined');
    console.log('-'.repeat(90));
    for (const u of userDetails) {
      console.log(
        (u.email || '—').slice(0, 39).padEnd(40) +
        (u.name || '—').slice(0, 24).padEnd(25) +
        String(u.workspace_count).padEnd(12) +
        new Date(u.createdAt).toLocaleDateString()
      );
    }

    console.log('\n========================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
