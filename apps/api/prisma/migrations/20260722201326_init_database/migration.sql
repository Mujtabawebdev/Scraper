-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'VERIFIED', 'INVALID', 'DUPLICATE', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "PhoneType" AS ENUM ('LANDLINE', 'MOBILE', 'VOIP', 'TOLL_FREE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('GOVERNMENT_DIRECTORY', 'BUSINESS_DIRECTORY', 'COMPANY_WEBSITE', 'LICENSED_API', 'USER_IMPORT', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_jobs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'United States',
    "state" VARCHAR(100),
    "city" VARCHAR(120),
    "category" VARCHAR(150),
    "search_query" VARCHAR(500),
    "requested_limit" INTEGER NOT NULL,
    "collected_count" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "phone_raw" VARCHAR(50),
    "phone_normalized" VARCHAR(20),
    "phone_type" "PhoneType" NOT NULL DEFAULT 'UNKNOWN',
    "email" VARCHAR(320),
    "website" VARCHAR(2048),
    "domain" VARCHAR(253),
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(120),
    "state" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(100) NOT NULL DEFAULT 'United States',
    "category" VARCHAR(150),
    "source_type" "SourceType" NOT NULL,
    "source_name" VARCHAR(150) NOT NULL,
    "source_url" VARCHAR(2048) NOT NULL,
    "source_external_id" VARCHAR(255),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "is_public_business_contact" BOOLEAN NOT NULL DEFAULT true,
    "collected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "scraping_job_id" UUID NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255),
    "metadata" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "scraping_jobs_status_idx" ON "scraping_jobs"("status");

-- CreateIndex
CREATE INDEX "scraping_jobs_created_by_id_idx" ON "scraping_jobs"("created_by_id");

-- CreateIndex
CREATE INDEX "scraping_jobs_created_at_idx" ON "scraping_jobs"("created_at");

-- CreateIndex
CREATE INDEX "leads_phone_normalized_idx" ON "leads"("phone_normalized");

-- CreateIndex
CREATE INDEX "leads_domain_idx" ON "leads"("domain");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_city_state_idx" ON "leads"("city", "state");

-- CreateIndex
CREATE INDEX "leads_category_idx" ON "leads"("category");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_source_type_idx" ON "leads"("source_type");

-- CreateIndex
CREATE INDEX "leads_scraping_job_id_idx" ON "leads"("scraping_job_id");

-- CreateIndex
CREATE INDEX "leads_collected_at_idx" ON "leads"("collected_at");

-- CreateIndex
CREATE INDEX "leads_source_external_id_idx" ON "leads"("source_external_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_scraping_job_id_fkey" FOREIGN KEY ("scraping_job_id") REFERENCES "scraping_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
