// Phase C2 smoke test: audit engine.
//
// Strategy:
//   - Pure checks are tested with fixture HTML strings (fast, offline).
//   - runChecksForUrl + runAudit are tested against a local HTTP server
//     spun up with node:http on a random port. That exercises fetchPage,
//     the full 5-check pipeline, and the DB writes in one shot without
//     relying on any external site.
//
// Cleanup: deletes every audit_runs + audit_reports row it creates in
// a finally block, then closes the server and prisma client.

import { readFileSync } from 'node:fs';
import http from 'node:http';

// --- Load env (same pattern as test-audit-runs.mjs) -------------------
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');
const {
  ENGINE_VERSION,
  runChecks,
  runChecksForUrl,
  runAudit,
  seoCheck,
  a11yCheck,
  rtlCheck,
  securityHeadersCheck,
  perfLiteCheck,
} = await import('../src/lib/audit/index.ts');

let passed = 0;
let failed = 0;
const createdRunIds = [];
const createdReportIds = [];

function assert(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✔ ${label}`);
  } else {
    failed++;
    console.log(`  ✘ ${label}`);
    if (detail !== undefined) console.log(`      ${detail}`);
  }
}

function section(name) {
  console.log(`\n▶ ${name}`);
}

// --- Fixture HTML pages ------------------------------------------------
const GOOD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Little Sprouts Nursery — Dubai Marina</title>
  <meta name="description" content="Little Sprouts Nursery is a bilingual Arabic/English early-years centre serving families in Dubai Marina. Ages 6 months to 4 years.">
  <link rel="canonical" href="https://example.test/">
  <meta property="og:title" content="Little Sprouts Nursery">
  <meta property="og:image" content="https://example.test/og.jpg">
</head>
<body>
  <h1>Little Sprouts Nursery</h1>
  <img src="/hero.jpg" alt="Children playing in the garden">
  <p>We welcome families from across Dubai.</p>
</body>
</html>`;

const BAD_HTML = `<html>
<body>
<img src="/a.jpg">
<img src="/b.jpg">
<button></button>
<p>Some content.</p>
</body></html>`;

const ARABIC_NO_RTL_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>حضانة — Dubai Bilingual Nursery</title>
  <meta name="description" content="Bilingual nursery in Dubai serving ages 2 through 4 years old with full-day care and Arabic lessons.">
</head>
<body>
  <h1>مرحبا بكم في الحضانة</h1>
  <img src="/a.jpg" alt="kids">
</body>
</html>`;

function fakePage(overrides = {}) {
  return {
    targetUrl: 'http://test/',
    finalUrl: 'http://test/',
    status: 200,
    httpsOk: false,
    headers: {},
    html: '',
    bytes: 0,
    ttfbMs: 100,
    totalMs: 200,
    contentType: 'text/html',
    ...overrides,
  };
}

// --- Local HTTP server for live runAudit test -------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  res.end(GOOD_HTML);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  // ===================================================================
  section('1. engine version constant');
  assert('ENGINE_VERSION is "c2.v1"', ENGINE_VERSION === 'c2.v1', `got ${ENGINE_VERSION}`);

  // ===================================================================
  section('2. seoCheck on a clean page');
  {
    const r = seoCheck({ targetUrl: 'http://t/', page: fakePage({ html: GOOD_HTML }) });
    assert('score is 100', r.score === 100, `got ${r.score}`);
    assert('no issues', r.issues.length === 0);
    assert('raw.title extracted', typeof r.raw?.title === 'string' && r.raw.title.length > 0);
  }

  // ===================================================================
  section('3. seoCheck on a bad page');
  {
    const r = seoCheck({ targetUrl: 'http://t/', page: fakePage({ html: BAD_HTML }) });
    assert('score < 100', r.score < 100, `got ${r.score}`);
    const titles = r.issues.map((i) => i.title);
    assert('flags missing <title>', titles.some((t) => t.includes('<title>')));
    assert('flags missing meta description',
      titles.some((t) => t.toLowerCase().includes('meta description')));
    assert('flags missing <h1>', titles.some((t) => t.includes('<h1>')));
  }

  // ===================================================================
  section('4. a11yCheck on a bad page');
  {
    const r = a11yCheck({ targetUrl: 'http://t/', page: fakePage({ html: BAD_HTML }) });
    const titles = r.issues.map((i) => i.title);
    assert('flags missing lang attribute',
      titles.some((t) => t.toLowerCase().includes('lang attribute')));
    assert('flags images missing alt',
      titles.some((t) => t.toLowerCase().includes('missing alt')));
    assert('flags empty button',
      titles.some((t) => t.toLowerCase().includes('empty <button>')));
    assert('score < 100', r.score < 100);
  }

  // ===================================================================
  section('5. a11yCheck on the clean page');
  {
    const r = a11yCheck({ targetUrl: 'http://t/', page: fakePage({ html: GOOD_HTML }) });
    assert('no a11y issues on good HTML', r.issues.length === 0, JSON.stringify(r.issues));
    assert('score is 100', r.score === 100);
  }

  // ===================================================================
  section('6. rtlCheck detects Arabic without dir="rtl"');
  {
    const r = rtlCheck({ targetUrl: 'http://t/', page: fakePage({ html: ARABIC_NO_RTL_HTML }) });
    const titles = r.issues.map((i) => i.title);
    assert('flags Arabic without dir="rtl"',
      titles.some((t) => t.toLowerCase().includes('dir="rtl"')));
    assert('flags Arabic without lang="ar"',
      titles.some((t) => t.toLowerCase().includes('lang="ar"')));
    assert('raw.hasArabic is true', r.raw?.hasArabic === true);
  }

  // ===================================================================
  section('7. rtlCheck recommends Arabic on English-only page');
  {
    const r = rtlCheck({ targetUrl: 'http://t/', page: fakePage({ html: GOOD_HTML }) });
    assert('no rtl issues on English page', r.issues.length === 0);
    assert('recommends adding Arabic version', r.recommendations.length > 0);
  }

  // ===================================================================
  section('8. securityHeadersCheck flags missing headers');
  {
    const r = securityHeadersCheck({
      targetUrl: 'http://t/',
      page: fakePage({ httpsOk: false, headers: {} }),
    });
    assert('score < 100', r.score < 100);
    const titles = r.issues.map((i) => i.title);
    assert('flags non-HTTPS', titles.some((t) => t.toLowerCase().includes('https')));
    assert('flags missing HSTS',
      titles.some((t) => t.toLowerCase().includes('strict-transport-security')));
    assert('flags missing CSP',
      titles.some((t) => t.toLowerCase().includes('content-security-policy')));
  }

  // ===================================================================
  section('9. securityHeadersCheck clean on hardened page');
  {
    const r = securityHeadersCheck({
      targetUrl: 'https://t/',
      page: fakePage({
        httpsOk: true,
        headers: {
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'strict-origin-when-cross-origin',
          'permissions-policy': 'geolocation=()',
        },
      }),
    });
    assert('hardened site scores 100', r.score === 100, `got ${r.score}`);
  }

  // ===================================================================
  section('10. perfLiteCheck flags slow TTFB + no compression');
  {
    const r = perfLiteCheck({
      targetUrl: 'http://t/',
      page: fakePage({ ttfbMs: 3000, totalMs: 3200, bytes: 1024, headers: {} }),
    });
    const titles = r.issues.map((i) => i.title);
    assert('flags slow TTFB',
      titles.some((t) => t.toLowerCase().includes('time-to-first-byte')));
    assert('flags no compression',
      titles.some((t) => t.toLowerCase().includes('not compressed')));
  }

  // ===================================================================
  section('11. runChecks aggregates 5 categories + max severity');
  {
    const { aggregated } = runChecks(fakePage({ html: BAD_HTML, headers: {} }));
    assert('overallScore in [0,100]',
      aggregated.overallScore >= 0 && aggregated.overallScore <= 100,
      `got ${aggregated.overallScore}`);
    assert('maxSeverity is at least high',
      ['high', 'critical'].includes(aggregated.maxSeverity),
      `got ${aggregated.maxSeverity}`);
    assert('issues span multiple categories',
      new Set(aggregated.issues.map((i) => i.category)).size >= 3);
    assert('rawData.scores has all 5 categories',
      ['seo', 'a11y', 'perf', 'rtl', 'security'].every(
        (k) => k in aggregated.rawData.scores,
      ));
  }

  // ===================================================================
  section('12. runChecksForUrl against local server');
  {
    const { page, aggregated } = await runChecksForUrl(baseUrl);
    assert('status 200', page.status === 200);
    assert('got HTML body', page.html.length > 0);
    assert('overallScore > 0', aggregated.overallScore > 0);
  }

  // ===================================================================
  section('13. runAudit success path (end-to-end with DB)');
  {
    const result = await runAudit(baseUrl, {
      triggerSource: 'smoke-test',
      triggeredBy: 'system',
    });
    createdRunIds.push(result.runId);
    if (result.reportId) createdReportIds.push(result.reportId);

    assert('status=completed', result.status === 'completed', result.error);
    assert('reportId set', typeof result.reportId === 'string');
    assert('durationMs > 0', (result.durationMs ?? 0) > 0);

    const run = await prisma.auditRun.findUnique({
      where: { id: result.runId },
      include: { report: true },
    });
    assert('run row exists', run !== null);
    assert('run.status is completed', run?.status === 'completed');
    assert('run.startedAt set', run?.startedAt instanceof Date);
    assert('run.finishedAt set', run?.finishedAt instanceof Date);
    assert('run.reportId linked', run?.reportId === result.reportId);
    assert('report relation resolves', run?.report?.overallScore !== null && run?.report?.overallScore !== undefined);
    assert('run.engineVersion = c2.v1', run?.engineVersion === ENGINE_VERSION);
    assert('report.title contains hostname',
      run?.report?.title?.includes('127.0.0.1') === true);
  }

  // ===================================================================
  section('14. runAudit failure path (unreachable target)');
  {
    // Port 1 is reserved — the connection will be refused synchronously.
    const result = await runAudit('http://127.0.0.1:1/does-not-exist', {
      triggerSource: 'smoke-test',
    });
    createdRunIds.push(result.runId);

    assert('status=failed', result.status === 'failed');
    assert('reportId is null', result.reportId === null);
    assert('error message set', !!result.error);

    const run = await prisma.auditRun.findUnique({ where: { id: result.runId } });
    assert('run row marked failed', run?.status === 'failed');
    assert('errorMessage persisted', !!run?.errorMessage);
    assert('reportId null on failure', run?.reportId === null);
    assert('finishedAt set on failure', run?.finishedAt instanceof Date);
  }
} catch (err) {
  console.error('\n✘ unexpected throw:', err);
  failed++;
} finally {
  console.log('\n▶ cleanup');
  if (createdRunIds.length) {
    await prisma.auditRun.deleteMany({ where: { id: { in: createdRunIds } } });
    console.log(`  deleted ${createdRunIds.length} audit_runs rows`);
  }
  if (createdReportIds.length) {
    await prisma.auditReport.deleteMany({ where: { id: { in: createdReportIds } } });
    console.log(`  deleted ${createdReportIds.length} audit_reports rows`);
  }
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
