# BookCore Backend

See `BOOKCORE_RELEASE_GATE_MATRIX.md` for the current verification results. The phase-specific instructions below preserve the earlier engineering history.

## Clean local verification

```bash
npm install --package-lock-only --no-audit --no-fund
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:phase08:isolated
```

Start PostgreSQL 17 with the Compose stack in `infra/docker/compose.yml`; set `PG_DEV_OWNER_PASSWORD`, `PG_DEV_APP_PASSWORD`, `PG_DEV_WORKER_PASSWORD`, and the existing API environment variables **in your local shell**, not in source control. Before running API/worker, run `npm run migrate` with `MIGRATION_DATABASE_URL` set to the owner connection. Run `npm run migrate` twice to check migration checksums. Run `npm run test:integration` with separate owner/API/worker URLs, and inspect actual committed rows. Do not use the migration-owner credential for the API or worker.

Start outbox worker after migration: `npm run outbox:worker`; in Docker use `docker compose -f infra/docker/compose.yml --profile worker up -d worker`. On SIGTERM it completes the active batch and closes the PostgreSQL pool; do not imply external message delivery. The worker persists an internal delivery receipt only. See `docs/outbox/WORKER_OPERATIONS_FA.md` for runbook.

# BookCore — Phase 06 Session Scheduling (source implementation candidate)

Phase 06 adds Session Scheduling to the existing NestJS Modular Monolith. **No production validation is claimed**. Real PostgreSQL, npm and GitHub Actions verification remain outstanding. See `docs/engineering/PHASE_06_FINAL_REPORT_FA.md`.

## Phase 06 routes

- Staff: `POST/GET /api/v1/organizations/{orgId}/sessions`, `GET /{sessionId}`, `POST /{sessionId}/publish`, `POST /{sessionId}/cancel`, `POST /{sessionId}/finish`, `PATCH /{sessionId}/capacity`
- Public: `GET /api/v1/public/organizations/{orgId}/sessions` and `GET /{sessionId}`
- Cancel/Capacity require a UUID `Idempotency-Key` header; on unknown commit retry the **same** key and payload.

## Local verification (operator with PostgreSQL 17 and npm connectivity)

```bash
npm install --package-lock-only --ignore-scripts
npm ci
npm run verify:reference && npm run verify:static
npm run test:availability:isolated && npm run test:session-domain:isolated
npm run typecheck && npm run lint && npm run build
# Set development-only database owner/runtime URLs and provision bookcore_app role from infra
npm run migrate && npm run migrate
npm run test:unit && npm run test:integration
npm run openapi:current
python3 scripts/phase06_contract_check.py
```

The original archive is preserved at `reference/Phase_05/`. All original migrations 001–006 remain unchanged; `007_session_permissions.sql` is additive. The existing Phase02/03/04/05 reference materials and tests are retained. The generated OpenAPI JSON is a **current-implementation** artifact, distinct from the authoritative future design YAML.

---

# BookCore — Phase 05 Catalog, Resources & Availability Rules

**Implementation source candidate; NOT production-verified.** Preserves original Phase 01/02/03 engineering history. No Booking HTTP API, payment or waitlist added.

## Phase 05 changes

Existing Phase 05 Identity/Organizations stay intact. New protected CRUD: branches, services, resources, business-hours, schedule-exceptions (12 endpoints). Migration 006 is additive; no Session/Booking HTTP routes added. Pure availability returns rule-level decisions only; capacity and PostgreSQL GiST checks remain separate.

See `docs/scheduling/AVAILABILITY_RULES_FA.md` and `docs/security/PHASE_05_AUTHORIZATION_FA.md`.

