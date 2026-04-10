// One-off seed: creates the `admin` role (if missing) + first admin user.
// Idempotent — safe to re-run. Password is hashed with bcryptjs (cost 12).
//
// Usage: node scripts/seed-admin-user.mjs

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/DATABASE_URL="([^"]+)"/)[1];
const sql = neon(url);

const ADMIN_EMAIL = 'admin@yalladj.com';
const ADMIN_NAME = 'Admin';
const ADMIN_PASSWORD = 'Yalla@media123';

// Full-access permissions for the Admin role. Phase B3 will formalize this
// matrix; for now Admin can do everything.
const ADMIN_PERMISSIONS = {
  leads: ['read', 'write', 'delete'],
  nurseries: ['read', 'write', 'delete'],
  projects: ['read', 'write', 'delete'],
  tickets: ['read', 'write', 'delete'],
  serviceContracts: ['read', 'write', 'delete'],
  handovers: ['read', 'write', 'delete'],
  deliverables: ['read', 'write', 'delete', 'approve'],
  contentBlocks: ['read', 'write', 'delete'],
  siteTemplates: ['read', 'write', 'delete'],
  files: ['read', 'write', 'delete'],
  settings: ['read', 'write', 'delete'],
  users: ['read', 'write', 'delete', 'invite'],
  auditLogs: ['read'],
};

// 1. Upsert admin role
const existingRole = await sql`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`;
let roleId;
if (existingRole.length > 0) {
  roleId = existingRole[0].id;
  console.log(`admin role already exists: ${roleId}`);
} else {
  roleId = randomUUID();
  await sql`
    INSERT INTO roles (id, name, label, permissions, is_system, created_at, updated_at)
    VALUES (
      ${roleId},
      'admin',
      ${{ en: 'Administrator', ar: 'المسؤول' }},
      ${ADMIN_PERMISSIONS},
      true,
      NOW(),
      NOW()
    )
  `;
  console.log(`created admin role: ${roleId}`);
}

// 2. Upsert admin user (by email)
const existingUser = await sql`SELECT id FROM users WHERE email = ${ADMIN_EMAIL} LIMIT 1`;
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

if (existingUser.length > 0) {
  // Refresh the password + ensure active, so a re-run recovers a forgotten password.
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash},
        name = ${ADMIN_NAME},
        role_id = ${roleId},
        is_active = true,
        deleted_at = NULL,
        updated_at = NOW()
    WHERE email = ${ADMIN_EMAIL}
  `;
  console.log(`updated admin user: ${existingUser[0].id} (${ADMIN_EMAIL})`);
} else {
  const userId = randomUUID();
  await sql`
    INSERT INTO users (
      id, email, password_hash, name, role_id,
      is_active, created_at, updated_at
    )
    VALUES (
      ${userId},
      ${ADMIN_EMAIL},
      ${passwordHash},
      ${ADMIN_NAME},
      ${roleId},
      true,
      NOW(),
      NOW()
    )
  `;
  console.log(`created admin user: ${userId} (${ADMIN_EMAIL})`);
}

// 3. Sanity read
const check = await sql`
  SELECT u.id, u.email, u.name, u.is_active, r.name as role_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.email = ${ADMIN_EMAIL}
`;
console.log('verify:', check[0]);
