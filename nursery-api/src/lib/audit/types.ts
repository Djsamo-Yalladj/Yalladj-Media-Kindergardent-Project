// Shared types for the Phase C2 audit engine.
//
// The engine runs 5 check categories against a fetched HTML page and
// produces a set of issues + recommendations that get aggregated into
// scores and written to an AuditReport row.
//
// `AuditSeverity` here mirrors the Prisma enum of the same name — we
// declare it as a string union so the engine can be used without
// pulling in the Prisma client (useful for unit tests with fixtures).

export type AuditCategory = 'seo' | 'a11y' | 'rtl' | 'security' | 'perf';

export type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AuditIssue {
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  fix?: string;
}

export interface AuditRecommendation {
  title: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

/** Result of fetching the target URL once. Passed into every check. */
export interface FetchedPage {
  targetUrl: string;
  finalUrl: string;
  status: number;
  httpsOk: boolean;
  headers: Record<string, string>;
  html: string;
  bytes: number;
  ttfbMs: number;
  totalMs: number;
  contentType: string | null;
  /** Populated when fetchPage() catches a network/timeout error. */
  error?: string;
}

export interface CheckContext {
  targetUrl: string;
  page: FetchedPage;
}

export interface CheckResult {
  category: AuditCategory;
  score: number; // 0-100
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  raw?: Record<string, unknown>;
}

/**
 * Shape we ultimately write into AuditReport.
 * Note: AuditReport only has headline columns for seo/a11y/perf/content,
 * so rtl gets mapped onto contentScore and the full 5-category breakdown
 * lives in rawData.scores for the dashboard to render.
 */
export interface AggregatedAudit {
  overallScore: number;
  seoScore: number;
  a11yScore: number;
  perfScore: number;
  contentScore: number;
  maxSeverity: AuditSeverity;
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  rawData: {
    scores: {
      seo: number;
      a11y: number;
      perf: number;
      rtl: number;
      security: number;
      overall: number;
    };
    byCategory: Record<string, { score: number; raw: Record<string, unknown> }>;
    [key: string]: unknown;
  };
}

export interface RunAuditOptions {
  nurseryId?: string | null;
  projectId?: string | null;
  leadId?: string | null;
  triggeredBy?: string | null;
  triggerSource?: string | null;
  metadata?: Record<string, unknown>;
  /** Re-use an already-queued AuditRun row instead of creating a new one. */
  existingRunId?: string;
  fetchTimeoutMs?: number;
  userAgent?: string;
}