## Implemented route surface
`/api/v1/health/live`, `/health/ready`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/me`, `/organizations`, `/organizations/:orgId`, `/organizations/:orgId/members`, `/organizations/:orgId/members/:userId` (GET/POST/PATCH as documented in `docs/api/PHASE_04_API_CONTRACT.md`).

## Operator prerequisites
Node 22.16+, npm access, PostgreSQL **17**, Docker Compose optional. **A genuine `package-lock.json` must be generated** by resolving dependencies. The current execution environment lacked usable registry access, so no fake lockfile is shipped. Authenticated CI cannot pass until this requirement is met.

### Clean-room commands
```bash
cd bookcore
# Generate REAL distinct secrets for local testing; never commit secrets to Git:
cp .env.example .env
# Set PG_DEV_OWNER_PASSWORD, PG_DEV_APP_PASSWORD, MONITOR_API_KEY,
# AUTH_JWT_KEYS_JSON, AUTH_JWT_ACTIVE_KID, AUTH_JWT_ISSUER, AUTH_JWT_AUDIENCE.
# Do not use placeholders in actual runs.
npm install --package-lock-only --ignore-scripts --no-audit
npm ci
npm run verify:reference && npm run verify:static
npm run test:availability:isolated # dependency-free real pure TS checks
npm run typecheck && npm run lint && npm run build
# PostgreSQL 17 must be running. app runtime role created before migration.
# Option A: use Postgres container:
docker compose -f infra/docker/compose.yml up -d postgres
# The postgres container init-db.sh provisions `bookcore_app` on first launch.
# Option B: provision the role yourself in test DB.
# Use MIGRATION_DATABASE_URL (owner credential) ONLY for migrations.
npm run migrate
npm run migrate # verifies the checksums
npm run test:unit
npm run test:integration
npm run openapi:current
# To start API with limited DATABASE_URL role:
npm run start
```

Environment variables are NOT automatically loaded by plain Node; provide variables via the shell, `docker compose --env-file`, or a local env launcher. If using Docker for migration:
```bash
docker compose --env-file .env -f infra/docker/compose.yml --profile maintenance run --rm migrate
docker compose --env-file .env -f infra/docker/compose.yml up -d api
```

`/health/live` is public. `/health/ready` is limited by direct peer IP + monitoring credential. The public auth endpoints have PostgreSQL rate limiting; all other routes use one global DB-backed JWT guard. `GET /me` includes only active staff memberships. Passwords are Argon2id hashes, refresh records store only SHA-256 verifiers.

## Deliverables and provenance
- `apps/api/src/modules/identity/` and `organizations/`: real source implementations.
- `db/migrations/001–004`: unchanged Phase02 originals. `005_identity_security.sql`: additive schema and role grants.
- `docs/api/openapi.yaml`: Phase 01 MVP design, not 38 implemented routes. `npm run openapi:current`: implemented-only Swagger generator (requires dependencies).
- `apps/api/test/unit/`, `integration/`: source tests including real PG tests, no mocks for concurrency.
- `reference/Phase_02/`: preserved Phase02 original and reference documents.
- `docs/verification/DEFERRED_TEST_REGISTER.md`: explicit unresolved release obligations.
- `evidence/phase04/`: actual local checks and blocked-runtime command output.

## Environment limitation at authoring time
PostgreSQL/Docker executable unavailable, npm Registry not accessible; genuine lockfile, NestJS runtime/typecheck, CI and DB migration tests remain unverified. This is a deliverable for further execution, **not a verified runnable release**. See `docs/engineering/PHASE_04_FINAL_REPORT_FA.md`.


## Phase 07 — Booking Engine (source candidate; no PostgreSQL runtime proof)

The new `apps/api/src/modules/booking/` implements self-booking, capacity updates, replayable idempotency, customer history, self/staff cancellation, attendance and Outbox/Audit. It relies on Migration `008_booking_permissions.sql`; never modify 001–007. Staff-created bookings by `customerId` are intentionally rejected until customer consent is implemented. Neither booking nor attendance is production-validated.

### Commands on a computer with Node 22, npm Registry and PostgreSQL 17

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --no-audit --no-fund
npm run verify:reference
npm run verify:static
npm run test:availability:isolated
npm run test:session-domain:isolated
npm run test:booking:isolated
python3 scripts/phase07_contract_check.py
npm run typecheck
npm run lint
npm run build
# Provision bookcore_app with migration-owner credentials first (infra/docker/init-db.sh).
npm run migrate
npm run migrate
npm run test:unit
npm run test:integration
```

