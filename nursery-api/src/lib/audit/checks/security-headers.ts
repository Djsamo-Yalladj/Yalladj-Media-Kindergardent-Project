// Security-headers check — looks at response headers only.
//
// This is a quick-win category: there's a well-known list of headers
// every production site should set, and the fix is almost always a
// one-line config change at the CDN or reverse proxy.
//
// We also flag plain HTTP as a critical issue. Every other finding is
// "warn" severity — a missing CSP isn't going to get someone hacked
// on its own, but cumulatively these headers matter.

import type {
  AuditIssue,
  AuditRecommendation,
  AuditSeverity,
  CheckContext,
  CheckResult,
} from '../types.js';
import { scoreFromIssues } from '../score.js';

interface HeaderRule {
  header: string;
  severity: AuditSeverity;
  title: string;
  fix: string;
}

const RULES: HeaderRule[] = [
  {
    header: 'strict-transport-security',
    severity: 'high',
    title: 'Missing Strict-Transport-Security header',
    fix: 'Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to force HTTPS on all future requests.',
  },
  {
    header: 'content-security-policy',
    severity: 'medium',
    title: 'Missing Content-Security-Policy header',
    fix: 'Define a CSP (start with `default-src \'self\'`) to mitigate XSS and data injection.',
  },
  {
    header: 'x-content-type-options',
    severity: 'medium',
    title: 'Missing X-Content-Type-Options header',
    fix: 'Add `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing attacks.',
  },
  {
    header: 'x-frame-options',
    severity: 'medium',
    title: 'Missing X-Frame-Options header',
    fix: 'Add `X-Frame-Options: DENY` (or a CSP frame-ancestors directive) to prevent clickjacking.',
  },
  {
    header: 'referrer-policy',
    severity: 'low',
    title: 'Missing Referrer-Policy header',
    fix: 'Add `Referrer-Policy: strict-origin-when-cross-origin` to control referer leakage.',
  },
  {
    header: 'permissions-policy',
    severity: 'low',
    title: 'Missing Permissions-Policy header',
    fix: 'Restrict powerful browser APIs (camera, geolocation, etc) via Permissions-Policy.',
  },
];

export function securityHeadersCheck(ctx: CheckContext): CheckResult {
  const { headers, status, httpsOk } = ctx.page;
  const issues: AuditIssue[] = [];
  const recommendations: AuditRecommendation[] = [];

  if (!status) {
    return {
      category: 'security',
      score: 0,
      issues,
      recommendations,
      raw: { skipped: 'page not loaded' },
    };
  }

  if (!httpsOk) {
    issues.push({
      category: 'security',
      severity: 'critical',
      title: 'Site is not served over HTTPS',
      description: 'The final URL after redirects is not https://.',
      fix: "Enable HTTPS — most hosts (Vercel, Cloudflare, Netlify) provide free Let's Encrypt certificates.",
    });
  }

  const present: Record<string, boolean> = {};
  for (const rule of RULES) {
    const has = !!headers[rule.header];
    present[rule.header] = has;
    if (!has) {
      issues.push({
        category: 'security',
        severity: rule.severity,
        title: rule.title,
        description: `Response is missing the ${rule.header} header.`,
        fix: rule.fix,
      });
    }
  }

  // Leaky Server header (e.g. "nginx/1.18.0" reveals exact version).
  if (headers['server'] && /\d/.test(headers['server'])) {
    recommendations.push({
      title: 'Hide the exact server version in the Server header to reduce fingerprinting',
      priority: 'low',
      effort: 'low',
      impact: 'low',
    });
  }

  return {
    category: 'security',
    score: scoreFromIssues(issues),
    issues,
    recommendations,
    raw: { httpsOk, headersPresent: present },
  };
}
