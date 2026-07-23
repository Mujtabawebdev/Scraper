# Permitted Scraping Proof Of Concept

## Adapter Architecture

`BusinessScraper` defines a typed source adapter contract. `ScraperRegistry` registers only compiled, allowlisted adapters and never loads arbitrary code or payload URLs. `fixture-directory` is always available. `permitted-http-directory` is registered only when `SCRAPING_EXTERNAL_SOURCE_ENABLED=true` and `SCRAPING_APPROVED_BASE_URL` is configured after administrator review.

## Fixture Adapter

The default adapter parses `us-business-directory.html` with Cheerio. Its 20 records are fictional and use reserved/test-style phone numbers and `.example` domains. The fixture intentionally includes missing values, invalid formats, an empty name, and a duplicate. It performs no internet request.

## Controlled HTTP Adapter

The optional adapter uses one administrator-approved origin. It does not accept a URL in the API or queue payload, submit forms, send cookies/authorization, execute JavaScript, use proxies, log in, or follow cross-origin redirects. Responses must be HTML, are limited to 2 MB, time out after 10 seconds by default, and use at least a 1.5-second delay. Page count is capped at five.

Before HTML access, `/robots.txt` is fetched for the configured user agent and cached for ten minutes. Missing, unreadable, or ambiguous policy fails closed. Robots permission is an additional technical safeguard, not a substitute for source terms, authorization, privacy review, or applicable law.

## Normalization

- Names and addresses are trimmed and repeated whitespace is collapsed; empty names are rejected.
- U.S. phone syntax is parsed with `libphonenumber-js`; valid numbers store E.164 while raw input is preserved. Invalid numbers receive no normalized value and are never represented as reachable.
- Emails are lowercased after basic syntax validation. No deliverability claim is made.
- Websites permit only HTTP/HTTPS, remove fragments, and derive a lowercase domain.
- Two-letter state codes are uppercased. Country defaults to `United States`.

## Deduplication And Persistence

In-batch and database checks use these priorities: source identity, domain plus business/city, phone plus business name, then business name plus address/postal code. A shared phone alone never rejects a different business. Redundant rows are skipped instead of persisted as `DUPLICATE` leads.

Accepted leads are saved as `NEW`, linked to the originating `ScrapingJob`, marked as public business contacts, and retain source type, name, URL, optional external ID, and collection timestamp. Writes are bounded per record rather than one unbounded transaction.

## Status And Retry Behavior

The BullMQ worker moves jobs through `QUEUED`, `RUNNING`, and `COMPLETED`, synchronizing progress and counters. Skipped invalid/duplicate records contribute to the current `failedCount` compatibility field and typed result `skippedCount`. BullMQ retains three-attempt exponential retry behavior; only final exhaustion marks the database job failed.

## Prohibited Sources And Techniques

Google Maps, Yelp, LinkedIn, Facebook, login-protected sources, uncertain sources, and CAPTCHA-protected pages are unsupported. CAPTCHA/login bypass, anti-bot evasion, fingerprint spoofing, proxy rotation, identity rotation, and collection of private personal information are prohibited. A blocked or uncertain source stops safely without circumvention.

## Current Limits And Future Work

This POC caps each request at 100 records and local concurrency at the configured worker limit. It does not implement production crawling, distributed rate-limit coordination, source-specific legal policy records, transactional outbox delivery, phone reachability, email verification, or browser automation. Those require separate reviewed phases.