Use `.env.example` for the required non-production configuration; configure `DATABASE_URL` as the restricted runtime role and `MIGRATION_DATABASE_URL` as the migration owner. Do not print real secrets to logs. Docker Compose path: `infra/docker/compose.yml` (the image is pinned). A separate worker source `apps/api/test/integration/phase07-api-worker.cjs` runs two *independent NestJS processes* in concurrency tests. `npm run test:integration` fails without real database configuration; it never silently skips.

**Warning:** A legitimate `package-lock.json` could not be generated in the current restricted environment. The new GitHub Actions Phase07 workflow cannot pass `npm ci` until an operator creates and commits a genuine lockfile. Never generate fake package integrity hashes. Unexecuted PostgreSQL tests must stay `NOT VERIFIED`.

## Phase 09 — Security Governance (source candidate, not runtime verified)

New authenticated endpoints: `/organizations/{orgId}/staff-invitations`,
`/me/staff-invitations/accept|decline`, and `/organizations/{orgId}/booking-consents`.
Direct `POST /members` now fails closed with `409 STAFF_INVITATION_REQUIRED` after checking
admin authorization. An administrator creates an invitation for a pre-existing global user;
the **one-time token** is returned to the administrator once and must be transported over
an independently secured channel. Only that authenticated user can activate membership.

Customers may grant or revoke a short-lived tenant-scoped mandate for authorized staff to
book on their behalf. The booking transaction rechecks membership, active customer status,
before Idempotency claim, and checks the active mandate for NEW transactions before capacity is reserved. Replaying an already-committed result creates no new side effect.

Use `npm run test:phase09:isolated` for pure policy tests and `npm run test:integration` for real PostgreSQL tests. Migrations `001–009` are immutable; apply
`010_security_governance.sql` as migration owner. `npm ci` requires a legitimate npm-generated
`package-lock.json` and registry access; the archive does not invent one.

Operator-only quarantined event tools (no HTTP endpoint): `npm run outbox:recovery -- list TENANT_UUID` and `npm run outbox:recovery -- retry TENANT_UUID EVENT_UUID 'Operator justification at least ten chars'`. Set `OUTBOX_OPS_DATABASE_URL` to a dedicated
`bookcore_ops`-member login with limited privileges; **never use DATABASE_URL** or migration
owner credentials. These commands must be run after compiling `dist` and applying migrations.

For lost refresh-token rotation responses or unknown commit, request fresh credentials
through normal login; blindly resubmitting a consumed token can trigger family revocation.
The Outbox `published_at` column currently means **internally processed and receipted**;
external email/SMS/webhook delivery has not been built or verified.

## Phase 10 — operational integrity, inspection & restricted maintenance

Source implementation includes additive `011_operational_integrity.sql`, bounded read-only Tenant inspector,
operator-bound Outbox requeue and batched legacy rate-bucket cleanup. This is **not a production certification**.

All privileged operations require a real, personally attributable PostgreSQL LOGIN (not the HTTP app user),
an out-of-band `bookcore_operator_identities` registration, and appropriate NOLOGIN group membership.
No operational credential, password or private key is included here.

After installing genuine dependencies and migrating with MIGRATION_DATABASE_URL, examples:

```bash
npm run migrate
npm run migrate
npm run test:phase10:isolated
npm run verify:static
# Each operational URL must be configured securely by the deployment operator:
BOOKCORE_INSPECT_DATABASE_URL="$INSPECTOR_URL" npm run ops:inspect -- "$TENANT_UUID" 50
BOOKCORE_MAINTENANCE_DATABASE_URL="$MAINTENANCE_URL" npm run ops:maintenance -- preview 50 48 'Approved retention inspection'
BOOKCORE_MAINTENANCE_DATABASE_URL="$MAINTENANCE_URL" npm run ops:maintenance -- apply 50 48 'Approved old bucket cleanup'
OUTBOX_OPS_DATABASE_URL="$OPERATOR_URL" npm run outbox:recovery -- list "$TENANT_UUID"
OUTBOX_OPS_DATABASE_URL="$OPERATOR_URL" npm run outbox:recovery -- retry "$TENANT_UUID" "$EVENT_UUID" 'Reviewed and approved event retry'
```

