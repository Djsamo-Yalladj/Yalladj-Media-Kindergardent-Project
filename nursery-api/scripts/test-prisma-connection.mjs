// Loads .env, imports the Prisma singleton, and lists contract_types.
// Success = A3.1 verified (Prisma runtime works over Neon HTTP adapter).

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');

console.log('Connecting via Prisma + Neon HTTP adapter...');

const rows = await prisma.contractTypeDef.findMany({
  orderBy: { key: 'asc' },
});

console.log(`contract_types rows: ${rows.length}`);
for (const r of rows) {
  const label = typeof r.label === 'object' ? r.label.en : r.label;
  const price = r.defaultPriceAed ? `AED ${r.defaultPriceAed}` : 'no price';
  console.log(`  - ${r.key}: ${label} (${price}) system=${r.isSystem}`);
}

await prisma.$disconnect();
console.log('OK');
