# ADR-021 — Phase 04 Identity/Tenancy Integration

- **Status:** PROVISIONALLY ACCEPTED IN SOURCE; runtime verification NOT VERIFIED.
- **Date:** 2026-11-22
- **Context:** Source Phase03 had no registered global Auth Guard and Bootstrap configuration could differ from Nest DI; identity/authentication only specified on paper.
- **Decision:** Dynamic `AppModule.forRoot(config)` shares an identical validated AppConfig object. One global `APP_GUARD` denies all routes except method-level `@Public` or `@MonitoringRoute` (Ready has an additional MonitorGuard). JWT is HS256 with explicit kid allowlist, audience/issuer/expiry checks and live DB AuthSession checks; password credential Argon2id; Session family refresh rotation with atomic replay revocation. Tenant writes lock Organization then Session and Membership and use transaction-scoped audit. DB triggers guard Last Owner and immutable secret references.
- **Trade-offs:** Active AuthSession database read for every HTTP call increases latency and DB dependency, but avoids deferred revocation and stale JWT access. JWT symmetric keys require tightly controlled secret distribution and rotation. Refresh replay revocation is secure against token reuse but may revoke legitimate clients after uncertain COMMIT; recovery policy remains unresolved. Database rate limiting by direct peer can unfairly group NAT users.
- **Contract resolution:** Organization name minLength 2 follows PostgreSQL CHECK. `/me` retains User + ACTIVE Memberships, no Customer staff role. Two Account Status layers remain independent.
- **Verification:** Static TS parsing and source checks performed; npm/package installation, NestJS runtime and PostgreSQL constraints have NOT been verified. Integration tests are written, not claimed executed.
- **Supersedes:** Phase03 Auth provider-only design, not the established Phase01 domain/booking invariants.
