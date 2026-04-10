// SEO check — parses the raw HTML with regexes (no cheerio dep).
//
// We only look at the initial server-rendered HTML. SPAs that render
// everything client-side will score poorly here, which is the correct
// signal: missing server-rendered meta tags means search engines and
// social previews get nothing.

import type {
  AuditIssue,
  AuditRecommendation,
  CheckContext,
  CheckResult,
} from '../types.js';
import { scoreFromIssues } from '../score.js';

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? (m[1]?.trim() ?? null) : null;
}

function extractMeta(html: string, name: string): string | null {
  // Match either name="…" or property="…" (OG tags use property).
  const re = new RegExp(
    `<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  if (m) return m[1]?.trim() ?? null;
  // Also try content-before-name ordering.
  const re2 = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${name}["']`,
    'i',
  );
  return extractFirst(html, re2);
}

export function seoCheck(ctx: CheckContext): CheckResult {
  const { html, status } = ctx.page;
  const issues: AuditIssue[] = [];
  const recommendations: AuditRecommendation[] = [];

  // If the page never loaded, SEO is unscorable. Emit one critical
  // issue and return a 0 so the aggregate rawData still has the row.
  if (!status || status >= 400) {
    issues.push({
      category: 'seo',
      severity: 'critical',
      title: 'Page did not load',
      description: `Target URL returned status ${status || '(no response)'}.`,
      fix: 'Ensure the page is reachable over the public internet.',
    });
    return {
      category: 'seo',
      score: 0,
      issues,
      recommendations,
      raw: { status },
    };
  }

  const title = extractFirst(html, /<title[^>]*>([^<]*)<\/title>/i);
  if (!title) {
    issues.push({
      category: 'seo',
      severity: 'high',
      title: 'Missing <title> tag',
      description: 'The page has no <title> element.',
      fix: 'Add a descriptive <title> between 30–60 characters.',
    });
  } else if (title.length < 10) {
    issues.push({
      category: 'seo',
      severity: 'medium',
      title: 'Title is too short',
      description: `<title> is only ${title.length} characters.`,
      fix: 'Expand the title to 30–60 characters.',
    });
  } else if (title.length > 70) {
    issues.push({
      category: 'seo',
      severity: 'low',
      title: 'Title is too long',
      description: `<title> is ${title.length} characters and will be truncated in search results.`,
      fix: 'Shorten the title to under 60 characters.',
    });
  }

  const metaDesc = extractMeta(html, 'description');
  if (!metaDesc) {
    issues.push({
      category: 'seo',
      severity: 'high',
      title: 'Missing meta description',
      description: 'No <meta name="description"> found.',
      fix: 'Add a 140–160 character meta description summarising the page.',
    });
  } else if (metaDesc.length < 50) {
    issues.push({
      category: 'seo',
      severity: 'low',
      title: 'Meta description is short',
      description: `Meta description is only ${metaDesc.length} characters.`,
      fix: 'Expand to 140–160 characters.',
    });
  }

  const canonical = html.match(
    /<link[^>]+rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i,
  );
  if (!canonical) {
    issues.push({
      category: 'seo',
      severity: 'low',
      title: 'Missing canonical link',
      description: 'No <link rel="canonical"> found.',
      fix: 'Add a canonical link to avoid duplicate-content penalties.',
    });
  }

  const ogTitle = extractMeta(html, 'og:title');
  const ogImage = extractMeta(html, 'og:image');
  if (!ogTitle || !ogImage) {
    issues.push({
      category: 'seo',
      severity: 'low',
      title: 'Missing Open Graph tags',
      description:
        'og:title and/or og:image missing — links shared on social media will look poor.',
      fix: 'Add og:title, og:description, og:image and og:url meta tags.',
    });
  }

  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count === 0) {
    issues.push({
      category: 'seo',
      severity: 'medium',
      title: 'No <h1> on the page',
      description: 'Every page should have exactly one <h1>.',
      fix: 'Add a single top-level <h1> describing the page.',
    });
  } else if (h1Count > 1) {
    issues.push({
      category: 'seo',
      severity: 'low',
      title: `Multiple <h1> tags (${h1Count})`,
      description: 'Prefer exactly one <h1> per page for clear document structure.',
    });
  }

  if (issues.length === 0) {
    recommendations.push({
      title: 'SEO basics look good — consider adding structured data (JSON-LD)',
      priority: 'low',
      effort: 'medium',
      impact: 'medium',
    });
  }

  return {
    category: 'seo',
    score: scoreFromIssues(issues),
    issues,
    recommendations,
    raw: {
      title,
      metaDescription: metaDesc,
      h1Count,
      hasCanonical: !!canonical,
      ogTitle,
      ogImage,
    },
  };
}
