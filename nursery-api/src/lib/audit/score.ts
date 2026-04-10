// Scoring helpers: turn a list of issues into a 0-100 category score
// and roll up per-category results into an AggregatedAudit.
//
// The scoring formula is deliberately simple and deterministic:
// every category starts at 100 and loses points per issue by severity.
// This is easy to explain on the dashboard, easy to test, and easy
// to tune (just edit SEVERITY_DEDUCTION). A real perf/lighthouse score
// would need a browser — that's out of scope for the "perf-lite" engine.

import type {
  AggregatedAudit,
  AuditIssue,
  AuditSeverity,
  CheckResult,
} from './types.js';

const SEVERITY_ORDER: AuditSeverity[] = [
  'info',
  'low',
  'medium',
  'high',
  'critical',
];

const SEVERITY_DEDUCTION: Record<AuditSeverity, number> = {
  info: 0,
  low: 5,
  medium: 10,
  high: 20,
  critical: 35,
};

export function scoreFromIssues(issues: AuditIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= SEVERITY_DEDUCTION[issue.severity] ?? 0;
  }
  return Math.max(0, Math.min(100, score));
}

export function maxSeverity(issues: AuditIssue[]): AuditSeverity {
  let max: AuditSeverity = 'info';
  for (const issue of issues) {
    if (SEVERITY_ORDER.indexOf(issue.severity) > SEVERITY_ORDER.indexOf(max)) {
      max = issue.severity;
    }
  }
  return max;
}

/**
 * Roll up the 5 per-category results into the shape we write to
 * AuditReport. Column mapping:
 *
 *   seoScore     ← seo check
 *   a11yScore    ← a11y check
 *   perfScore    ← perf check
 *   contentScore ← rtl check (Arabic/i18n content quality)
 *   overall      ← unweighted average of all 5 categories
 *
 * The security score has no dedicated column, so it lives in
 * rawData.scores.security along with the full per-category breakdown.
 */
export function aggregate(results: CheckResult[]): AggregatedAudit {
  const byCat = new Map(results.map((r) => [r.category, r]));
  const allIssues = results.flatMap((r) => r.issues);
  const allRecs = results.flatMap((r) => r.recommendations);

  const seo = byCat.get('seo')?.score ?? 0;
  const a11y = byCat.get('a11y')?.score ?? 0;
  const perf = byCat.get('perf')?.score ?? 0;
  const rtl = byCat.get('rtl')?.score ?? 0;
  const security = byCat.get('security')?.score ?? 0;

  const overall = Math.round((seo + a11y + perf + rtl + security) / 5);

  const byCategory: Record<string, { score: number; raw: Record<string, unknown> }> = {};
  for (const r of results) {
    byCategory[r.category] = { score: r.score, raw: r.raw ?? {} };
  }

  return {
    overallScore: overall,
    seoScore: seo,
    a11yScore: a11y,
    perfScore: perf,
    contentScore: rtl,
    maxSeverity: maxSeverity(allIssues),
    issues: allIssues,
    recommendations: allRecs,
    rawData: {
      scores: { seo, a11y, perf, rtl, security, overall },
      byCategory,
    },
  };
}
