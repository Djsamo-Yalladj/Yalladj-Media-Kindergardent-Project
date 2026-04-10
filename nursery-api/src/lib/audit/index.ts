// Phase C2 audit engine — top-level orchestrator.
//
// Public surface:
//
//   ENGINE_VERSION           — string tag written to audit_runs.engine_version
//   runAudit(url, opts)      — full DB-integrated run (creates AuditRun +
//                              AuditReport rows, links them, handles errors).
//                              Never throws; always returns a RunAuditResult.
//   runChecks(page)          — pure: run all 5 checks against an already-
//                              fetched page. No DB. Useful for unit tests.
//   runChecksForUrl(url)     — fetch + runChecks. No DB. Useful for ad-hoc
//                              debugging or HTTP-route dry-runs (C3).
//
// Individual check functions and helpers (fetchPage, aggregate, etc.) are
// also re-exported so callers can compose them differently if needed.

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import type {
  AggregatedAudit,
  CheckContext,
  CheckResult,
  FetchedPage,
  RunAuditOptions,
} from './types.js';
import { fetchPage } from './fetch.js';
import { aggregate } from './score.js';
import { seoCheck } from './checks/seo.js';
import { a11yCheck } from './checks/a11y.js';
import { rtlCheck } from './checks/rtl.js';
import { securityHeadersCheck } from './checks/security-headers.js';
import { perfLiteCheck } from './checks/perf-lite.js';

export * from './types.js';
export { fetchPage } from './fetch.js';
export { aggregate, scoreFromIssues, maxSeverity } from './score.js';
export { seoCheck } from './checks/seo.js';
export { a11yCheck } from './checks/a11y.js';
export { rtlCheck } from './checks/rtl.js';
export { securityHeadersCheck } from './checks/security-headers.js';
export { perfLiteCheck } from './checks/perf-lite.js';

/** Engine version tag. Bumped when check behaviour or scoring changes. */
export const ENGINE_VERSION = 'c2.v1';

/**
 * Run every check against an already-fetched page. Pure, no DB access.
 * Order is fixed (seo → a11y → rtl → security → perf) so the returned
 * results[] and the aggregate rawData.byCategory map are stable.
 */
export function runChecks(page: FetchedPage): {
  results: CheckResult[];
  aggregated: AggregatedAudit;
} {
  const ctx: CheckContext = { targetUrl: page.targetUrl, page };
  const results: CheckResult[] = [
    seoCheck(ctx),
    a11yCheck(ctx),
    rtlCheck(ctx),
    securityHeadersCheck(ctx),
    perfLiteCheck(ctx),
  ];
  return { results, aggregated: aggregate(results) };
}

/** Fetch + run all checks. No DB access — used for ad-hoc dry-runs. */
export async function runChecksForUrl(
  targetUrl: string,
  opts: { fetchTimeoutMs?: number; userAgent?: string } = {},
): Promise<{
  page: FetchedPage;
  results: CheckResult[];
  aggregated: AggregatedAudit;
}> {
  const page = await fetchPage(targetUrl, {
    timeoutMs: opts.fetchTimeoutMs,
    userAgent: opts.userAgent,
  });
  const { results, aggregated } = runChecks(page);
  return { page, results, aggregated };
}

export interface RunAuditResult {
  runId: string;
  reportId: string | null;
  status: 'completed' | 'failed';
  durationMs: number;
  aggregated?: AggregatedAudit;
  error?: string;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  // Strip undefined + normalize so Prisma accepts the value.
  return JSON.parse(JSON.stringify(value ?? null));
}

/**
 * Full DB-integrated audit run.
 *
 * Lifecycle:
 *   1. Create (or re-use) an AuditRun row at status=queued.
 *   2. Transition to running + set startedAt.
 *   3. Fetch target URL → run 5 checks → aggregate.
 *   4a. On success: create AuditReport, link run.reportId, mark completed.
 *   4b. On failure: mark run failed with errorMessage/errorStack.
 *
 * Never throws — any error is captured on the AuditRun row. The only
 * exception is a DB failure creating/updating the run row itself,
 * which is a cold failure the caller should see.
 */
export async function runAudit(
  targetUrl: string,
  opts: RunAuditOptions = {},
): Promise<RunAuditResult> {
  // --- 1. Create or resume the AuditRun ---
  let runId: string;
  if (opts.existingRunId) {
    runId = opts.existingRunId;
  } else {
    const run = await prisma.auditRun.create({
      data: {
        targetUrl,
        engineVersion: ENGINE_VERSION,
        nurseryId: opts.nurseryId ?? null,
        projectId: opts.projectId ?? null,
        leadId: opts.leadId ?? null,
        triggeredBy: opts.triggeredBy ?? null,
        triggerSource: opts.triggerSource ?? null,
        metadata: opts.metadata ? toJson(opts.metadata) : Prisma.JsonNull,
      },
    });
    runId = run.id;
  }

  // --- 2. Transition to running ---
  const startedAt = new Date();
  await prisma.auditRun.update({
    where: { id: runId },
    data: { status: 'running', startedAt },
  });

  try {
    // --- 3. Fetch + run checks ---
    const page = await fetchPage(targetUrl, {
      timeoutMs: opts.fetchTimeoutMs,
      userAgent: opts.userAgent,
    });

    if (page.error) {
      // Network / timeout failure — treat as a failed run rather than
      // writing a low-scoring "page did not load" report. The caller
      // can retry once the target is reachable.
      throw new Error(`fetch failed: ${page.error}`);
    }

    const { aggregated } = runChecks(page);

    // --- 4a. Create the AuditReport ---
    let hostname = targetUrl;
    try {
      hostname = new URL(targetUrl).hostname;
    } catch {
      // fall back to raw targetUrl
    }
    const reportTitle = `Audit ${hostname} — ${startedAt.toISOString().slice(0, 10)}`;

    const rawData = {
      ...aggregated.rawData,
      engineVersion: ENGINE_VERSION,
      page: {
        status: page.status,
        finalUrl: page.finalUrl,
        bytes: page.bytes,
        ttfbMs: page.ttfbMs,
        totalMs: page.totalMs,
        contentType: page.contentType,
      },
    };

    const report = await prisma.auditReport.create({
      data: {
        targetUrl,
        title: reportTitle,
        nurseryId: opts.nurseryId ?? null,
        projectId: opts.projectId ?? null,
        leadId: opts.leadId ?? null,
        overallScore: aggregated.overallScore,
        seoScore: aggregated.seoScore,
        a11yScore: aggregated.a11yScore,
        perfScore: aggregated.perfScore,
        contentScore: aggregated.contentScore,
        maxSeverity: aggregated.maxSeverity,
        issues: toJson(aggregated.issues),
        recommendations: toJson(aggregated.recommendations),
        rawData: toJson(rawData),
        generatedBy: opts.triggeredBy ?? 'bot',
      },
    });

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    // --- 4a (cont). Link report + mark completed ---
    await prisma.auditRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        finishedAt,
        durationMs,
        reportId: report.id,
      },
    });

    return {
      runId,
      reportId: report.id,
      status: 'completed',
      durationMs,
      aggregated,
    };
  } catch (err) {
    // --- 4b. Mark run failed ---
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack =
      err instanceof Error ? (err.stack ?? null) : null;

    await prisma.auditRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        finishedAt,
        durationMs,
        errorMessage,
        errorStack,
      },
    });

    return {
      runId,
      reportId: null,
      status: 'failed',
      durationMs,
      error: errorMessage,
    };
  }
}
