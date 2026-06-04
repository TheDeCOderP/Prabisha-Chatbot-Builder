// check-jiya-invite.js
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  console.log('=== Checking invitations for jiya.prabisha@gmail.com ===\n');

  // All invitations involving this email (as invitedTo user OR email field)
  const res = await client.query(`
    SELECT 
      wi.id,
      wi.email,
      wi.status,
      wi.role,
      wi.token,
      wi."createdAt" as created_at,
      wi."expiresAt" as expires_at,
      w.name as workspace_name,
      ub.name as invited_by_name,
      ub.email as invited_by_email,
      ut.id as invited_to_id,
      ut.name as invited_to_name,
      ut.email as invited_to_email
    FROM "WorkspaceInvitation" wi
    LEFT JOIN "Workspace" w ON wi."workspaceId" = w.id
    LEFT JOIN "User" ub ON wi."invitedById" = ub.id
    LEFT JOIN "User" ut ON wi."invitedToId" = ut.id
    WHERE 
      wi.email ILIKE '%jiya%'
      OR ut.email ILIKE '%jiya%'
    ORDER BY wi."createdAt" DESC
  `);

  const now = new Date();

  if (res.rows.length === 0) {
    console.log('No invitations found for jiya email.\n');
  } else {
    console.log(`Found ${res.rows.length} invitation(s):\n`);
    for (const row of res.rows) {
      const expired = row.expires_at ? new Date(row.expires_at) < now : false;
      console.log(`  ID:          ${row.id}
  Status:      ${row.status}
  Email field: ${row.email ?? '(null)'}
  Role:        ${row.role}
  Workspace:   ${row.workspace_name ?? 'N/A'}
  Invited By:  ${row.invited_by_name ?? 'N/A'} <${row.invited_by_email ?? 'N/A'}>
  Invited To:  ${row.invited_to_name ?? '(not linked)'} ${row.invited_to_email ? '<' + row.invited_to_email + '>' : ''}
  Created:     ${row.created_at ? new Date(row.created_at).toISOString() : 'N/A'}
  Expires:     ${row.expires_at ? new Date(row.expires_at).toISOString() : 'N/A'} ${expired ? '*** EXPIRED ***' : '(valid)'}
  ---`);
    }
  }

  // Also check the User table for this email
  console.log('\n=== Checking User table for jiya ===\n');
  const userRes = await client.query(`
    SELECT id, name, email, "createdAt" as created_at
    FROM "User"
    WHERE email ILIKE '%jiya%'
  `);

  if (userRes.rows.length === 0) {
    console.log('No user found with jiya email — they have no account yet.\n');
  } else {
    for (const row of userRes.rows) {
      console.log(`  ID:      ${row.id}
  Name:    ${row.name ?? '(none)'}
  Email:   ${row.email}
  Created: ${new Date(row.created_at).toISOString()}\n`);
    }
  }

  // Check WorkspaceMember for jiya
  console.log('=== Checking WorkspaceMember for jiya ===\n');
  const memberRes = await client.query(`
    SELECT wm.id, wm.role, wm."workspaceId", w.name as workspace_name, u.email
    FROM "WorkspaceMember" wm
    JOIN "User" u ON wm."userId" = u.id
    JOIN "Workspace" w ON wm."workspaceId" = w.id
    WHERE u.email ILIKE '%jiya%'
  `);

  if (memberRes.rows.length === 0) {
    console.log('Not a member of any workspace.\n');
  } else {
    for (const row of memberRes.rows) {
      console.log(`  Member ID:  ${row.id}
  Role:       ${row.role}
  Workspace:  ${row.workspace_name} (${row.workspaceId})
  Email:      ${row.email}\n`);
    }
  }

  // Now check the API invite route logic — look for UNIQUE constraint
  // Check if there's a unique constraint on (workspaceId, email) or (workspaceId, invitedToId)
  console.log('=== Checking unique constraints on WorkspaceInvitation ===\n');
  const constraintRes = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'WorkspaceInvitation'
  `);
  for (const row of constraintRes.rows) {
    console.log(`  ${row.indexname}: ${row.indexdef}`);
  }

  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