Inspectors cannot automatically repair Booking/Session/counter/history drift. The domain integrity scanner
is bounded and reports `completeScan:false`. Idempotency record deletion is disabled pending a stakeholder
retention decision. `prune-auth-rate-limits` legacy unbounded helper is intentionally disabled.
Read `docs/operations/OPERATOR_IDENTITY_FA.md` before provisioning independent operational roles.

**Unverified:** PostgreSQL 17 SQL, Role grants, `npm ci`, full Typecheck/Build/ESLint, NestJS/PostgreSQL
integration, CI and deadlock/failure recovery. These remain blocked until clean runtime execution.


## Phase 11 — MVP Integration and bounded paged inspection (source candidate)

The original 001–011 migration checksums are unchanged. The additive `012_integrity_inspection_paging.sql`
introduces `event_order`-based BookingEvent diagnostics, permission-bound pagination over six tenant
collections, and a sample-only compatibility wrapper for the Phase10 inspector. **The new SQL has
not been executed on PostgreSQL in this source-only environment.**

After provisioning separate PostgreSQL 17 migration owner, runtime, worker, and per-person inspector LOGINs,
creating a genuine npm lockfile using the real registry, and building:

```sh
npm ci
npm run typecheck && npm run lint && npm run build
npm run migrate && npm run migrate
npm run test:phase11:isolated
npm run test:unit && npm run test:integration
# Configure BOOKCORE_INSPECT_DATABASE_URL and BOOKCORE_INSPECTION_CURSOR_KEY via secrets manager.
# BOOKCORE_INSPECTION_CURSOR_KEY is Base64URL of 32+ cryptographically random bytes.
npm run ops:inspect:paged -- --tenant "$TENANT_UUID" --all --limit 50 --max-pages 20
# Resume an incomplete kind from its signed cursor:
npm run ops:inspect:paged -- --tenant "$TENANT_UUID" --kind BOOKING --limit 50 --max-pages 20 --cursor "$BOOKING_CURSOR"
```

`--all` reports full keyset coverage only when no Kind is incomplete; `consistentSnapshot:false`
and `certifiedIntegrity:false` remain explicit. Concurrent updates can change results across pages.
No automatic Booking/Event repair occurs. The legacy `ops:inspect` is preserved as a strictly incomplete
sample-only diagnostic, **not** a full reconciliation tool.

`docs/integration/API_IMPLEMENTATION_MATRIX.json` is source-derived (46/46 method-path matches),
not an executed NestJS route map. `apps/api/test/integration/phase11-mvp-http.test.ts` traces the
full workflow; `phase11-postgres.test.ts` tests inspector security and pagination on a disposable PG17 DB.
The database tests fail closed unless `BOOKCORE_TEST_DATABASE_DISPOSABLE=yes` and dedicated role URLs
are set. Run all deferred Phase02–10 tests before considering any release. There is no production approval.

## Phase 12 — Data protection and recovery tools (source candidate)

Tooling lives in `scripts/recovery/` and works with Node 22 plus **official** PostgreSQL 17 executables on the operator host. The API does not run backups or restore at startup. Backups must be stored off-repository in a 0700 directory and require a separate `PGUSER`/`PGPASSFILE` or secrets-manager supplied connection.

```bash
# Pure tests work without npm dependencies:
node scripts/test-phase12-pure.cjs
# Use Node 22 and official pg_dump/pg_restore + optional age after operator setup:
node scripts/recovery/backup.cjs --dir /secure/bookcore-backups --retention 30
node scripts/recovery/verify-backup.cjs --manifest /secure/bookcore-backups/NAME.dump.manifest.json
node scripts/recovery/restore.cjs --manifest /secure/bookcore-backups/NAME.dump.manifest.json --target-db bookcore_restore_sandbox
node scripts/recovery/retention-preview.cjs --dir /secure/bookcore-backups
node scripts/recovery/storage-growth.cjs
```

