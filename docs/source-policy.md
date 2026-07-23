# Approved Source Policy

## Deny-By-Default Lifecycle

`ApprovedSource` is the authoritative database allowlist. New entries always
start as `REVIEW_REQUIRED`, `isEnabled=false`, and
`allowsAutomatedAccess=false`. API keys and other credentials are never stored
in this table; required credentials must exist in environment-backed secret
management using the source-specific key convention.

Statuses:

- `REVIEW_REQUIRED`: policy evidence is incomplete or a stop condition needs
  review.
- `APPROVED`: review prerequisites are complete; this does not enable a source
  unless `isEnabled` and `allowsAutomatedAccess` are also true.
- `DISABLED`: intentionally unavailable.
- `BLOCKED`: access is prohibited or a hard policy stop occurred.

Database constraints prevent an enabled non-approved source, a blocked source
with automation enabled, invalid request rates, and excessive concurrency.

## Approval Review

Before approval or enablement, a `SUPER_ADMIN` must record:

- reviewed source terms;
- a fixed safe `http` or `https` base URL when used;
- robots.txt review for public directories and official websites;
- explicit permission for automated access;
- low per-domain request and concurrency limits; and
- required credentials in secure environment/secret management.

URLs with embedded credentials are rejected. Users and queue payloads cannot
provide arbitrary destination URLs.

## Runtime Enforcement

Both API enqueueing and worker execution read the approved-source policy. The
worker revalidates immediately before transitioning a job to `RUNNING`, so a
source disabled after enqueue cannot execute. A blocked or review-required
source is treated as unrecoverable and is not retried automatically.

For the permitted HTTP adapter:

- requests stay on the configured approved origin, including redirects;
- a transparent descriptive `User-Agent` is sent;
- per-source requests-per-minute and concurrency limits are applied;
- robots.txt is checked before the page;
- `Retry-After` is honored up to a bounded delay;
- only two exponential retries are allowed for 429 and temporary 5xx errors;
- 401 and 403 stop immediately;
- CAPTCHA, login-wall, consent-wall, and explicit automation-prohibition
  indicators stop immediately;
- hard prohibitions mark the source `BLOCKED`;
- reviewable walls mark it `REVIEW_REQUIRED`; and
- response type, size, redirect count, timeout, job pages, and record counts are
  bounded.

The controls support respectful permitted crawling. They are not evasion
features.

## Explicitly Prohibited

The project must never implement CAPTCHA solving/bypass, login bypass, browser
fingerprint spoofing, request-pattern obfuscation, artificial stealth delays,
rotating or residential proxies used to evade restrictions, cookie theft,
restricted-account automation, 403/429 circumvention, or collection from
platforms that prohibit it without approved API access.

## Real Data And Fixtures

Normal development and production may persist only data obtained through
approved APIs, licensed datasets, government/open datasets, user-authorized
imports, official websites permitting automated public access, or approved
public directories.

The fictional fixture is limited to automated tests or explicit local test mode.
It requires `NODE_ENV=test` or
`SCRAPING_FIXTURE_SOURCE_ENABLED=true`; production workflows must keep the flag
false. The fixture never makes an external request.
