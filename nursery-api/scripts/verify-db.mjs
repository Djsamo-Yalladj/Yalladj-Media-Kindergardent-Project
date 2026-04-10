import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/DATABASE_URL="([^"]+)"/)[1];
const sql = neon(url);

const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
const ext = await sql`SELECT extname FROM pg_extension WHERE extname='vector'`;

console.log('vector extension:', ext.length ? 'OK' : 'MISSING');
console.log('tables:', tables.length);
console.log(tables.map(t => t.table_name).join(', '));
