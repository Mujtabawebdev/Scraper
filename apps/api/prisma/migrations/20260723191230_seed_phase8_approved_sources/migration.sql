-- Keep source-policy limits bounded even when records are changed outside the API.
ALTER TABLE "approved_sources"
  ADD CONSTRAINT "approved_sources_requests_per_minute_check"
    CHECK ("requests_per_minute" BETWEEN 1 AND 120),
  ADD CONSTRAINT "approved_sources_max_concurrency_check"
    CHECK ("max_concurrency" BETWEEN 1 AND 10),
  ADD CONSTRAINT "approved_sources_enabled_policy_check"
    CHECK (
      NOT "is_enabled"
      OR (
        "status" = 'APPROVED'
        AND "allows_automated_access"
      )
    ),
  ADD CONSTRAINT "approved_sources_blocked_policy_check"
    CHECK (
      "status" <> 'BLOCKED'
      OR (
        NOT "is_enabled"
        AND NOT "allows_automated_access"
        AND "blocked_reason" IS NOT NULL
      )
    );

-- Bootstrap only the two compiled Phase 4/7 adapters. The fixture remains
-- executable only in NODE_ENV=test or explicit fixture mode. The HTTP adapter
-- remains review-required until an administrator completes the policy record.
INSERT INTO "approved_sources" (
  "id",
  "key",
  "display_name",
  "source_type",
  "status",
  "is_enabled",
  "requires_api_key",
  "allows_automated_access",
  "requests_per_minute",
  "max_concurrency",
  "robots_policy_checked_at",
  "terms_reviewed_at",
  "review_notes",
  "created_at",
  "updated_at"
)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  'fixture-business-directory',
  'Fixture business directory',
  'FIXTURE',
  'APPROVED',
  true,
  false,
  true,
  120,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'Fictional local fixture. Restricted to automated tests and explicit fixture mode.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "approved_sources" (
  "id",
  "key",
  "display_name",
  "source_type",
  "status",
  "is_enabled",
  "requires_api_key",
  "allows_automated_access",
  "requests_per_minute",
  "max_concurrency",
  "review_notes",
  "created_at",
  "updated_at"
)
VALUES (
  '00000000-0000-4000-8000-000000000102',
  'permitted-http-directory',
  'Approved development directory',
  'PUBLIC_DIRECTORY',
  'REVIEW_REQUIRED',
  false,
  false,
  false,
  10,
  1,
  'Administrator review, robots policy, source terms, and secure environment configuration are required.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
