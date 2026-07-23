# Lead Explorer

## Ownership And Safe DTOs

Each persisted lead stores the same authenticated `userId` as its originating
scraping job. Repository queries always start with that tenant predicate;
deduplication is tenant-scoped as well, so another user's matching business
cannot suppress or reveal data.

The API maps Prisma records to explicit public DTOs. List responses include
business contact and display fields only. Detail responses add the composed
address, source URL, related job ID, and timestamps. Internal phone
classification, normalization implementation details, deduplication fields,
and raw Prisma objects are not returned.

An unknown lead and another user's lead both return `LEAD_NOT_FOUND` with HTTP
404.

## Search, Filters, And Sorting

`GET /api/v1/leads` performs all data operations in PostgreSQL. Supported query
parameters are:

- `page` and `pageSize` (default 1 and 25, maximum 100);
- `search`;
- `jobId`, `source`, `category`, `city`, and `state`;
- `hasPhone`, `hasEmail`, and `hasWebsite`;
- `sortBy` and `sortOrder`; and
- `createdFrom` and `createdTo`.

Search covers business name, phone, email, website, city, and state. Sort fields
are restricted to `createdAt`, `businessName`, `city`, `state`, and `source`.
Responses provide `totalItems`, `totalPages`, and next/previous page flags.
The frontend keeps normalized filters in URL query parameters, debounces text
search, and never downloads the complete dataset for local filtering.

## Lead Detail

`GET /api/v1/leads/:leadId` powers the authenticated detail page. HTTP/HTTPS
source and website links open with `target="_blank"` and
`rel="noopener noreferrer"`. Phone and email may be rendered as `tel:` and
`mailto:` links; the application never contacts a business automatically.

## CSV Export

`GET /api/v1/leads/export.csv` reuses the same validated, ownership-scoped
filter builder as the list endpoint. The browser sends the bearer token through
the authenticated API client, never a query-string token, and requests a Blob.
The filename is taken from a sanitized `Content-Disposition` value when
available.

The response is `text/csv; charset=utf-8` and starts with a UTF-8 byte-order
mark for spreadsheet compatibility. Every value is quoted, embedded quotes are
doubled, and formula-capable cells are prefixed with an apostrophe when the
first meaningful character is `=`, `+`, `-`, or `@`. Leading tab/newline
control characters receive the same protection.

Synchronous export has a fixed row ceiling. The repository requests one row
beyond that ceiling; an oversized result returns `EXPORT_LIMIT_EXCEEDED`
instead of silently truncating data. Asynchronous large exports are future
work.

## Cache And UI Behavior

TanStack Query owns lead list/detail server state. Redux remains limited to
authentication. The explorer provides responsive overflow, accessible labels
and actions, loading skeletons, empty and retry states, server pagination, and
filter-aware CSV export. Job completion invalidates relevant lead caches so
newly collected rows become visible without storing a duplicate client-side
copy.

## Current Limitations

Phase 7 does not add saved lists, bulk edits, lead purchasing, contact
automation, CRM integration, phone validation, email verification, team
sharing, charts, or asynchronous exports.
