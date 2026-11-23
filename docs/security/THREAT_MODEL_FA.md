# BookCore — Security & Authorization Specification 1.1

**Trust boundary:** Internet → Edge → authenticated principal → Active Session DB → Tenant policy → Database transaction/constraints → Outbox Dispatcher. `tenantId` در URL صرفاً selector است؛ مالکیت و عضویت معتبر با DB و object scope کنترل می‌شود. ورودی body هیچ‌وقت actor/tenant/role/client-owned customer identity را تعیین نمی‌کند. **Status:** design-only؛ penetration test و security sign-off اجرا نشده است.

## Role and scope definitions
`PUBLIC` فقط register/login، `/health/live` و فهرست/جزئیات PUBLISHED sessions در مسیرهای `/public/` (نه readiness)؛ `AUTH_SELF` User active صاحب Booking خودش؛ `OWNER`, `MANAGER`, `RECEPTIONIST`, `TRAINER` از Membership ACTIVE همان Tenant، role را در TX مجدداً بررسی می‌کند. Trainer باید برای attendance همان `resource.trainer_user_id` با Session `trainer_resource_id` باشد. Manager تمام شعب Tenant، Receptionist همه شعب همان Tenant برای booking/cancel/attendance، بدون delegation granular در MVP. Owner می‌تواند Roleهای پایین‌تر را مدیریت کند؛ Manager فقط Receptionist/Trainer، نه Owner/Manager یا خود را. `CUSTOMER` Role ذخیره‌شده Membership نیست، خود User سراسری است.

## Complete authorization matrix: every MVP operation

**Single source of truth:** [`AUTHORIZATION_MATRIX.md`](AUTHORIZATION_MATRIX.md) includes **all 38 exact method/path operations**, active membership/ownership rules, actor scopes and denial behavior. This document concentrates on threat scenarios and technical controls; avoid maintaining a second 36-row matrix.

**Critical read model separation:** `GET /public/organizations/{orgId}/sessions` and `GET /public/organizations/{orgId}/sessions/{sessionId}` have **no authentication** and return only `PublicSession`/`PublicSessionList` allowlisted fields for published upcoming sessions (the detail route returns only a published Session). By contrast, `GET /organizations/{orgId}/sessions` and `GET /organizations/{orgId}/sessions/{sessionId}` require bearer+ACTIVE staff Membership, returning only staff projections (`StaffSession`/`StaffSessionList`); TRAINER is limited to assigned Sessions. Exposing internal counters, UUIDs of internal resources, version, room assignment, unpublished status or staff notes in public responses is prohibited. `/me` returns global User and **ACTIVE-only** staff memberships, possibly empty, as an authoritative `MeResponse` schema; no revoked memberships and no secrets.

`GET /health/ready` is NOT an anonymous endpoint: network/proxy allowlist **plus** an internal monitoring API-key header (`monitorAuth`); its presence in a design contract doesn't mean credentials or deployment exist. `GET /health/live` remains public and generic. No staff authentication ever inferred from a valid Customer JWT alone. `GET /resources` excludes TRAINER because `Resource` schema contains internal staff resource identity; the general Booking response excludes internal `createdByActorId` even though DB/audit retains it.

Every repository read/write includes `(tenant_id, id)` filter; for Customer object use `customer_id`; Trainer scope use join on resource identity. Return 404 for foreign-object/not-visible resource to avoid existence probing; 403 for a known visible tenant object whose function is denied. Never vary latency/body to reveal foreign resources intentionally.

