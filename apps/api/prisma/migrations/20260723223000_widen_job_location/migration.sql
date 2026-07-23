-- Existing development databases may have applied the initial Phase 7 draft
-- with VARCHAR(100). Widening is data-preserving and makes the migration safe
-- for legacy city/state combinations before the public 100-character input cap.
ALTER TABLE "scraping_jobs"
  ALTER COLUMN "location" TYPE VARCHAR(255);
