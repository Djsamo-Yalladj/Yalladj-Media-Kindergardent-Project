import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/DATABASE_URL="([^"]+)"/)[1];
const sql = neon(url);

await sql`CREATE INDEX IF NOT EXISTS ai_learnings_embedding_hnsw_idx ON ai_learnings USING hnsw (embedding vector_cosine_ops)`;

const idx = await sql`SELECT indexname FROM pg_indexes WHERE tablename='ai_learnings' AND indexname='ai_learnings_embedding_hnsw_idx'`;
console.log('HNSW index:', idx.length ? 'OK' : 'MISSING');
