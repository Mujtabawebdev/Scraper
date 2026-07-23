-- CreateEnum
CREATE TYPE "ApprovedSourceType" AS ENUM ('FIXTURE', 'OFFICIAL_API', 'PUBLIC_DIRECTORY', 'GOVERNMENT_DATASET', 'OFFICIAL_WEBSITE', 'LICENSED_DATASET', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "ApprovedSourceStatus" AS ENUM ('APPROVED', 'DISABLED', 'BLOCKED', 'REVIEW_REQUIRED');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "target_user_id" UUID;

-- CreateTable
CREATE TABLE "approved_sources" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(150) NOT NULL,
    "source_type" "ApprovedSourceType" NOT NULL,
    "base_url" VARCHAR(2048),
    "status" "ApprovedSourceStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "requires_api_key" BOOLEAN NOT NULL DEFAULT false,
    "allows_automated_access" BOOLEAN NOT NULL DEFAULT false,
    "requests_per_minute" INTEGER NOT NULL DEFAULT 10,
    "max_concurrency" INTEGER NOT NULL DEFAULT 1,
    "robots_policy_checked_at" TIMESTAMPTZ(3),
    "terms_reviewed_at" TIMESTAMPTZ(3),
    "review_notes" TEXT,
    "blocked_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,

    CONSTRAINT "approved_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approved_sources_key_key" ON "approved_sources"("key");

-- CreateIndex
CREATE INDEX "approved_sources_status_is_enabled_idx" ON "approved_sources"("status", "is_enabled");

-- CreateIndex
CREATE INDEX "approved_sources_source_type_idx" ON "approved_sources"("source_type");

-- CreateIndex
CREATE INDEX "approved_sources_created_by_user_id_idx" ON "approved_sources"("created_by_user_id");

-- CreateIndex
CREATE INDEX "approved_sources_updated_by_user_id_idx" ON "approved_sources"("updated_by_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_user_id_idx" ON "audit_logs"("target_user_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_sources" ADD CONSTRAINT "approved_sources_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_sources" ADD CONSTRAINT "approved_sources_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
