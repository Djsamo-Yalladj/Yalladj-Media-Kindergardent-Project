// Phase C1 smoke test: audit_runs table.
//
// Asserts that the AuditRun model is wired up end-to-end and that the
// lifecycle fields behave as expected. Does NOT touch any HTTP handler —
// we're validating schema + Prisma client only at this stage.
//
// Scenarios (8 assertions):
//   1. create({ targetUrl, engineVersion }) defaults to status='queued',
//      attemptCount=1, queuedAt set, startedAt/finishedAt/reportId null
//   2. update to status='running' sets startedAt
//   3. update to status='completed' with durationMs + reportId link works,
//      and the relation resolves back to the AuditReport row
//   4. update to status='failed' with errorMessage keeps reportId null
//   5. findMany({ where: { status: 'queued' } }) uses the status index path
//   6. findMany({ where: { nurseryId } }) uses the nursery_id index path
//   7. Setting report_id on a 2nd run for the SAME report violates the unique
//      constraint (1:1 AuditRun ↔ AuditReport)
//   8. Deleting the AuditReport sets reportId to NULL on linked AuditRun
//      (ON DELETE SET NULL), run itself is preserved
//
// Cleanup: deletes every row it creates in a finally block.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');

let passed = 0;
let failed = 0;
const createdRunIds = [];
const createdReportIds = [];
const createdNurseryIds = [];

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

