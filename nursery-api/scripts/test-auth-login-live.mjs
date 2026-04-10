// Live end-to-end test against the real seeded admin user.
// Exercises the login handler and cleans up the created session.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const loginHandler = (await import('../api/auth/login.ts')).default;
const { prisma } = await import('../src/lib/prisma.ts');

const req = {
  method: 'POST',
  query: {},
  body: { email: 'admin@yalladj.com', password: 'Yalla@media123' },
  headers: { 'user-agent': 'live-test/1.0', 'x-forwarded-for': '127.0.0.1' },
};

const res = {
  statusCode: 200,
  headers: {},
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  setHeader(k, v) { this.headers[k] = v; return this; },
  getHeader(k) { return this.headers[k]; },
  json(p) { this.body = p; return this; },
};

await loginHandler(req, res);
console.log('status:', res.statusCode);
console.log('body:', JSON.stringify(res.body, null, 2));
console.log('Set-Cookie:', (res.headers['Set-Cookie'] ?? '').slice(0, 100) + '...');

const token = (res.headers['Set-Cookie'] ?? '').match(/nursery_session=([^;]+)/)?.[1];
if (token) {
  await prisma.$executeRaw`DELETE FROM sessions WHERE token = ${token}`;
  console.log('test session cleaned up');
}
