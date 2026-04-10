// Page fetcher for the audit engine.
//
// Deliberately uses the native global `fetch` (Node 20+) — no cheerio,
// playwright, or other deps. The engine is HTML-level only ("perf-lite"),
// so we never evaluate JavaScript or measure paint metrics. What we DO
// measure: status, final URL after redirects, response headers, body
// bytes, and coarse TTFB / total wall-time.
//
// Errors are NOT thrown. A failed fetch returns a FetchedPage with
// status=0 and an `error` string set; individual checks inspect
// page.status and short-circuit when the page never loaded so that a
// network failure degrades gracefully into a single SEO "page did not
// load" critical issue rather than crashing the whole run.

import type { FetchedPage } from './types.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = 'YalladjAuditBot/1.0 (+https://yalladj.com/audit)';

export interface FetchOptions {
  timeoutMs?: number;
  userAgent?: string;
}

export async function fetchPage(
  targetUrl: string,
  opts: FetchOptions = {},
): Promise<FetchedPage> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();
  let ttfbMs = 0;

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': opts.userAgent ?? DEFAULT_USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en, ar;q=0.9',
      },
    });
    // TTFB-ish: time until headers arrived. Not a true TTFB (fetch
    // resolves on headers, not on the first byte of the wire), but
    // close enough for a lite check.
    ttfbMs = Date.now() - startedAt;

    const buf = await res.arrayBuffer();
    const totalMs = Date.now() - startedAt;

    // UTF-8 is a safe default for modern web. Sites that serve another
    // encoding will still decode without throwing — mojibake only
    // matters if a check parses non-ASCII, and the Arabic-detection
    // regex in rtl.ts works on the byte points either way.
    const html = new TextDecoder('utf-8').decode(buf);

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const finalUrl = res.url || targetUrl;

    return {
      targetUrl,
      finalUrl,
      status: res.status,
      httpsOk: finalUrl.startsWith('https://'),
      headers,
      html,
      bytes: buf.byteLength,
      ttfbMs,
      totalMs,
      contentType: headers['content-type'] ?? null,
    };
  } catch (err) {
    const totalMs = Date.now() - startedAt;
    return {
      targetUrl,
      finalUrl: targetUrl,
      status: 0,
      httpsOk: targetUrl.startsWith('https://'),
      headers: {},
      html: '',
      bytes: 0,
      ttfbMs,
      totalMs,
      contentType: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
