// Perf-lite check — coarse performance heuristics from a single fetch.
//
// What this is NOT: a lighthouse run. We don't have a browser, we
// can't measure paint timings, main-thread work, or Core Web Vitals.
//
// What this IS: a set of cheap signals that correlate with a bad
// first impression — slow TTFB, uncompressed responses, bloated HTML,
// and unreasonable script counts. Each of these is a one-to-one
// signal that something is wrong at the hosting / bundling layer,
// even without running the page in a real browser.

import type {
  AuditIssue,
  AuditRecommendation,
  CheckContext,
  CheckResult,
} from '../types.js';
import { scoreFromIssues } from '../score.js';

export function perfLiteCheck(ctx: CheckContext): CheckResult {
  const { html, headers, bytes, ttfbMs, totalMs, status } = ctx.page;
  const issues: AuditIssue[] = [];
  const recommendations: AuditRecommendation[] = [];

  if (!status) {
    return {
      category: 'perf',
      score: 0,
      issues,
      recommendations,
      raw: { skipped: 'page not loaded' },
    };
  }

  // --- TTFB ---
  if (ttfbMs > 2500) {
    issues.push({
      category: 'perf',
      severity: 'high',
      title: `Slow time-to-first-byte (${ttfbMs}ms)`,
      description:
        'TTFB over 2.5s usually indicates a slow backend or far-away origin.',
      fix: 'Move origin closer to users (CDN edge), enable caching, or optimise backend queries.',
    });
  } else if (ttfbMs > 800) {
    issues.push({
      category: 'perf',
      severity: 'medium',
      title: `Elevated time-to-first-byte (${ttfbMs}ms)`,
      description: 'Ideal TTFB is under 800ms.',
      fix: 'Check for cold starts, slow queries, or missing CDN caching.',
    });
  }

  // --- Total wall-time ---
  if (totalMs > 5000) {
    issues.push({
      category: 'perf',
      severity: 'medium',
      title: `Slow total response (${totalMs}ms)`,
      description: 'The initial HTML document took longer than 5 seconds to download.',
      fix: 'Reduce HTML size or improve server throughput.',
    });
  }

  // --- HTML payload size ---
  const kb = Math.round(bytes / 1024);
  if (bytes > 500 * 1024) {
    issues.push({
      category: 'perf',
      severity: 'medium',
      title: `Large HTML payload (${kb}KB)`,
      description: 'HTML alone over 500KB — likely not minified or contains inline data.',
      fix: 'Minify HTML, move inline scripts to external files, or lazy-load below-the-fold content.',
    });
  }

  // --- Compression ---
  const enc = headers['content-encoding'] ?? '';
  if (!/(gzip|br|zstd|deflate)/i.test(enc)) {
    issues.push({
      category: 'perf',
      severity: 'medium',
      title: 'Response is not compressed',
      description: 'No Content-Encoding (gzip/br/zstd) header present.',
      fix: 'Enable gzip or Brotli compression at the CDN or server.',
    });
  }

  // --- Resource counts ---
  const scriptCount = (html.match(/<script\b[^>]*\bsrc\s*=/gi) ?? []).length;
  const stylesheetCount = (html.match(/<link\b[^>]*rel\s*=\s*["']stylesheet["']/gi) ?? []).length;
  const imgCount = (html.match(/<img\b/gi) ?? []).length;

  if (scriptCount > 20) {
    issues.push({
      category: 'perf',
      severity: 'low',
      title: `${scriptCount} external scripts`,
      description: 'High script count increases parse and execution time.',
      fix: 'Bundle scripts, defer non-critical ones, or remove unused third-party tags.',
    });
  }

  if (stylesheetCount > 5) {
    issues.push({
      category: 'perf',
      severity: 'low',
      title: `${stylesheetCount} stylesheets`,
      description: 'Too many stylesheets blocks first render.',
      fix: 'Combine stylesheets or inline critical CSS.',
    });
  }

  if (imgCount > 30) {
    recommendations.push({
      title: `${imgCount} images on the page — consider lazy-loading below-the-fold images`,
      priority: 'medium',
      effort: 'low',
      impact: 'medium',
    });
  }

  return {
    category: 'perf',
    score: scoreFromIssues(issues),
    issues,
    recommendations,
    raw: {
      ttfbMs,
      totalMs,
      bytes,
      compression: enc || null,
      scriptCount,
      stylesheetCount,
      imgCount,
    },
  };
}
