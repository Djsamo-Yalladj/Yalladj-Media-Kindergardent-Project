// Accessibility check — HTML-level heuristics only.
//
// A real a11y audit needs a browser (axe-core, pa11y, lighthouse) to
// inspect the rendered DOM, colour contrast, focus order, and ARIA
// state. This check catches the subset that's visible in the raw HTML:
// lang attribute, image alt text, empty buttons, unlabelled inputs,
// and a missing top-level heading. The recommendations block nudges
// users toward a full axe-core run in browser once the basics pass.

import type {
  AuditIssue,
  AuditRecommendation,
  CheckContext,
  CheckResult,
} from '../types.js';
import { scoreFromIssues } from '../score.js';

export function a11yCheck(ctx: CheckContext): CheckResult {
  const { html, status } = ctx.page;
  const issues: AuditIssue[] = [];
  const recommendations: AuditRecommendation[] = [];

  if (!status || status >= 400) {
    return {
      category: 'a11y',
      score: 0,
      issues,
      recommendations,
      raw: { skipped: 'page not loaded' },
    };
  }

  // --- lang attribute on <html> ---
  const htmlTagMatch = html.match(/<html\b([^>]*)>/i);
  const htmlAttrs = htmlTagMatch?.[1] ?? '';
  const hasLang = /\blang\s*=\s*["'][^"']+["']/i.test(htmlAttrs);
  if (!hasLang) {
    issues.push({
      category: 'a11y',
      severity: 'high',
      title: 'Missing lang attribute on <html>',
      description:
        'Screen readers need a language declaration to pronounce content correctly.',
      fix: 'Add lang="en" or lang="ar" to the <html> element.',
    });
  }

  // --- Images without alt ---
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const imgsMissingAlt = imgs.filter((tag) => !/\balt\s*=/i.test(tag));
  if (imgs.length > 0 && imgsMissingAlt.length > 0) {
    const severity: AuditIssue['severity'] =
      imgsMissingAlt.length >= 5 ? 'high' : 'medium';
    issues.push({
      category: 'a11y',
      severity,
      title: `${imgsMissingAlt.length}/${imgs.length} images missing alt attribute`,
      description:
        'Images without alt text are invisible to screen readers and harm SEO.',
      fix: 'Add descriptive alt="…" to every <img>, or alt="" for decorative images.',
    });
  }

  // --- Empty <button> elements ---
  const emptyButtons = (html.match(/<button\b[^>]*>\s*<\/button>/gi) ?? []).length;
  if (emptyButtons > 0) {
    issues.push({
      category: 'a11y',
      severity: 'medium',
      title: `${emptyButtons} empty <button> element(s)`,
      description:
        'Buttons without inner text or aria-label have no accessible name.',
      fix: 'Add visible text or aria-label="…" to every button.',
    });
  }

  // --- Inputs that look unlabelled ---
  // Heuristic: an <input> with neither id, aria-label, nor a common
  // "unlabelled-by-design" type is probably missing a label.
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const unlabelledInputs = inputs.filter((tag) => {
    if (/\bid\s*=/i.test(tag)) return false;
    if (/\baria-label\s*=/i.test(tag)) return false;
    if (/\baria-labelledby\s*=/i.test(tag)) return false;
    if (/\btype\s*=\s*["'](hidden|submit|button|reset|image)["']/i.test(tag)) {
      return false;
    }
    return true;
  }).length;
  if (unlabelledInputs > 0) {
    issues.push({
      category: 'a11y',
      severity: 'medium',
      title: `${unlabelledInputs} input(s) possibly missing a label`,
      description:
        'Form inputs should have an associated <label> or aria-label.',
      fix: 'Wrap each input with <label> or add aria-label="…".',
    });
  }

  // --- Top-level heading ---
  if (!/<h1\b/i.test(html)) {
    issues.push({
      category: 'a11y',
      severity: 'low',
      title: 'No <h1> for page landmark',
      description:
        'Screen-reader users rely on <h1> as the main page heading.',
      fix: 'Add one top-level <h1> near the start of <main>.',
    });
  }

  if (issues.length === 0) {
    recommendations.push({
      title:
        'HTML-level a11y looks clean — run a full axe-core audit in a browser to catch contrast and focus issues',
      priority: 'medium',
      effort: 'medium',
      impact: 'high',
    });
  }

  return {
    category: 'a11y',
    score: scoreFromIssues(issues),
    issues,
    recommendations,
    raw: {
      hasLang,
      imgCount: imgs.length,
      imgsMissingAlt: imgsMissingAlt.length,
      inputCount: inputs.length,
      unlabelledInputs,
      emptyButtons,
    },
  };
}
