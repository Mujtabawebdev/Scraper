-- Enforce that a lead's direct owner always matches its originating job owner.
ALTER TABLE "leads"
  DROP CONSTRAINT "leads_scraping_job_id_fkey";

CREATE UNIQUE INDEX "scraping_jobs_id_user_id_key"
  ON "scraping_jobs"("id", "user_id");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_scraping_job_id_user_id_fkey"
  FOREIGN KEY ("scraping_job_id", "user_id")
  REFERENCES "scraping_jobs"("id", "user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
