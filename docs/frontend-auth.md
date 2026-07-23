# Frontend Authentication

## Scope

Phase 6 adds the React frontend foundation and authentication experience:

- Vite, React, strict TypeScript, and Tailwind CSS;
- a reusable accessible UI foundation;
- registration and password login;
- application authentication bootstrap;
- protected, public-only, and role-aware routing;
- a responsive authenticated dashboard shell;
- logout and logout-all controls;
- normalized API errors and user notifications; and
- isolated frontend tests with mocked API behavior.

It deliberately does not add scraping-job creation, a lead table, job history,
an admin panel, profile editing, password recovery, email verification,
subscriptions, payments, analytics, charts, or production deployment.

## Architecture

The web application is the `@lead-saas/web` npm workspace under `apps/web`.
Its feature-oriented structure separates application composition, shared UI,
authentication behavior, layouts, routes, and transport concerns:

```text
apps/web/src/
├── app/                 providers, router, Redux store, and QueryClient
├── components/          reusable UI, common, and feedback components
├── config/              validated public environment
├── features/auth/       API functions, hooks, forms, schemas, state, and types
├── layouts/             public authentication and dashboard shells
├── pages/               dashboard, placeholder, unauthorized, and not-found pages
├── routes/              protected, public-only, and role guards
├── services/            centralized credentialed API client
├── styles/              Tailwind and application styles
└── test/                shared test setup and helpers
```

Application providers install Redux, TanStack Query, React Router, global
notifications, and the one-time authentication bootstrap. Feature modules do
not read backend secrets or browser cookies.

## Responsibility Boundaries

### Redux Toolkit

Redux stores only global client authentication state:

- the current safe user projection;
- the short-lived access token;
- whether the user is authenticated; and
- whether initial authentication restoration is still running.

The auth slice exposes focused transitions such as `setCredentials`, `setUser`,
`clearAuth`, and `setInitializing`. The access token is intentionally
memory-only. No Redux persistence layer is installed, and auth state is not
copied to `localStorage`, `sessionStorage`, IndexedDB, or URL parameters.

### TanStack Query

TanStack Query owns server state and request lifecycle behavior:

- current-user retrieval;
- registration and login mutations;
- logout and logout-all mutations;
- loading and error state; and
- current-user cache invalidation or removal after an authentication change.

Authentication failures are not retried repeatedly. Redux is not used as a
general server cache, and Query data is not used to persist bearer tokens.

### API Client

The centralized Axios client:

- derives its base URL from validated `VITE_API_BASE_URL`;
- sends JSON and `withCredentials: true`;
- attaches the in-memory access token as a bearer credential;
- converts transport and API envelopes into safe typed frontend errors;
- never reads the refresh token;
- never logs passwords, authorization headers, cookies, or tokens; and
- excludes authentication endpoints from recursive refresh handling.

## Environment

Only these public browser values are required:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_NAME=US Business Lead SaaS
```

The API URL is validated as an HTTP or HTTPS URL. A missing or malformed URL
causes an explicit startup failure instead of silently sending credentials to
an unintended destination. `VITE_APP_NAME` is presentation text, not a security
boundary.

Never prefix backend JWT secrets, database settings, Redis credentials, or any
other secret with `VITE_`; Vite embeds such variables in browser assets.

## Authentication Bootstrap

Access-token memory is empty after a full browser reload. The application
restores the session once:

1. Mark authentication as initializing.
2. Send credentialed `POST /auth/refresh` without a token in the request body.
3. If successful, save the returned access token in Redux memory.
4. Send authenticated `GET /auth/me`.
5. Save the returned safe user projection.
6. Mark initialization complete.

If refresh or current-user loading fails, the app clears partial auth state and
finishes as signed out. A page loader remains visible during this sequence so a
protected route does not briefly redirect or expose authenticated UI. The
bootstrap guard prevents refresh calls on every render.

## Access Token Strategy

The API returns an HS256 access JWT in JSON after registration, login, and
refresh. The frontend keeps it only in application memory and adds it to the
`Authorization: Bearer` header for protected calls.

Memory-only storage reduces exposure to persistence theft and prevents stale
bearer credentials from surviving a browser restart. It does not make an
access token immune to an active cross-site scripting compromise, so the UI
must continue to avoid unsafe HTML injection and token logging.

When an ordinary API request receives `401`, the client:

1. retries only if the request has not already been retried;
2. joins a single shared `POST /auth/refresh` operation;
3. updates the in-memory access token;
4. retries the original request exactly once; and
5. clears auth state when refresh fails.

Sharing one in-flight refresh prevents concurrent `401` responses from rotating
the same backend session multiple times. Refresh, login, register, and logout
requests do not recursively invoke this interceptor, which prevents infinite
loops.

## Refresh Cookie

The refresh JWT remains exclusively in the backend-issued cookie:

- `HttpOnly` prevents JavaScript access;
- `Secure` is required in production;
- `SameSite` follows the reviewed deployment topology;
- its path is normally restricted to `/api/v1/auth`;
- its lifetime follows the backend refresh-session lifetime; and
- its domain is host-only unless explicitly configured.

Every relevant frontend request includes browser credentials, but frontend code
does not parse, copy, display, or persist the cookie. Registration, login, and
refresh responses must never expose a refresh token in JSON.

Local development uses `http://localhost:5173` for the UI and
`http://localhost:5000` for the API. The backend permits that exact frontend
origin with credentials. Production must use HTTPS, an explicit trusted CORS
origin, and `AUTH_COOKIE_SECURE=true`. Cross-site deployment with
`SameSite=None` requires secure cookies and a separately reviewed CSRF design.

## Registration And Login

The registration form validates:

