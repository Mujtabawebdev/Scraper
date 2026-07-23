-- CreateEnum
CREATE TYPE "PhoneValidationStatus" AS ENUM ('VALID', 'POSSIBLE', 'INVALID', 'PLACEHOLDER', 'UNVERIFIED', 'NO_PHONE_FOUND');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'VERY_LOW');

-- CreateEnum
CREATE TYPE "ExtractionMethod" AS ENUM ('OFFICIAL_API', 'HTML_TEL_LINK', 'HTML_MAILTO_LINK', 'VISIBLE_TEXT', 'SCHEMA_ORG', 'DATASET_FIELD', 'CSV_COLUMN', 'LOCAL_REVALIDATION');

-- CreateEnum
CREATE TYPE "SourceHealthStatus" AS ENUM ('NOT_CHECKED', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'CONFIGURATION_MISSING', 'QUOTA_LIMITED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AcquisitionStage" AS ENUM ('DISCOVER_BUSINESSES', 'FETCH_SOURCE_DETAILS', 'DISCOVER_OFFICIAL_WEBSITE', 'CRAWL_PUBLIC_CONTACT_PAGES', 'EXTRACT_CONTACT_DATA', 'NORMALIZE_PHONE', 'VALIDATE_PHONE', 'DEDUPLICATE', 'SCORE_CONFIDENCE', 'PERSIST_LEAD', 'COMPLETE_JOB');

-- CreateEnum
CREATE TYPE "CsvImportStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovedSourceType" ADD VALUE 'GOOGLE_PLACES_API';
ALTER TYPE "ApprovedSourceType" ADD VALUE 'META_APPROVED_API';
ALTER TYPE "ApprovedSourceType" ADD VALUE 'YELP_APPROVED_API';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SourceType" ADD VALUE 'GOOGLE_PLACES_API';
ALTER TYPE "SourceType" ADD VALUE 'GOVERNMENT_DATASET';
ALTER TYPE "SourceType" ADD VALUE 'LICENSED_DATASET';
ALTER TYPE "SourceType" ADD VALUE 'CSV_IMPORT';
ALTER TYPE "SourceType" ADD VALUE 'META_APPROVED_API';
ALTER TYPE "SourceType" ADD VALUE 'YELP_APPROVED_API';

-- AlterTable
ALTER TABLE "approved_sources" ADD COLUMN     "last_health_check_at" TIMESTAMPTZ(3),
ADD COLUMN     "last_health_check_latency_ms" INTEGER,
ADD COLUMN     "last_health_check_message" VARCHAR(500),
ADD COLUMN     "last_health_check_status" "SourceHealthStatus" NOT NULL DEFAULT 'NOT_CHECKED',
ADD COLUMN     "last_successful_request_at" TIMESTAMPTZ(3),
ADD COLUMN     "quota_limited_until" TIMESTAMPTZ(3),
ADD COLUMN     "recent_failure_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "confidence_level" "ConfidenceLevel" NOT NULL DEFAULT 'VERY_LOW',
ADD COLUMN     "confidence_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duplicate_reason" VARCHAR(255),
ADD COLUMN     "google_place_id" VARCHAR(255),
ADD COLUMN     "official_website_domain" VARCHAR(253),
ADD COLUMN     "phone_country_code" VARCHAR(8),
ADD COLUMN     "phone_extension" VARCHAR(20),
ADD COLUMN     "phone_national_format" VARCHAR(50),
ADD COLUMN     "phone_validation_status" "PhoneValidationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "scraping_jobs" ADD COLUMN     "pipeline_stage" "AcquisitionStage" NOT NULL DEFAULT 'DISCOVER_BUSINESSES';

-- CreateTable
CREATE TABLE "lead_provenance" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "approved_source_id" UUID,
    "source_key" VARCHAR(100) NOT NULL,
    "source_type" "ApprovedSourceType" NOT NULL,
    "source_record_id" VARCHAR(255),
    "source_url" VARCHAR(2048),
    "source_collected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_last_checked_at" TIMESTAMPTZ(3),
    "source_confidence_score" INTEGER NOT NULL DEFAULT 0,
    "verification_status" "PhoneValidationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "extraction_method" "ExtractionMethod" NOT NULL,
    "phone_raw" VARCHAR(50),
    "phone_normalized" VARCHAR(20),
    "email" VARCHAR(320),
    "website" VARCHAR(2048),
    "google_place_id" VARCHAR(255),
    "confidence_contribution" INTEGER NOT NULL DEFAULT 0,
    "raw_source_metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_imports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "approved_source_id" UUID,
    "scraping_job_id" UUID,
    "original_filename" VARCHAR(255) NOT NULL,
    "source_name" VARCHAR(150) NOT NULL,
    "file_sha256" CHAR(64) NOT NULL,
    "rights_confirmed_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "CsvImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "header_mapping" JSONB,
    "staged_rows" JSONB,
    "error_report" JSONB,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "csv_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_provenance_lead_id_source_collected_at_idx" ON "lead_provenance"("lead_id", "source_collected_at");

-- CreateIndex
CREATE INDEX "lead_provenance_approved_source_id_idx" ON "lead_provenance"("approved_source_id");

-- CreateIndex
CREATE INDEX "lead_provenance_source_key_source_record_id_idx" ON "lead_provenance"("source_key", "source_record_id");

-- CreateIndex
CREATE INDEX "lead_provenance_phone_normalized_idx" ON "lead_provenance"("phone_normalized");

-- CreateIndex
CREATE INDEX "lead_provenance_google_place_id_idx" ON "lead_provenance"("google_place_id");

-- CreateIndex
CREATE INDEX "csv_imports_user_id_created_at_idx" ON "csv_imports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "csv_imports_status_created_at_idx" ON "csv_imports"("status", "created_at");

-- CreateIndex
CREATE INDEX "csv_imports_approved_source_id_idx" ON "csv_imports"("approved_source_id");

-- CreateIndex
CREATE INDEX "csv_imports_scraping_job_id_idx" ON "csv_imports"("scraping_job_id");

-- CreateIndex
CREATE INDEX "csv_imports_file_sha256_idx" ON "csv_imports"("file_sha256");

-- CreateIndex
CREATE INDEX "leads_phone_validation_status_idx" ON "leads"("phone_validation_status");

-- CreateIndex
CREATE INDEX "leads_official_website_domain_idx" ON "leads"("official_website_domain");

-- CreateIndex
CREATE INDEX "leads_google_place_id_idx" ON "leads"("google_place_id");

-- CreateIndex
CREATE INDEX "leads_user_id_google_place_id_idx" ON "leads"("user_id", "google_place_id");

-- CreateIndex
CREATE INDEX "leads_confidence_level_confidence_score_idx" ON "leads"("confidence_level", "confidence_score");

-- AddForeignKey
ALTER TABLE "lead_provenance" ADD CONSTRAINT "lead_provenance_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_provenance" ADD CONSTRAINT "lead_provenance_approved_source_id_fkey" FOREIGN KEY ("approved_source_id") REFERENCES "approved_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_approved_source_id_fkey" FOREIGN KEY ("approved_source_id") REFERENCES "approved_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_scraping_job_id_fkey" FOREIGN KEY ("scraping_job_id") REFERENCES "scraping_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Confidence, health, and import counters remain bounded even when changed
-- outside the application.
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_confidence_score_check"
    CHECK ("confidence_score" BETWEEN 0 AND 100);

ALTER TABLE "lead_provenance"
  ADD CONSTRAINT "lead_provenance_confidence_score_check"
    CHECK ("source_confidence_score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "lead_provenance_confidence_contribution_check"
    CHECK ("confidence_contribution" BETWEEN -100 AND 100);

ALTER TABLE "approved_sources"
  ADD CONSTRAINT "approved_sources_health_counters_check"
    CHECK (
      "recent_failure_count" >= 0
      AND ("last_health_check_latency_ms" IS NULL OR "last_health_check_latency_ms" >= 0)
    );

ALTER TABLE "csv_imports"
  ADD CONSTRAINT "csv_imports_counts_check"
    CHECK (
      "total_rows" >= 0
      AND "valid_rows" >= 0
      AND "invalid_rows" >= 0
      AND "duplicate_rows" >= 0
      AND "imported_rows" >= 0
    );

-- Phase 9 compiled adapters. Providers without a reviewed configuration stay
-- deny-by-default. The official-website adapter is only invoked for a website
-- discovered by another approved source; it never accepts anonymous URLs.
INSERT INTO "approved_sources" (
  "id", "key", "display_name", "source_type", "base_url", "status",
  "is_enabled", "requires_api_key", "allows_automated_access",
  "requests_per_minute", "max_concurrency", "review_notes",
  "created_at", "updated_at"
) VALUES
(
  '00000000-0000-4000-8000-000000000201',
  'google-places-api',
  'Google Places API',
  'GOOGLE_PLACES_API',
  'https://places.googleapis.com/v1',
  'REVIEW_REQUIRED',
  false,
  true,
  false,
  30,
  1,
  'Requires a server-side API key, billing/quota controls, attribution review, and Google Maps Platform terms review. Only Place ID is stored by default.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000202',
  'official-website',
  'Official website enrichment',
  'OFFICIAL_WEBSITE',
  NULL,
  'APPROVED',
  true,
  false,
  true,
  10,
  1,
  'Only websites discovered by approved source records are eligible. Runtime SSRF and robots checks are mandatory for every domain.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000203',
  'government-dataset',
  'Government open dataset',
  'GOVERNMENT_DATASET',
  NULL,
  'REVIEW_REQUIRED',
  false,
  false,
  false,
  5,
  1,
  'A specific official dataset URL, licence review, and field mapper are required before enablement.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000204',
  'licensed-csv-import',
  'Licensed CSV import',
  'CSV_IMPORT',
  NULL,
  'APPROVED',
  true,
  false,
  true,
  60,
  1,
  'User rights confirmation, file/row limits, validation, provenance, and ownership checks are enforced.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000205',
  'meta-approved-api',
  'Meta approved API',
  'META_APPROVED_API',
  NULL,
  'REVIEW_REQUIRED',
  false,
  true,
  false,
  5,
  1,
  'Configuration-aware foundation only. No Meta webpage scraping is implemented.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000206',
  'yelp-approved-api',
  'Yelp approved API',
  'YELP_APPROVED_API',
  NULL,
  'REVIEW_REQUIRED',
  false,
  true,
  false,
  5,
  1,
  'Configuration-aware foundation only. No Yelp webpage scraping or restriction bypass is implemented.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
