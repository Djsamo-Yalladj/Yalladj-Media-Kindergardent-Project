// Local dev server shim (A3.9). Bridges Node http → Vercel-shaped req/res
// so admin.html can talk to the real nursery-api handlers over HTTP without
// needing `vercel dev` / CLI login. Scope: settings routes only for now.
// Run: node --import tsx scripts/dev-server.mjs

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env into process.env (same pattern the smoke tests use).
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { default: settingsListCreate } = await import('../api/settings/index.ts');
const { default: settingsById } = await import('../api/settings/[id].ts');
const { default: authLogin } = await import('../api/auth/login.ts');
const { default: authLogout } = await import('../api/auth/logout.ts');
const { default: authMe } = await import('../api/auth/me.ts');

const PORT = Number(process.env.DEV_PORT ?? 4000);

// Static root = KinderGardent-V1/ (parent of nursery-api/). Serves login.html,
// admin.html, js/, css/, images/, etc. so the frontend and API share an origin
// and the session cookie round-trips without CORS/credentials headaches.
const STATIC_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
};

// Resolve a URL path to a file under STATIC_ROOT. Returns null if outside or
// missing. Blocks access to nursery-api/ (server code, .env, secrets).
function resolveStatic(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? '/index.html' : decoded;
  const abs = normalize(join(STATIC_ROOT, rel));
  if (!abs.startsWith(STATIC_ROOT)) return null; // path traversal guard
  if (abs.includes('/nursery-api/') || abs.endsWith('/nursery-api')) return null;
  if (!existsSync(abs)) return null;
  const st = statSync(abs);
  if (!st.isFile()) return null;
  return abs;
}

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
      this._headers[key.toLowerCase()] = val;
      return this;
    },
    getHeader(key) {
      return this._headers[key.toLowerCase()];
    },
    getHeaders() {
      return { ...this._headers };
    },
    removeHeader(key) {
      delete this._headers[key.toLowerCase()];
      return this;
    },
    hasHeader(key) {
      return Object.prototype.hasOwnProperty.call(this._headers, key.toLowerCase());
    },
    appendHeader(key, val) {
      const k = key.toLowerCase();
      const existing = this._headers[k];
      if (existing === undefined) {
        this._headers[k] = val;
      } else if (Array.isArray(existing)) {
        this._headers[k] = [...existing, val];
      } else {
        this._headers[k] = [existing, val];
      }
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
  // /api/auth/*
  if (pathname === '/api/auth/login') {
    return { handler: authLogin, extraQuery: {} };
  }
  if (pathname === '/api/auth/logout') {
    return { handler: authLogout, extraQuery: {} };
  }
  if (pathname === '/api/auth/me') {
    return { handler: authMe, extraQuery: {} };
  }
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
      // Fall back to static file serving for non-/api paths.
      if (!url.pathname.startsWith('/api/')) {
        const filePath = resolveStatic(url.pathname);
        if (filePath) {
          const body = readFileSync(filePath);
          const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
          nodeRes.statusCode = 200;
          nodeRes.setHeader('Content-Type', mime);
          nodeRes.end(body);
          return;
        }
      }
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
  console.log(`[dev-server] api routes: /api/auth/{login,logout,me}, /api/settings, /api/settings/:id`);
  console.log(`[dev-server] static: ${STATIC_ROOT}`);
  console.log(`[dev-server] open: http://localhost:${PORT}/login.html`);
});