- a normalized full name from 2 through 100 characters;
- a valid, normalized email address;
- a password from 8 through 128 characters containing uppercase, lowercase,
  number, and special characters; and
- a matching confirmation password.

Confirmation is frontend-only and is not sent to the API. Login accepts email
and password but presents a generic credential failure so the UI does not
create an email-enumeration oracle. Forms use proper labels, linked validation
messages, visible focus state, password visibility controls, disabled pending
states, and keyboard-compatible controls.

Successful registration or login stores the safe user and access token in
memory, invalidates stale current-user data, shows a notification, and
navigates to the dashboard. Passwords are never logged or retained after the
request.

## Route Protection

`ProtectedRoute` waits for bootstrap, renders authenticated content when a user
and access token are present, and otherwise redirects to `/login`. It preserves
an internal attempted destination so a successful login can return the user to
the requested route; external or malformed redirect targets are not trusted.

`PublicOnlyRoute` makes `/login` and `/register` available to signed-out users
and redirects authenticated users to `/dashboard`.

The root route chooses between `/login` and `/dashboard` after bootstrap. The
wildcard route renders the not-found page without leaking application internals.

## Role Protection

`RoleRoute` accepts the known `USER`, `ADMIN`, and `SUPER_ADMIN` roles. It first
requires authentication, then renders authorized content or redirects to
`/unauthorized`.

Frontend role checks improve navigation and user experience but are never an
authorization boundary. Every privileged backend action must independently
authenticate the active session and authorize the role and resource. Phase 6
does not create admin pages.

## Logout

Logout sends credentialed `POST /auth/logout`, then clears Redux authentication
state and relevant Query cache, navigates to `/login`, and notifies the user.
Local state is still cleared if the network call fails, so a failing request
cannot leave the interface appearing authenticated.

Logout-all sends the current access token to `POST /auth/logout-all`, which
revokes every active backend session for the user. It then performs the same
local cleanup. The browser cannot directly delete the path-scoped HttpOnly
cookie; backend logout endpoints clear it with matching attributes.

## Error Handling

The client converts rejected responses into a stable error containing a safe
status, code, message, and sanitized field issues when applicable. Pages map
known API codes to clear user-facing messages, including:

- `VALIDATION_ERROR`;
- `EMAIL_ALREADY_IN_USE`;
- `INVALID_CREDENTIALS`;
- `ACCOUNT_SUSPENDED`;
- `ACCOUNT_DISABLED`;
- `AUTHENTICATION_REQUIRED`;
- `INVALID_ACCESS_TOKEN`;
- `INVALID_REFRESH_TOKEN`;
- `INSUFFICIENT_PERMISSIONS`; and
- `AUTH_RATE_LIMIT_EXCEEDED` or the compatibility alias
  `RATE_LIMIT_EXCEEDED`.

Unknown, malformed, offline, and server errors receive a generic safe message.
Raw Axios responses, backend stacks, Prisma/JWT details, request headers, and
submitted credentials are not rendered or logged.

## Rate-Limit Compatibility

Register, login, and refresh are separately IP-rate-limited by the API. The
frontend does not automatically replay registration or login and displays a
friendly retry-later message for `429`. The single-flight refresh strategy
reduces unnecessary refresh traffic but does not attempt to bypass a limit.

Phase 5 rate limiting is process-local. A future backend phase may move its
counters to Redis for multi-instance coordination without changing the
frontend contract.

## UI And Accessibility

Shared controls use semantic HTML, visible focus styles, correct button types,
associated labels, and `aria` attributes where needed. Field errors are linked
to their inputs. Loading indicators communicate pending state without blocking
keyboard access unnecessarily, and the dashboard navigation remains usable on
small screens.

Dashboard metric cards are explicitly labelled as later-phase placeholders;
they do not present invented values as production analytics.

## Security Decisions And Limitations

- Access tokens exist only in memory.
- Refresh tokens remain inaccessible to frontend JavaScript.
- Browser credentials are sent only to the validated API base URL.
- Authentication data is not logged.
- Form and API errors are normalized before display.
- Refresh is coordinated and bounded to one retry.
- Client role guards never replace server authorization.
- Logout performs fail-closed local cleanup.
- The frontend does not include untrusted HTML rendering.

These controls reduce common exposure but cannot compensate for a compromised
browser, malicious extension, incorrect production CORS, insecure TLS
termination, or backend secret leakage. Content Security Policy, deployment
headers, cross-site CSRF analysis, monitoring, and dependency review remain
deployment responsibilities.

## Local Development And Validation

Install dependencies and run the full workspace checks:

```powershell
npm install
npm run typecheck
npm run build
npm run test
```

For integrated validation, configure `.env`, start dependencies, and run the API
and frontend in separate terminals:

```powershell
docker compose up -d postgres redis
npm run dev:api
```

```powershell
npm run dev:web
```

Open `http://localhost:5173` and verify:

1. registration and dashboard navigation;
2. page-reload restoration through the refresh cookie;
3. current-user rendering;
4. logout and logout-all;
5. subsequent login;
6. protected-route redirection;
7. generic invalid-login behavior;
8. duplicate-email feedback; and
9. responsive mobile navigation.

Frontend unit and component tests mock HTTP calls and do not require a running
backend. Integrated manual validation uses local PostgreSQL and Redis only.

## Excluded From Phase 6

The following remain future work:

- scraping-job creation and job-history UI;
- lead tables, searching, export, and lead management;
- admin and super-admin application pages;
- profile editing and profile images;
- forgot-password and reset-password workflows;
- email verification;
- OTP, MFA, two-factor, and social login;
- subscription plans, billing, and payments;
- real analytics and charts; and
- Nginx or production deployment configuration.

