# ADR-020 — Real NestJS foundation while PostgreSQL gates remain deferred

**Date:** 2026-11-22 — **Status:** provisional implementation decision; security review and runtime proof required.

## Context

The project owner authorizes Phase 03 implementation despite Phase 02 PostgreSQL Gate G1–G7 remaining `NOT VERIFIED` and G8 `FAIL`. This is a sequencing decision, **not evidence or a waiver**. Prior ADR-011..019 remain the design and spike references.

## Decision

1. Build a small NestJS Modular Monolith with only the two health routes. No booking HTTP API or fake JWT/authorization provider.
2. Keep existing SQL migrations exactly byte-for-byte as *provisional candidates*. Do not mutate history or treat them as production-approved.
3. Introduce a SQL-first connection pool and transaction client abstraction; no ORM rewrite before a genuine PostgreSQL technical spike.
4. Surface `UnknownCommitOutcome` for ambiguous COMMIT acknowledgements. Domain use cases that retry must use a durable Idempotency-Key; retries of business callbacks with external side effects are forbidden.
5. Keep Phase 01's full OpenAPI design separate from the two-route generated implementation surface.
6. Runtime role differs from migration owner; least-privilege write grants and RLS/tenant authorization are **not implemented** yet.
7. Preserve the Phase 02 ZIP and its original executable spike separately for later independent runtime checks.

## Consequences / risks

Application source may compile only after genuine npm dependency resolution. Runtime security/transaction claims cannot become PASS through static review. Integration gate remains required. There is no approved production deployment.

## Exit criterion

Authentic npm lockfile; clean npm ci/typecheck/lint/build/unit+HTTP tests; PG17 migrations and all original Phase 02 G1–G8 tests; real HTTP readiness; principle of least privilege before any booking endpoint.
