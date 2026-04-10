// Invokes the api/health.ts handler directly with a mocked req/res pair.
// Proves the endpoint compiles and talks to Neon correctly without needing
// the Vercel CLI. `vercel dev` would just add a network layer on top.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { default: handler } = await import('../api/health.ts');

const req = { method: 'GET', headers: {}, query: {}, body: undefined };

let status = 0;
let payload = null;
const res = {
  status(code) {
    status = code;
    return this;
  },
  json(body) {
    payload = body;
    return this;
  },
};

console.log('Invoking api/health.ts...');
await handler(req, res);

console.log(`status: ${status}`);
console.log('payload:', JSON.stringify(payload, null, 2));

if (status !== 200 || !payload?.ok) {
  console.error('FAIL');
  process.exit(1);
}
console.log('OK');