## Threat model STRIDE/API
| Threat | Attack example | Preventive/detective control | Required negative tests |
|---|---|---|---|
| BOLA, IDOR | customer cancels another booking ID | ownership condition in locked query; 404 camouflage | T-12,T-29 |
| BFLA | Trainer creates Owner membership | explicit application policy and DTO allowlist | T-13,T-34 |
| Cross-tenant leakage | guessed Session UUID on orgB via orgA | `(tenant_id,id)` FK and query scope; error masking; no cross-tenant global search | T-12,T-33 |
| Privilege escalation | Manager promotes self to OWNER; last owner revoked | whitelist allowed target role and org-row lock for membership mutations | T-34 |
| Session hijack | stolen refresh token rotation | hashed refresh chain, short access token, revoke family on reuse, TLS | T-37 |
| Concurrent permission revocation | token valid after membership revoked | in-TX Membership FOR SHARE locks vs revocation UPDATE; recheck AuthSession status | T-24,T-31 |
| Mass assignment | booking body sets tenantId, status, actorId | reject additionalProperties and derive identity server-side | T-21,T-29 |
| SQL injection | query/ordering injection | prepared/parameterized SQL, strict sort allowlist | T-21 |
| Authentication brute force | unlimited login attempts | per-IP + per-credential rate limiting, generic 401, exponential backoff | T-40 |
| Request flooding | lock contention/DDOS | reverse proxy limits, bounded pools, lock timeouts, 429 and 503 Retry-After | T-01,T-41 |
| Error/info leak | stack traces/token in Problem Details/logs | centralized filters, stable codes, redacted errors, no SQL details | T-21 |
| Unauthorized cancel | reception/Trainer wrong session/customer | same-Tenant+role+ownership+state+cutoff inside TX | T-12,T-25 |
| Outbox payload leak | provider sees PII | event minimal IDs; separate provider opt-in, encryption and redaction | T-15,T-35 |
| Audit tamper | delete cancelled booking history | RESTRICT/FK, append-only table/roles, backup and monitor | T-33 |
| Clock manipulation | client manipulates local date | DB clock with RFC3339 offset and IANA mapping | T-14 |
| Replay old Idempotency | reuse Key with altered bookingId/payload | hash includes method/path/body, scope actor+tenant | T-04,T-28 |

## Identity requirements
- Access token signed with explicit issuer/audience/alg/expiry; `sid` and `sub`; authorization reads active AuthSession for writes, never role claims alone. 10–15min access lifetime proposed (TBD); refresh tokens cryptographically random, only hash stored and rotated, refresh lifetime TBD. CSRF if refresh in cookie, `Secure, HttpOnly, SameSite` and CSRF token; if mobile bearer token, protect secure storage. Do not mix incompatible cookie/bearer assumptions without implementation ADR.
- Password hashing Argon2id parameters calibrated in Spike, no plaintext/log. Account recovery/email verification details TBD, **not falsely described as production-ready**. MFA mandatory for sensitive live operations before production, implementation policy remains open PD-08.
- Suspended Users cannot create bookings/new sessions; pre-existing bookings retained for audit. Revocation of Membership does not invalidate User's personal booking ownership in unrelated Tenant.
- Optimistic role cache is insufficient; read Membership **inside the transaction under a conflicting-with-UPDATE row lock**. Race semantics: operations that acquire membership lock before revocation commit may finish; no operations after revocation commit should pass the lock. Do not assert retroactive cancellation of prior successful effects.

## Audit, privacy and operations
Persist actor/customer separately, reason for exceptional admin cancellations, trace IDs. `audit_events` and `booking_events` append-only; no passwords, refresh tokens, raw email/phone, Authorization header, IP unless necessary lawful retention. Traces have token redaction; vendor provider must receive only data needed. Backup encryption/restoration and key rotation necessary before pilot. Privacy retention and erasure subject to legal review: no immediate cascade delete.

## Design vs verification
Design of controls: specified. Code enforcement: NOT VERIFIED. DB Row Level Security: optional defense-in-depth later; not substitute for Composite FK + Application Policy. Authentication and endpoint E2E, Cross-tenant fuzzing and negative tests must execute on real DB and 2 API replicas before release; refer `docs/verification/REQUIREMENTS_TRACEABILITY.md`.
