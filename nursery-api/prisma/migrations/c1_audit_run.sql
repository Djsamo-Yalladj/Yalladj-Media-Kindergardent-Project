-- Phase C1: AuditRun execution tracking
-- Paste this entire file into the Neon web SQL editor.
-- Safe to run once. Uses IF NOT EXISTS where possible.
-- Rollback block is at the bottom (commented out).

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AuditRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_runs" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT,
    "project_id" TEXT,
    "lead_id" TEXT,
    "target_url" TEXT NOT NULL,
    "status" "AuditRunStatus" NOT NULL DEFAULT 'queued',
    "engine_version" TEXT NOT NULL,
    "triggered_by" TEXT,
    "trigger_source" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "error_stack" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "report_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "audit_runs_report_id_key" ON "audit_runs"("report_id");
CREATE INDEX IF NOT EXISTS "audit_runs_nursery_id_idx" ON "audit_runs"("nursery_id");
CREATE INDEX IF NOT EXISTS "audit_runs_project_id_idx" ON "audit_runs"("project_id");
CREATE INDEX IF NOT EXISTS "audit_runs_lead_id_idx" ON "audit_runs"("lead_id");
CREATE INDEX IF NOT EXISTS "audit_runs_status_idx" ON "audit_runs"("status");
CREATE INDEX IF NOT EXISTS "audit_runs_queued_at_idx" ON "audit_runs"("queued_at");

-- AddForeignKey (nullable — report is created only on successful completion)
DO $$ BEGIN
    ALTER TABLE "audit_runs"
        ADD CONSTRAINT "audit_runs_report_id_fkey"
        FOREIGN KEY ("report_id") REFERENCES "audit_reports"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- ROLLBACK (uncomment + run only if you need to undo C1)
-- ============================================================
-- ALTER TABLE "audit_runs" DROP CONSTRAINT IF EXISTS "audit_runs_report_id_fkey";
-- DROP TABLE IF EXISTS "audit_runs";
-- DROP TYPE IF EXISTS "AuditRunStatus";
