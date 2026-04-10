// Local dev server shim (A3.9). Bridges Node http → Vercel-shaped req/res
// so admin.html can talk to the real nursery-api handlers over HTTP without
// needing `vercel dev` / CLI login. Scope: settings routes only for now.
// Run: node --import tsx scripts/dev-server.mjs

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Load .env into process.env (same pattern the smoke tests use).
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { default: settingsListCreate } = await import('../api/settings/index.ts');
const { default: settingsById } = await import('../api/settings/[id].ts');

const PORT = Number(process.env.DEV_PORT ?? 4000);

// Convert a Node IncomingMessage into the shape Vercel handlers expect.
async function toVercelReq(nodeReq, url) {
  const query = Object.fromEntries(url.searchParams);
  let body = undefined;
  if (nodeReq.method !== 'GET' && nodeReq.method !== 'DELETE') {
    const chunks = [];
    for await (const chunk of nodeReq) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
  }
  return {
    method: nodeReq.method,
    url: nodeReq.url,
    headers: nodeReq.headers,
    query,
    body,
    socket: nodeReq.socket,
  };
}

// Build a Vercel-shaped res that writes back to the Node response.
function toVercelRes(nodeRes) {
  const res = {
    statusCode: 200,
    _headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this._headers[key] = val;
      return this;
    },
    json(payload) {
      nodeRes.statusCode = this.statusCode;
      for (const [k, v] of Object.entries(this._headers)) nodeRes.setHeader(k, v);
      nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
      nodeRes.end(JSON.stringify(payload));
      return this;
    },
    end(payload) {
      nodeRes.statusCode = this.statusCode;
      for (const [k, v] of Object.entries(this._headers)) nodeRes.setHeader(k, v);
      nodeRes.end(payload);
      return this;
    },
  };
  return res;
}

function addCors(nodeRes) {
  nodeRes.setHeader('Access-Control-Allow-Origin', '*');
  nodeRes.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  nodeRes.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Route resolver: returns { handler, query } or null.
function resolveRoute(method, pathname) {
  // /api/settings
  if (pathname === '/api/settings') {
    return { handler: settingsListCreate, extraQuery: {} };
  }
  // /api/settings/:id
  const m = pathname.match(/^\/api\/settings\/([^/]+)$/);
  if (m) {
    return { handler: settingsById, extraQuery: { id: m[1] } };
  }
  return null;
}

const server = createServer(async (nodeReq, nodeRes) => {
  try {
    addCors(nodeRes);
    if (nodeReq.method === 'OPTIONS') {
      nodeRes.statusCode = 204;
      nodeRes.end();
      return;
    }

    const url = new URL(nodeReq.url, `http://localhost:${PORT}`);

    // Health check.
    if (url.pathname === '/health') {
      nodeRes.setHeader('Content-Type', 'application/json');
      nodeRes.end(JSON.stringify({ ok: true, service: 'nursery-api dev shim' }));
      return;
    }

    const match = resolveRoute(nodeReq.method, url.pathname);
    if (!match) {
      nodeRes.statusCode = 404;
      nodeRes.setHeader('Content-Type', 'application/json');
      nodeRes.end(JSON.stringify({ ok: false, error: 'not_found', path: url.pathname }));
      return;
    }

    const vercelReq = await toVercelReq(nodeReq, url);
    vercelReq.query = { ...vercelReq.query, ...match.extraQuery };
    const vercelRes = toVercelRes(nodeRes);

    await match.handler(vercelReq, vercelRes);
  } catch (err) {
    console.error('[dev-server] unhandled error:', err);
    if (!nodeRes.headersSent) {
      nodeRes.statusCode = 500;
      nodeRes.setHeader('Content-Type', 'application/json');
      nodeRes.end(
        JSON.stringify({
          ok: false,
          error: 'internal_error',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
});

server.listen(PORT, () => {
  console.log(`[dev-server] listening on http://localhost:${PORT}`);
  console.log(`[dev-server] routes: GET/POST /api/settings, GET/PATCH/DELETE /api/settings/:id`);
});
