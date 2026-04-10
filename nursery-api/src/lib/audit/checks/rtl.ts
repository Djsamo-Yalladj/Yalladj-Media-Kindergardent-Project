// RTL / Arabic-readiness check.
//
// Every nursery we sell to is in the UAE, so Arabic support is a
// first-class concern — not a "nice to have". This check flags:
//
//   1. Arabic text in the HTML without dir="rtl" on <html>
//   2. Arabic text without lang="ar"
//   3. lang="ar" declared but no Arabic script actually present
//   4. English-only pages (recommendation to add an Arabic version)
//
// The Arabic script detection is a simple Unicode range test for the
// main Arabic block (U+0600–U+06FF). That covers modern standard
// Arabic; it won't detect Arabic Presentation Forms (U+FB50–U+FDFF)
// or Supplement blocks, but those are rarely used in page content.

import type {
  AuditIssue,
  AuditRecommendation,
  CheckContext,
  CheckResult,
} from '../types.js';
import { scoreFromIssues } from '../score.js';

const ARABIC_RE = /[\u0600-\u06FF]/;

export function rtlCheck(ctx: CheckContext): CheckResult {
  const { html, status } = ctx.page;
  const issues: AuditIssue[] = [];
  const recommendations: AuditRecommendation[] = [];

  if (!status || status >= 400) {
    return {
      category: 'rtl',
      score: 0,
      issues,
      recommendations,
      raw: { skipped: 'page not loaded' },
    };
  }

  const hasArabic = ARABIC_RE.test(html);

  const htmlTagMatch = html.match(/<html\b([^>]*)>/i);
  const htmlAttrs = htmlTagMatch?.[1] ?? '';
  const langMatch = htmlAttrs.match(/\blang\s*=\s*["']([^"']+)["']/i);
  const dirMatch = htmlAttrs.match(/\bdir\s*=\s*["']([^"']+)["']/i);
  const lang = langMatch?.[1] ?? null;
  const dir = dirMatch?.[1] ?? null;

  const isArabicLang = lang?.toLowerCase().startsWith('ar') ?? false;

  if (hasArabic && dir !== 'rtl') {
    issues.push({
      category: 'rtl',
      severity: 'high',
      title: 'Arabic content without dir="rtl"',
      description:
        'Arabic text is present but the <html> element does not set dir="rtl". Text will render in the wrong direction.',
      fix: 'Add dir="rtl" to <html> (or to the Arabic container) for correct text direction.',
    });
  }

  if (hasArabic && !isArabicLang) {
    issues.push({
      category: 'rtl',
      severity: 'medium',
      title: 'Arabic content without lang="ar"',
      description:
        'Arabic text is present but lang is not set to "ar". Search engines and screen readers will mis-handle the content.',
      fix: 'Set lang="ar" on <html> (or scoped via lang attribute on the Arabic section).',
    });
  }

  if (isArabicLang && !hasArabic) {
    issues.push({
      category: 'rtl',
      severity: 'low',
      title: 'lang="ar" but no Arabic characters detected',
      description:
        'The page declares Arabic but the rendered HTML contains no Arabic script.',
      fix: 'Either provide Arabic content or change lang to match the actual content.',
    });
  }

  if (!hasArabic) {
    recommendations.push({
      title:
        'Add an Arabic version of this page — the majority of UAE parents expect native Arabic content',
      priority: 'high',
      effort: 'high',
      impact: 'high',
    });
  }

  return {
    category: 'rtl',
    score: scoreFromIssues(issues),
    issues,
    recommendations,
    raw: { hasArabic, lang, dir, isArabicLang },
  };
}
