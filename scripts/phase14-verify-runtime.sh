#!/usr/bin/env bash
set -euo pipefail
# EXPLICITLY DISPOSABLE, isolated PostgreSQL 17 only. Does not start containers or migrate production.
if [[ "${BOOKCORE_TEST_DATABASE_DISPOSABLE:-}" != yes ]]; then
 echo 'BLOCKED: BOOKCORE_TEST_DATABASE_DISPOSABLE=yes is mandatory for database integration' >&2; exit 2
fi
if [[ ! -f package-lock.json ]]; then echo 'BLOCKED: authentic npm lockfile missing' >&2; exit 2; fi
: "${MIGRATION_DATABASE_URL:?dedicated disposable migration URL required}"
: "${DATABASE_URL:?separate disposable runtime URL required}"
if [[ "$MIGRATION_DATABASE_URL" == "$DATABASE_URL" ]]; then
 echo 'BLOCKED: migration and runtime credentials must differ' >&2;exit 2
fi
node scripts/verify-manifest.cjs
npm ci --no-audit --no-fund
npm run verify:reference
npm run verify:static
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run migrate
npm run migrate
npm run test:integration
npm run openapi:current
# Only an actual successful command sequence is allowed to return status zero.
