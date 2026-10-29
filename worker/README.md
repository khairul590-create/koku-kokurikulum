# Local D1 backend handoff

`worker/index.ts` exports the Hono Worker and structural `Env` types. Existing `api/`, React, Supabase SQL, package files and root configuration are unchanged.

## Required Wrangler configuration (parent owns root config)

```jsonc
{
  "name": "<existing-or-approved-worker-name>",
  "main": "worker/index.ts",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api", "/api/*"]
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "<approved-database-name>",
    "database_id": "<actual-cloudflare-database-id>",
    "migrations_dir": "migrations"
  }]
}
```

Required secret bindings: `ADMIN_PASSWORD`, `JWT_SECRET`. There is no development JWT-secret fallback. Local `.dev.vars` must be private/untracked. `BUCKET` is an optional R2 binding, unused by this port; no upload/download/OPR routes or public R2 URLs were introduced. No `nodejs_compat` flag is required by the Worker.

Use a compatibility date supported by the installed Wrangler/workerd; the installed local workerd rejected `2026-10-01` and accepted `2026-09-01`. Build `dist` before running a root configuration with static assets.

## Local verification

```sh
node tests/test-worker.mjs
# Standalone typecheck when the tsc CLI is permitted on the host:
npx --no-install tsc --noEmit --strict --skipLibCheck --target ES2020 --lib ES2020,DOM,DOM.Iterable --module ESNext --moduleResolution bundler worker/index.ts
# With the parent's configured local database:
wrangler d1 migrations apply <approved-database-name> --local
wrangler dev --local
```

The integration test uses installed TypeScript through its compiler API, then real Wrangler/workerd and real SQLite D1. It creates an isolated temporary config, random local-only credentials and fictional test records, never accesses a remote database, uses one server at a time, restarts it to verify persistent throttling, verifies HTTPS cookie attributes, and removes its state. `WRANGLER_BIN` can specify an existing executable. No install or package changes are needed.

## Compatibility / migration boundaries

- Do not cut over until the original database and storage backup is retrieved and verified. This local port does not retrieve source credentials, back up source data, create resources, commit, push or deploy.
- `migrations/0001_kokurikulum.sql` has **no business data or settings seed**. Import exact source IDs, timestamps, nullable FKs and the source settings singleton. Store `settings.data` as JSON text and attendance `present` as SQLite `0/1`; API responses convert back to objects/booleans. Existing timestamp strings are preserved verbatim on import; new timestamps are UTC ISO strings.
- Settings GET returns `{}` when the singleton is absent; PUT returns 400 until that source row is imported, matching the original update-only behavior.
- CRUD schemas/defaults, equality filters, `q` wildcards, unpaged 1000-row arrays, paged objects, joins/projections and both report shapes are retained. Null ordering matches PostgreSQL, with an ID tie-breaker for reliable paging. SQLite's built-in case-insensitive LIKE covers ASCII, not PostgreSQL's locale-dependent non-ASCII case folding.
- Dashboard JSON is computed by the native `dashboard_stats` SQLite view over all rows, not by capped list fetches. Unit/student reports likewise aggregate all matching rows. PAJSK partial updates compute total/grade in the same UPDATE from supplied marks plus current persisted marks, including concurrent updates.
- All data routes require a signed admin JWT. Unsafe requests require an exact matching `Origin`; missing/null/cross-origin origins are rejected, including login/logout. The React same-origin fetch calls require no changes. HTTPS uses `__Host-koku_session; Secure; HttpOnly; SameSite=Strict; Path=/`; the plain development cookie is limited to HTTP localhost/loopback.
- Login throttling is an atomic persistent D1 reservation: 10 attempts per 10 minutes, keyed only from hashed `cf-connecting-ip` (shared fail-closed key if absent), reset on success or expiry. No forwarded-IP fallbacks or process-local counter. Existing sessions minted on another host are intentionally not portable.
- Database errors retain JSON `{error}`/status semantics and friendly duplicate/FK messages, but no raw SQL or internal database details are returned. Original Vercel API files remain intact for rollback.
