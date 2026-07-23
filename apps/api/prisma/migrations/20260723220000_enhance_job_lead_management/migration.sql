-- Rename the existing ownership column without losing Phase 4 job data.
ALTER TABLE "scraping_jobs" RENAME COLUMN "created_by_id" TO "user_id";
ALTER TABLE "scraping_jobs"
  RENAME CONSTRAINT "scraping_jobs_created_by_id_fkey" TO "scraping_jobs_user_id_fkey";

-- Extend scraping jobs with the public source, display location, lifecycle,
-- duplicate-count, queue-correlation, and retry-audit fields.
ALTER TABLE "scraping_jobs"
  ADD COLUMN "source" VARCHAR(100) NOT NULL DEFAULT 'fixture-business-directory',
  ADD COLUMN "location" VARCHAR(255) NOT NULL DEFAULT 'United States',
  ADD COLUMN "duplicate_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failed_at" TIMESTAMPTZ(3),
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(3),
  ADD COLUMN "queue_job_id" VARCHAR(255),
  ADD COLUMN "retry_of_job_id" UUID;

UPDATE "scraping_jobs"
SET "location" = COALESCE(
  NULLIF(CONCAT_WS(', ', NULLIF("city", ''), NULLIF("state", '')), ''),
  "country"
);

-- PAUSED was never part of the public lifecycle. Preserve such legacy rows as
-- terminal cancellations while retaining the enum value for backward compatibility.
UPDATE "scraping_jobs"
SET "status" = 'CANCELLED', "cancelled_at" = COALESCE("cancelled_at", CURRENT_TIMESTAMP)
WHERE "status" = 'PAUSED';

-- Add direct tenant ownership to leads and safely backfill it from their job.
ALTER TABLE "leads" ADD COLUMN "user_id" UUID;

UPDATE "leads" AS "lead"
SET "user_id" = "job"."user_id"
FROM "scraping_jobs" AS "job"
WHERE "lead"."scraping_job_id" = "job"."id";

ALTER TABLE "leads" ALTER COLUMN "user_id" SET NOT NULL;

-- Replace legacy single-column job indexes with tenant-first indexes.
DROP INDEX "scraping_jobs_created_by_id_idx";
DROP INDEX "scraping_jobs_created_at_idx";

CREATE INDEX "scraping_jobs_user_id_created_at_idx"
  ON "scraping_jobs"("user_id", "created_at");
CREATE INDEX "scraping_jobs_user_id_status_created_at_idx"
  ON "scraping_jobs"("user_id", "status", "created_at");
CREATE INDEX "scraping_jobs_retry_of_job_id_idx"
  ON "scraping_jobs"("retry_of_job_id");
CREATE INDEX "scraping_jobs_queue_job_id_idx"
  ON "scraping_jobs"("queue_job_id");
CREATE INDEX "leads_user_id_scraping_job_id_idx"
  ON "leads"("user_id", "scraping_job_id");
CREATE INDEX "leads_user_id_created_at_idx"
  ON "leads"("user_id", "created_at");

ALTER TABLE "scraping_jobs"
  ADD CONSTRAINT "scraping_jobs_retry_of_job_id_fkey"
  FOREIGN KEY ("retry_of_job_id") REFERENCES "scraping_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