try {
  // --- Setup: one throwaway nursery for FK-less filter tests ------------
  const nursery = await prisma.nursery.create({
    data: {
      name: 'C1 Smoke Nursery',
      slug: `c1-smoke-${Date.now()}`,
    },
  });
  createdNurseryIds.push(nursery.id);

  // =====================================================================
  section('1. create() defaults');
  const run1 = await prisma.auditRun.create({
    data: {
      targetUrl: 'https://example.test/c1',
      engineVersion: 'c1.smoke.v1',
      nurseryId: nursery.id,
      triggerSource: 'manual',
      triggeredBy: 'system',
    },
  });
  createdRunIds.push(run1.id);

  assert('status defaults to queued', run1.status === 'queued', `got ${run1.status}`);
  assert('attemptCount defaults to 1', run1.attemptCount === 1, `got ${run1.attemptCount}`);
  assert('queuedAt is set', run1.queuedAt instanceof Date);
  assert('startedAt is null', run1.startedAt === null);
  assert('finishedAt is null', run1.finishedAt === null);
  assert('reportId is null', run1.reportId === null);

  // =====================================================================
  section('2. transition queued → running');
  const startedAt = new Date();
  const run1Running = await prisma.auditRun.update({
    where: { id: run1.id },
    data: { status: 'running', startedAt },
  });
  assert('status is running', run1Running.status === 'running');
  assert('startedAt persisted', run1Running.startedAt?.getTime() === startedAt.getTime());

  // =====================================================================
  section('3. completed run links to AuditReport (1:1 relation)');
  const report = await prisma.auditReport.create({
    data: {
      targetUrl: 'https://example.test/c1',
      title: 'C1 smoke report',
      overallScore: 82,
      nurseryId: nursery.id,
    },
  });
  createdReportIds.push(report.id);

  const finishedAt = new Date();
  // NOTE: Neon HTTP adapter has no transaction support, so we can't combine
  // update + include in a single call (Prisma wraps that in an implicit tx).
  // Split: update first, then re-fetch with include.
  const run1Done = await prisma.auditRun.update({
    where: { id: run1.id },
    data: {
      status: 'completed',
      finishedAt,
      durationMs: 1234,
      reportId: report.id,
    },
  });
  assert('status is completed', run1Done.status === 'completed');
  assert('durationMs persisted', run1Done.durationMs === 1234);
  assert('reportId linked', run1Done.reportId === report.id);

  const run1WithReport = await prisma.auditRun.findUnique({
    where: { id: run1.id },
    include: { report: true },
  });
  assert(
    'relation resolves to report.title',
    run1WithReport?.report?.title === 'C1 smoke report',
  );

  // =====================================================================
  section('4. failed run keeps reportId null');
  const run2 = await prisma.auditRun.create({
    data: {
      targetUrl: 'https://example.test/c1-fail',
      engineVersion: 'c1.smoke.v1',
      nurseryId: nursery.id,
      status: 'failed',
      startedAt: new Date(),
      finishedAt: new Date(),
      errorMessage: 'simulated crawl failure',
      errorStack: 'Error: simulated\n    at test',
    },
  });
  createdRunIds.push(run2.id);
  assert('failed run has errorMessage', run2.errorMessage === 'simulated crawl failure');
  assert('failed run reportId is null', run2.reportId === null);

  // =====================================================================
  section('5. filter by status uses index');
  const run3 = await prisma.auditRun.create({
    data: {
      targetUrl: 'https://example.test/c1-queued',
      engineVersion: 'c1.smoke.v1',
      nurseryId: nursery.id,
    },
  });
  createdRunIds.push(run3.id);

  const queuedRuns = await prisma.auditRun.findMany({
    where: { status: 'queued', nurseryId: nursery.id },
  });
  assert(
    'findMany({status:queued}) returns the one queued run',
    queuedRuns.length === 1 && queuedRuns[0].id === run3.id,
    `got ${queuedRuns.length} rows`,
  );

  // =====================================================================
  section('6. filter by nurseryId returns all 3 runs');
  const byNursery = await prisma.auditRun.findMany({
    where: { nurseryId: nursery.id },
    orderBy: { queuedAt: 'asc' },
  });
  assert(
    'findMany({nurseryId}) returns 3 runs',
    byNursery.length === 3,
    `got ${byNursery.length}`,
  );

  // =====================================================================
  section('7. reportId is unique (1:1 AuditRun ↔ AuditReport)');
  let uniqueViolation = false;
  try {
    const dupe = await prisma.auditRun.create({
      data: {
        targetUrl: 'https://example.test/c1-dup',
        engineVersion: 'c1.smoke.v1',
        status: 'completed',
        reportId: report.id, // already linked to run1
      },
    });
    createdRunIds.push(dupe.id); // for cleanup if it somehow succeeds
  } catch (err) {
    // Either Prisma P2002, or raw PG message mentioning the unique index.
    const msg = String(err?.message ?? '');
    uniqueViolation =
      err?.code === 'P2002' ||
      msg.includes('audit_runs_report_id_key') ||
      msg.includes('unique constraint');
    if (!uniqueViolation) console.log(`      unexpected error: ${msg}`);
  }
  assert('second run with same reportId rejected', uniqueViolation);

  // =====================================================================
  section('8. ON DELETE SET NULL: deleting report nulls run.reportId');
  await prisma.auditReport.delete({ where: { id: report.id } });
  // remove from cleanup list since it's gone
  createdReportIds.splice(createdReportIds.indexOf(report.id), 1);

  const run1AfterDelete = await prisma.auditRun.findUnique({ where: { id: run1.id } });
  assert('run1 still exists after report delete', run1AfterDelete !== null);
  assert(
    'run1.reportId is now null',
    run1AfterDelete?.reportId === null,
    `got ${run1AfterDelete?.reportId}`,
  );
  assert(
    'run1.status unchanged (still completed)',
    run1AfterDelete?.status === 'completed',
  );
} catch (err) {
  console.error('\n✘ unexpected throw:', err);
  failed++;
} finally {
  // --- Cleanup ----------------------------------------------------------
  console.log('\n▶ cleanup');
  if (createdRunIds.length) {
    await prisma.auditRun.deleteMany({ where: { id: { in: createdRunIds } } });
    console.log(`  deleted ${createdRunIds.length} audit_runs rows`);
  }
  if (createdReportIds.length) {
    await prisma.auditReport.deleteMany({ where: { id: { in: createdReportIds } } });
    console.log(`  deleted ${createdReportIds.length} audit_reports rows`);
  }
  if (createdNurseryIds.length) {
    await prisma.nursery.deleteMany({ where: { id: { in: createdNurseryIds } } });
    console.log(`  deleted ${createdNurseryIds.length} nurseries rows`);
  }
  await prisma.$disconnect();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