**Restore dry-run by default.** Real Restore only to an explicitly approved, local, empty, comment-marked PostgreSQL 17 disposable database with an authenticated dedicated operator; see `docs/reliability/RESTORE_PROCEDURE_FA.md`. No PITR implementation, automated production backup schedule, or real recovery proof is claimed. `docs/reliability/RECOVERY_ACCEPTANCE_FA.md` is the release gate checklist. SQL migrations 001–012 are unchanged; Phase 12 does not need a migration 013.


## Phase 13 — Metrics, performance and recovery hardening

- Protected Prometheus endpoint: `GET /api/v1/internal/metrics` (X-BookCore-Monitor-Key + socket IP allowlist); never public.
- `MAX_INFLIGHT_REQUESTS=64` default for pre-transaction 503 overload admission (per-process).
- Source-only tests: `npm run test:phase13:isolated` (requires Node 22 and globally available or installed TypeScript).
- Database load test after clean install/migrations: `npm run perf:booking:postgres` (two independent Nest processes and 6 capacity rounds).
- Backup producer: `npm run ops:backup -- --dir /private/backup-folder`; recovery verifier: `npm run ops:backup:verify -- --manifest /private/backup/FILE.manifest.json`. For encrypted backup, Producer needs **recipient public key only**, verifier needs private age identity.
- Actual Restore into a separately provisioned disposable PostgreSQL 17 instance is prohibited until operator/target/credential/isolation safeguards are validated; see `docs/reliability/PHASE_13_BACKUP_RESTORE_HARDENING_FA.md`.
- `package-lock.json` was not fabricated; Typecheck/build and database release gates remain pending in restricted environments.


## Phase 14 — Runtime verification candidate (not production-ready)

Read `docs/engineering/PHASE_14_FINAL_REPORT_FA.md`. Use `node scripts/phase14-runtime-preflight.cjs` (read-only).
Generate an authentic npm lockfile with registry access, then follow `docs/runtime/CLEAN_BUILD_VERIFICATION_FA.md`.
For a separately authorized disposable PostgreSQL 17 instance see `infra/docker/compose.phase14.disposable.yml` and `scripts/phase14-verify-runtime.sh`.
For the booking contention acceptance regression run `npm run test:phase14:isolated` (Pure only).
Historical PostgreSQL/NestJS/Backup/Restore runtime requirements remain unverified.

## Final remediation verification

The current results are recorded in `BOOKCORE_RELEASE_GATE_MATRIX.md`. Use Node 22 and a fresh disposable PostgreSQL 17 database. The non-recovery workflow in `.github/workflows/backend-phase15.yml` shows the required synthetic environment and the separate database logins.

Run `npm ci`, `npm run typecheck`, `npm run lint` and `npm run build`. Apply `npm run migrate` twice with the migration login. Run `npm run test:unit`, `npm run test:database` and `npm run test:concurrency`. Use a fresh database for a complete rerun so earlier requests do not share rate-limit state with the current run. Regenerate the implemented contract with `npm run openapi:current` and compare it with the design contract using `python tools/phase09_validate_openapi.py docs/api/implemented.openapi.json` (PyYAML required).

The recovery workflow has a separate protected environment and a separately approved encrypted synthetic fixture. Its setup is documented in `docs/reliability/RECOVERY_ACCEPTANCE_FA.md`. The release manifest covers exact file bytes. Run `npm run manifest:freeze` after intentionally updating the release contents and `npm run verify:release-manifest` before packaging.

## License

BookCore is licensed under the [MIT License](LICENSE). Third-party material remains subject to its existing terms.

For login rate limiting behind a dedicated ingress, set AUTH_RATE_LIMIT_PROXY_IPS to its exact TCP peer addresses. The ingress must discard incoming X-Forwarded-For and write one client IP observed at the trust boundary. Keep this setting empty for direct connections. An allowlisted peer with a missing, chained or malformed value is denied. TRUSTED_PROXY_HOPS does not grant trust to this header in auth rate limiting.
