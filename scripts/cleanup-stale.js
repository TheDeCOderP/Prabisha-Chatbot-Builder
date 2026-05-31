// Cleanup script: keep only Prabisha's Workspace, delete everything else
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://n8n:vdkjvzxckjsdhfkzxncsd@cloud.prabisha.com:5432/prabisha_chatbot_builder?schema=public',
  connectionTimeoutMillis: 15000,
  ssl: false,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Find Prabisha's Workspace ─────────────────────────────
    const { rows: prabishaRows } = await client.query(
      `SELECT id, name FROM "Workspace" WHERE name ILIKE '%Prabisha%' LIMIT 1`
    );
    if (!prabishaRows.length) {
      throw new Error("Could not find Prabisha's Workspace — aborting.");
    }
    const prabishaWsId = prabishaRows[0].id;
    console.log(`\n✅ Keeping workspace: "${prabishaRows[0].name}" (${prabishaWsId})`);

    // ── 2. Get users who are members of Prabisha's Workspace ─────
    const { rows: keepUserRows } = await client.query(
      `SELECT DISTINCT u.id, u.email, u.name
       FROM "User" u
       JOIN "WorkspaceMember" wm ON wm."userId" = u.id
       WHERE wm."workspaceId" = $1`,
      [prabishaWsId]
    );
    const keepUserIds = keepUserRows.map(r => r.id);
    console.log(`\n✅ Keeping ${keepUserIds.length} users (members of Prabisha's Workspace):`);
    keepUserRows.forEach(u => console.log(`   - ${u.email} (${u.name || 'no name'})`));

    // ── 3. Find workspaces to delete ─────────────────────────────
    const { rows: deleteWsRows } = await client.query(
      `SELECT id, name FROM "Workspace" WHERE id != $1`,
      [prabishaWsId]
    );
    const deleteWsIds = deleteWsRows.map(r => r.id);
    console.log(`\n🗑️  Deleting ${deleteWsIds.length} workspaces:`);
    deleteWsRows.forEach(w => console.log(`   - ${w.name} (${w.id})`));

    // ── 4. Find users to delete ───────────────────────────────────
    // Users not in Prabisha's Workspace member list
    const { rows: deleteUserRows } = await client.query(
      `SELECT id, email, name FROM "User" WHERE id != ALL($1::text[])`,
      [keepUserIds]
    );
    const deleteUserIds = deleteUserRows.map(r => r.id);
    console.log(`\n🗑️  Deleting ${deleteUserIds.length} users:`);
    deleteUserRows.forEach(u => console.log(`   - ${u.email} (${u.name || 'no name'})`));

    if (deleteWsIds.length === 0 && deleteUserIds.length === 0) {
      console.log('\nNothing to delete.');
      await client.query('ROLLBACK');
      return;
    }

    // ── 5a. Delete chatbots in stale workspaces first (no cascade from Workspace->Chatbot)
    //         Chatbot children (conversations, leads, themes, etc.) DO cascade from Chatbot ──
    if (deleteWsIds.length > 0) {
      const { rowCount: botsDeleted } = await client.query(
        `DELETE FROM "Chatbot" WHERE "workspaceId" = ANY($1::text[])`,
        [deleteWsIds]
      );
      console.log(`\n✅ Deleted ${botsDeleted} chatbot(s) and their cascaded data`);
    }

    // ── 5b. Delete stale workspaces (cascade handles members, invitations) ─
    if (deleteWsIds.length > 0) {
      const { rowCount: wsDeleted } = await client.query(
        `DELETE FROM "Workspace" WHERE id = ANY($1::text[])`,
        [deleteWsIds]
      );
      console.log(`✅ Deleted ${wsDeleted} workspace(s)`);
    }

    // ── 6. Delete stale users ─────────────────────────────────────
    if (deleteUserIds.length > 0) {
      const { rowCount: usersDeleted } = await client.query(
        `DELETE FROM "User" WHERE id = ANY($1::text[])`,
        [deleteUserIds]
      );
      console.log(`✅ Deleted ${usersDeleted} user(s)`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Cleanup complete. Database committed successfully.\n');

    // ── 7. Final verification ─────────────────────────────────────
    const { rows: [{ total_workspaces }] } = await client.query(`SELECT COUNT(*) AS total_workspaces FROM "Workspace"`);
    const { rows: [{ total_users }] } = await client.query(`SELECT COUNT(*) AS total_users FROM "User"`);
    console.log(`Final state: ${total_workspaces} workspace(s), ${total_users} user(s)`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error — transaction rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
