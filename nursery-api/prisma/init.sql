-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'archived');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('lead', 'spec', 'design', 'build', 'review', 'launched', 'archived');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('starter', 'standard', 'premium', 'custom');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('bug', 'content_update', 'support', 'feature_request');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'waiting_client', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'paused', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "HandoverType" AS ENUM ('code_handover', 'asset_bundle', 'final_delivery', 'archive');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ClaudeCodeStatus" AS ENUM ('not_started', 'brief_ready', 'in_progress', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "LearningSourceType" AS ENUM ('project', 'proposal', 'audit', 'client_feedback', 'manual_note');

-- CreateEnum
CREATE TYPE "ConversationContext" AS ENUM ('internal_assistant', 'client_sales_bot', 'lead_qualifier', 'proposal_writer', 'content_generator');

-- CreateEnum
CREATE TYPE "FileLinkedTable" AS ENUM ('nurseries', 'projects', 'project_specs', 'deliverables', 'tickets', 'handovers', 'leads', 'users', 'content_blocks', 'audit_reports');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "permissions" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "nursery_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "website" TEXT,
    "source" TEXT,
    "budget" DECIMAL(12,2),
    "package_interest" "PackageType",
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "assigned_to" TEXT,
    "qualified_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "nursery_id" TEXT,
    "intake_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurseries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "tiktok" TEXT,
    "contact_name" TEXT,
    "contact_role" TEXT,
    "package_type" "PackageType",
    "contract_value" DECIMAL(12,2),
    "brand_colors" JSONB,
    "brand_fonts" JSONB,
    "description" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "onboarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "nurseries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" JSONB,
    "package_type" "PackageType" NOT NULL,
    "stage" "ProjectStage" NOT NULL DEFAULT 'lead',
    "contract_value" DECIMAL(12,2),
    "start_date" TIMESTAMP(3),
    "target_launch_date" TIMESTAMP(3),
    "launched_at" TIMESTAMP(3),
    "assigned_to" TEXT,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "live_url" TEXT,
    "repo_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_specs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "brand_colors" JSONB,
    "brand_fonts" JSONB,
    "logo_url" TEXT,
    "pages" JSONB,
    "features" JSONB,
    "integrations" JSONB,
    "content_plan" JSONB,
    "target_audience" JSONB,
    "reference_sites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brief_en" TEXT,
    "brief_ar" TEXT,
    "claude_code_brief" TEXT,
    "claude_code_status" "ClaudeCodeStatus" NOT NULL DEFAULT 'not_started',
    "claude_code_log" JSONB,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "project_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stage" "ProjectStage" NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exited_at" TIMESTAMP(3),
    "duration_hours" INTEGER,
    "notes" TEXT,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverables" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_ar" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "file_url" TEXT,
    "preview_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_types" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "default_price" DECIMAL(12,2),
    "billing_cycle" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "contract_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'medium',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "assigned_to" TEXT,
    "reported_by" TEXT,
    "reported_email" TEXT,
    "due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "project_id" TEXT,
    "contract_type_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billing_cycle" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "renews_at" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "terms" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handovers" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "project_id" TEXT,
    "type" "HandoverType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "archive_url" TEXT,
    "manifest" JSONB,
    "size_bytes" BIGINT,
    "delivered_at" TIMESTAMP(3),
    "delivered_to_email" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title_en" TEXT,
    "title_ar" TEXT,
    "body_en" TEXT,
    "body_ar" TEXT,
    "media_url" TEXT,
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "nursery_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "description" JSONB,
    "package_type" "PackageType" NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "thumbnail_url" TEXT,
    "preview_url" TEXT,
    "pages" JSONB NOT NULL,
    "default_brand" JSONB,
    "features" JSONB,
    "content_refs" JSONB,
    "repo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "site_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_reports" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT,
    "project_id" TEXT,
    "lead_id" TEXT,
    "target_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary_en" TEXT,
    "summary_ar" TEXT,
    "overall_score" INTEGER,
    "seo_score" INTEGER,
    "perf_score" INTEGER,
    "a11y_score" INTEGER,
    "content_score" INTEGER,
    "max_severity" "AuditSeverity" NOT NULL DEFAULT 'info',
    "issues" JSONB,
    "recommendations" JSONB,
    "raw_data" JSONB,
    "screenshot_url" TEXT,
    "report_url" TEXT,
    "generated_by" TEXT,
    "sent_to_client" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "audit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_label" TEXT,
    "action" TEXT NOT NULL,
    "entity_table" TEXT,
    "entity_id" TEXT,
    "entity_label" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_learnings" (
    "id" TEXT NOT NULL,
    "source_type" "LearningSourceType" NOT NULL,
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_ar" TEXT,
    "summary" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "embedding" vector(768),
    "token_count" INTEGER,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "ai_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "context" "ConversationContext" NOT NULL,
    "title" TEXT,
    "user_id" TEXT,
    "lead_id" TEXT,
    "nursery_id" TEXT,
    "session_token" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(10,4),
    "rating" INTEGER,
    "feedback" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_translations" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "source_text" TEXT NOT NULL,
    "source_lang" TEXT NOT NULL,
    "target_text" TEXT NOT NULL,
    "target_lang" TEXT NOT NULL,
    "context" TEXT,
    "model" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,

    CONSTRAINT "ai_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "linked_table" "FileLinkedTable" NOT NULL,
    "linked_id" TEXT NOT NULL,
    "label" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT,
    "label" TEXT,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "leads_nursery_id_key" ON "leads"("nursery_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_assigned_to_idx" ON "leads"("assigned_to");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "nurseries_slug_key" ON "nurseries"("slug");

-- CreateIndex
CREATE INDEX "nurseries_slug_idx" ON "nurseries"("slug");

-- CreateIndex
CREATE INDEX "nurseries_is_active_idx" ON "nurseries"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_nursery_id_idx" ON "projects"("nursery_id");

-- CreateIndex
CREATE INDEX "projects_stage_idx" ON "projects"("stage");

-- CreateIndex
CREATE INDEX "projects_assigned_to_idx" ON "projects"("assigned_to");

-- CreateIndex
CREATE UNIQUE INDEX "project_specs_project_id_key" ON "project_specs"("project_id");

-- CreateIndex
CREATE INDEX "project_stages_project_id_idx" ON "project_stages"("project_id");

-- CreateIndex
CREATE INDEX "project_stages_stage_idx" ON "project_stages"("stage");

-- CreateIndex
CREATE INDEX "deliverables_project_id_idx" ON "deliverables"("project_id");

-- CreateIndex
CREATE INDEX "deliverables_type_idx" ON "deliverables"("type");

-- CreateIndex
CREATE UNIQUE INDEX "contract_types_key_key" ON "contract_types"("key");

-- CreateIndex
CREATE INDEX "contract_types_is_active_idx" ON "contract_types"("is_active");

-- CreateIndex
CREATE INDEX "tickets_nursery_id_idx" ON "tickets"("nursery_id");

-- CreateIndex
CREATE INDEX "tickets_project_id_idx" ON "tickets"("project_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_idx" ON "tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "service_contracts_nursery_id_idx" ON "service_contracts"("nursery_id");

-- CreateIndex
CREATE INDEX "service_contracts_project_id_idx" ON "service_contracts"("project_id");

-- CreateIndex
CREATE INDEX "service_contracts_status_idx" ON "service_contracts"("status");

-- CreateIndex
CREATE INDEX "service_contracts_contract_type_id_idx" ON "service_contracts"("contract_type_id");

-- CreateIndex
CREATE INDEX "handovers_nursery_id_idx" ON "handovers"("nursery_id");

-- CreateIndex
CREATE INDEX "handovers_project_id_idx" ON "handovers"("project_id");

-- CreateIndex
CREATE INDEX "handovers_type_idx" ON "handovers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_key_key" ON "content_blocks"("key");

-- CreateIndex
CREATE INDEX "content_blocks_category_idx" ON "content_blocks"("category");

-- CreateIndex
CREATE INDEX "content_blocks_nursery_id_idx" ON "content_blocks"("nursery_id");

-- CreateIndex
CREATE INDEX "content_blocks_is_global_idx" ON "content_blocks"("is_global");

-- CreateIndex
CREATE UNIQUE INDEX "site_templates_key_key" ON "site_templates"("key");

-- CreateIndex
CREATE INDEX "site_templates_package_type_idx" ON "site_templates"("package_type");

-- CreateIndex
CREATE INDEX "site_templates_is_active_idx" ON "site_templates"("is_active");

-- CreateIndex
CREATE INDEX "audit_reports_nursery_id_idx" ON "audit_reports"("nursery_id");

-- CreateIndex
CREATE INDEX "audit_reports_project_id_idx" ON "audit_reports"("project_id");

-- CreateIndex
CREATE INDEX "audit_reports_lead_id_idx" ON "audit_reports"("lead_id");

-- CreateIndex
CREATE INDEX "audit_reports_max_severity_idx" ON "audit_reports"("max_severity");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_table_entity_id_idx" ON "audit_logs"("entity_table", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_learnings_source_type_idx" ON "ai_learnings"("source_type");

-- CreateIndex
CREATE INDEX "ai_learnings_category_idx" ON "ai_learnings"("category");

-- CreateIndex
CREATE INDEX "ai_learnings_is_approved_idx" ON "ai_learnings"("is_approved");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_session_token_key" ON "ai_conversations"("session_token");

-- CreateIndex
CREATE INDEX "ai_conversations_context_idx" ON "ai_conversations"("context");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_lead_id_idx" ON "ai_conversations"("lead_id");

-- CreateIndex
CREATE INDEX "ai_conversations_nursery_id_idx" ON "ai_conversations"("nursery_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_translations_hash_key" ON "ai_translations"("hash");

-- CreateIndex
CREATE INDEX "ai_translations_source_lang_target_lang_idx" ON "ai_translations"("source_lang", "target_lang");

-- CreateIndex
CREATE INDEX "ai_translations_context_idx" ON "ai_translations"("context");

-- CreateIndex
CREATE INDEX "ai_translations_is_verified_idx" ON "ai_translations"("is_verified");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_linked_table_linked_id_idx" ON "files"("linked_table", "linked_id");

-- CreateIndex
CREATE INDEX "files_uploaded_by_idx" ON "files"("uploaded_by");

-- CreateIndex
CREATE INDEX "files_mime_type_idx" ON "files"("mime_type");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE INDEX "settings_is_public_idx" ON "settings"("is_public");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_specs" ADD CONSTRAINT "project_specs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_contract_type_id_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "contract_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Phase C1 — AuditRun execution tracking
-- (also available as a standalone migration: migrations/c1_audit_run.sql)
-- ============================================================

-- CreateEnum
CREATE TYPE "AuditRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "audit_runs" (
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
CREATE UNIQUE INDEX "audit_runs_report_id_key" ON "audit_runs"("report_id");
CREATE INDEX "audit_runs_nursery_id_idx" ON "audit_runs"("nursery_id");
CREATE INDEX "audit_runs_project_id_idx" ON "audit_runs"("project_id");
CREATE INDEX "audit_runs_lead_id_idx" ON "audit_runs"("lead_id");
CREATE INDEX "audit_runs_status_idx" ON "audit_runs"("status");
CREATE INDEX "audit_runs_queued_at_idx" ON "audit_runs"("queued_at");

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "audit_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

