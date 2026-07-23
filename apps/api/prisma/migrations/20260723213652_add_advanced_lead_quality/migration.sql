-- CreateEnum
CREATE TYPE "LeadVerificationStatus" AS ENUM ('UNVERIFIED', 'PARTIALLY_VERIFIED', 'VERIFIED', 'VERIFICATION_FAILED', 'CONFLICTING', 'STALE', 'NO_CONTACT_DATA');

-- CreateEnum
CREATE TYPE "LeadReviewStatus" AS ENUM ('NOT_REQUIRED', 'REVIEW_REQUIRED', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeadFreshnessStatus" AS ENUM ('FRESH', 'AGING', 'STALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DuplicateMatchLevel" AS ENUM ('EXACT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "DuplicateCandidateStatus" AS ENUM ('PENDING', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'IGNORED');

-- CreateEnum
CREATE TYPE "QualityIssueSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QualityIssueStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'IGNORED');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "canonical_lead_id" UUID,
ADD COLUMN     "completeness_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freshness_status" "LeadFreshnessStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "merge_reason" TEXT,
ADD COLUMN     "merged_at" TIMESTAMPTZ(3),
ADD COLUMN     "merged_by_user_id" UUID,
ADD COLUMN     "next_verification_at" TIMESTAMPTZ(3),
ADD COLUMN     "primary_email_provenance_id" UUID,
ADD COLUMN     "primary_phone_provenance_id" UUID,
ADD COLUMN     "primary_website_provenance_id" UUID,
ADD COLUMN     "quality_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "review_status" "LeadReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "stale_at" TIMESTAMPTZ(3),
ADD COLUMN     "verification_status" "LeadVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- CreateTable
CREATE TABLE "lead_verifications" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "verification_type" VARCHAR(50) NOT NULL,
    "status" "LeadVerificationStatus" NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "checked_value_hash" VARCHAR(128),
    "result_summary" JSONB,
    "failure_reason" TEXT,
    "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_duplicate_candidates" (
    "id" UUID NOT NULL,
    "primary_lead_id" UUID NOT NULL,
    "candidate_lead_id" UUID NOT NULL,
    "match_score" INTEGER NOT NULL,
    "match_level" "DuplicateMatchLevel" NOT NULL,
    "match_reasons" JSONB NOT NULL,
    "status" "DuplicateCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_duplicate_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_merge_histories" (
    "id" UUID NOT NULL,
    "canonical_lead_id" UUID NOT NULL,
    "merged_lead_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "reason" TEXT,
    "preserved_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_merge_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_quality_issues" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "issue_type" VARCHAR(100) NOT NULL,
    "severity" "QualityIssueSeverity" NOT NULL,
    "field_name" VARCHAR(100),
    "summary" VARCHAR(500) NOT NULL,
    "status" "QualityIssueStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_quality_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_verifications_lead_id_checked_at_idx" ON "lead_verifications"("lead_id", "checked_at");

-- CreateIndex
CREATE INDEX "lead_verifications_verification_type_status_idx" ON "lead_verifications"("verification_type", "status");

-- CreateIndex
CREATE INDEX "lead_verifications_created_by_user_id_idx" ON "lead_verifications"("created_by_user_id");

-- CreateIndex
CREATE INDEX "lead_duplicate_candidates_primary_lead_id_status_idx" ON "lead_duplicate_candidates"("primary_lead_id", "status");

-- CreateIndex
CREATE INDEX "lead_duplicate_candidates_candidate_lead_id_status_idx" ON "lead_duplicate_candidates"("candidate_lead_id", "status");

-- CreateIndex
CREATE INDEX "lead_duplicate_candidates_status_idx" ON "lead_duplicate_candidates"("status");

-- CreateIndex
CREATE INDEX "lead_duplicate_candidates_reviewed_by_user_id_idx" ON "lead_duplicate_candidates"("reviewed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_duplicate_candidates_primary_lead_id_candidate_lead_id_key" ON "lead_duplicate_candidates"("primary_lead_id", "candidate_lead_id");

-- CreateIndex
CREATE INDEX "lead_merge_histories_canonical_lead_id_idx" ON "lead_merge_histories"("canonical_lead_id");

-- CreateIndex
CREATE INDEX "lead_merge_histories_merged_lead_id_idx" ON "lead_merge_histories"("merged_lead_id");

-- CreateIndex
CREATE INDEX "lead_merge_histories_actor_user_id_idx" ON "lead_merge_histories"("actor_user_id");

-- CreateIndex
CREATE INDEX "lead_merge_histories_created_at_idx" ON "lead_merge_histories"("created_at");

-- CreateIndex
CREATE INDEX "lead_quality_issues_lead_id_status_idx" ON "lead_quality_issues"("lead_id", "status");

-- CreateIndex
CREATE INDEX "lead_quality_issues_issue_type_status_idx" ON "lead_quality_issues"("issue_type", "status");

-- CreateIndex
CREATE INDEX "lead_quality_issues_severity_status_idx" ON "lead_quality_issues"("severity", "status");

-- CreateIndex
CREATE INDEX "lead_quality_issues_resolved_by_user_id_idx" ON "lead_quality_issues"("resolved_by_user_id");

-- CreateIndex
CREATE INDEX "leads_quality_score_idx" ON "leads"("quality_score");

-- CreateIndex
CREATE INDEX "leads_completeness_score_idx" ON "leads"("completeness_score");

-- CreateIndex
CREATE INDEX "leads_verification_status_idx" ON "leads"("verification_status");

-- CreateIndex
CREATE INDEX "leads_review_status_idx" ON "leads"("review_status");

-- CreateIndex
CREATE INDEX "leads_freshness_status_idx" ON "leads"("freshness_status");

-- CreateIndex
CREATE INDEX "leads_next_verification_at_idx" ON "leads"("next_verification_at");

-- CreateIndex
CREATE INDEX "leads_canonical_lead_id_idx" ON "leads"("canonical_lead_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_canonical_lead_id_fkey" FOREIGN KEY ("canonical_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_merged_by_user_id_fkey" FOREIGN KEY ("merged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_verifications" ADD CONSTRAINT "lead_verifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_verifications" ADD CONSTRAINT "lead_verifications_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_duplicate_candidates" ADD CONSTRAINT "lead_duplicate_candidates_primary_lead_id_fkey" FOREIGN KEY ("primary_lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_duplicate_candidates" ADD CONSTRAINT "lead_duplicate_candidates_candidate_lead_id_fkey" FOREIGN KEY ("candidate_lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_duplicate_candidates" ADD CONSTRAINT "lead_duplicate_candidates_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_merge_histories" ADD CONSTRAINT "lead_merge_histories_canonical_lead_id_fkey" FOREIGN KEY ("canonical_lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_merge_histories" ADD CONSTRAINT "lead_merge_histories_merged_lead_id_fkey" FOREIGN KEY ("merged_lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_merge_histories" ADD CONSTRAINT "lead_merge_histories_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_quality_issues" ADD CONSTRAINT "lead_quality_issues_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_quality_issues" ADD CONSTRAINT "lead_quality_issues_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
