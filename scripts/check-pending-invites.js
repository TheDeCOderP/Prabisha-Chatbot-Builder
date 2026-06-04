// check-pending-invites.js - plain Node.js script using pg directly
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== Checking WorkspaceInvitation records ===\n');

  // Counts by status
  const statusRes = await client.query(`
    SELECT status, COUNT(*) as count
    FROM "WorkspaceInvitation"
    GROUP BY status
    ORDER BY status
  `);

  console.log('--- Counts by status ---');
  for (const row of statusRes.rows) {
    console.log(`  ${row.status}: ${row.count}`);
  }

  // Pending invitations detail (use lowercase aliases to be safe)
  const pendingRes = await client.query(`
    SELECT 
      wi.id,
      wi.token,
      wi.email,
      wi.role,
      wi.status,
      wi."createdAt" as created_at,
      wi."expiresAt" as expires_at,
      w.id as workspace_id,
      w.name as workspace_name,
      ub.id as invited_by_id,
      ub.name as invited_by_name,
      ub.email as invited_by_email,
      ut.id as invited_to_id,
      ut.name as invited_to_name,
      ut.email as invited_to_email
    FROM "WorkspaceInvitation" wi
    LEFT JOIN "Workspace" w ON wi."workspaceId" = w.id
    LEFT JOIN "User" ub ON wi."invitedById" = ub.id
    LEFT JOIN "User" ut ON wi."invitedToId" = ut.id
    WHERE wi.status = 'PENDING'
    ORDER BY wi."createdAt" DESC
  `);

  const now = new Date();

  console.log(`\n--- Pending Invitations (${pendingRes.rows.length}) ---`);
  if (pendingRes.rows.length === 0) {
    console.log('  No pending invitations found.');
  } else {
    for (const row of pendingRes.rows) {
      const expired = row.expires_at ? new Date(row.expires_at) < now : false;
      console.log(`
  ID:         ${row.id}
  Token:      ${row.token}
  Email:      ${row.email ?? '(none)'}
  Role:       ${row.role}
  Workspace:  ${row.workspace_name ?? 'N/A'} (${row.workspace_id ?? 'N/A'})
  Invited By: ${row.invited_by_name ?? 'N/A'} <${row.invited_by_email ?? 'N/A'}>
  Invited To: ${row.invited_to_name ?? '(not linked to user)'} ${row.invited_to_email ? '<' + row.invited_to_email + '>' : ''}
  Created:    ${row.created_at ? new Date(row.created_at).toISOString() : 'N/A'}
  Expires:    ${row.expires_at ? new Date(row.expires_at).toISOString() : 'N/A'} ${expired ? '*** EXPIRED ***' : '(valid)'}
  ---`);
    }
  }

  // Check the specific invite from the URL
  const specificId = 'cmpzad7vs00x7mvbxpb1zmduk';
  console.log(`\n--- Looking up specific invite: ${specificId} ---`);
  const specificRes = await client.query(`
    SELECT 
      wi.id,
      wi.token,
      wi.email,
      wi.role,
      wi.status,
      wi."createdAt" as created_at,
      wi."expiresAt" as expires_at,
      w.name as workspace_name,
      ub.name as invited_by_name,
      ub.email as invited_by_email,
      ut.name as invited_to_name,
      ut.email as invited_to_email
    FROM "WorkspaceInvitation" wi
    LEFT JOIN "Workspace" w ON wi."workspaceId" = w.id
    LEFT JOIN "User" ub ON wi."invitedById" = ub.id
    LEFT JOIN "User" ut ON wi."invitedToId" = ut.id
    WHERE wi.id = $1
  `, [specificId]);

  if (specificRes.rows.length === 0) {
    console.log('  *** NOT FOUND in database! The invite ID does not exist. ***');
  } else {
    const row = specificRes.rows[0];
    const expired = row.expires_at ? new Date(row.expires_at) < now : false;
    const tokenMatch = row.token === '751d169528a761400ac7b491c055ae929d22a4c3386a4a91a89e526a52bc0aff';
    console.log(`
  ID:          ${row.id}
  Token:       ${row.token}
  Token Match: ${tokenMatch ? 'YES ✓' : 'NO ✗ (token mismatch - URL may be invalid)'}
  Status:      ${row.status}
  Email:       ${row.email ?? '(none)'}
  Role:        ${row.role}
  Workspace:   ${row.workspace_name ?? 'N/A'}
  Invited By:  ${row.invited_by_name ?? 'N/A'} <${row.invited_by_email ?? 'N/A'}>
  Invited To:  ${row.invited_to_name ?? '(not linked)'} ${row.invited_to_email ? '<' + row.invited_to_email + '>' : ''}
  Created:     ${row.created_at ? new Date(row.created_at).toISOString() : 'N/A'}
  Expires:     ${row.expires_at ? new Date(row.expires_at).toISOString() : 'N/A'} ${expired ? '*** EXPIRED ***' : '(valid)'}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
