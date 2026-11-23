# BookCore — Authorization Matrix (MVP, authoritative Phase 01 design)

**Status:** design-only, **not implemented or penetration tested**. This file is the single authoritative per-operation authorization table. The [OpenAPI design contract](../api/openapi.yaml) encodes required authentication and `x-authorized-actors`; [Threat Model](THREAT_MODEL_FA.md) explains attack controls. `AUTH_SELF` means authenticated active global User; `CUSTOMER` is not a staff membership role. `ASSIGNED_TRAINER` means an ACTIVE Trainer Member whose tenant-local Trainer Resource is assigned to the given Session.

**Default-deny:** staff operations require active User + active AuthSession + ACTIVE Membership in target organization, rechecked under lock in write transactions. Customer-owned Booking operations are authorized by `customer_id = principal.user_id` and do **not** require Membership. The public-only Session GET routes use an explicit `PublicSession` allowlist and no bearer credentials; staff Session routes always require bearer and return a distinct `StaffSession` model. `monitorAuth` protects readiness in addition to network controls.

| Method + path (relative to `/api/v1`) | Allowed principal (`x-authorized-actors`) | Object / membership conditions | Expected denial and negative test |
|---|---|---|---|
| `POST /auth/register` | `PUBLIC` | valid unique email; no existing credential | 409 duplicate email can reveal registration status; rate limit and privacy risk must be reviewed before pilot |
| `POST /auth/login` | `PUBLIC` | credential+rate limits; avoid existence detail | 401 generic, 429; wrong password |
| `POST /auth/refresh` | `REFRESH_TOKEN_HOLDER` | active auth_session + unused refresh token, rotate family | 401 on replay/revoked |
| `POST /auth/logout` | `AUTH_SELF` | own `sid` only | 401 revoked session |
| `GET /me` | `AUTH_SELF` | Authenticated active global user; strictly own User + only ACTIVE staff Memberships, possibly empty; excludes revoked and secrets. | 401 invalid token; active-only membership projection T-45. |
| `POST /organizations` | `AUTH_SELF` | new Tenant + caller Owner atomic | 401 suspended user |
| `GET /organizations/{orgId}` | `OWNER\|MANAGER\|RECEPTIONIST\|TRAINER` | active Membership in target Tenant | 404 cross-tenant, 403 local denied |
| `GET /organizations/{orgId}/members` | `OWNER\|MANAGER` | active Tenant membership; staff roster only, bounded pagination | 403 Trainer, 404 foreign Tenant |
| `POST /organizations/{orgId}/members` | `OWNER\|MANAGER` | Manager may add only Receptionist/Trainer (existing User) | 403 role escalation, 404 other org |
| `PATCH /organizations/{orgId}/members/{userId}` | `OWNER\|MANAGER` | Manager may modify only Receptionist/Trainer and never elevate; last Owner protected | 403; 409 LAST_OWNER |
| `POST /organizations/{orgId}/branches` | `OWNER\|MANAGER` | active Tenant membership | 403 Receptionist |
| `GET /organizations/{orgId}/branches` | `OWNER\|MANAGER\|RECEPTIONIST\|TRAINER` | own Tenant branches only, bounded pagination | 404 tenant other |
| `POST /organizations/{orgId}/resources` | `OWNER\|MANAGER` | trainer membership in tenant; room branch same tenant | 404 foreign Trainer/Branch |
| `GET /organizations/{orgId}/resources` | `OWNER\|MANAGER\|RECEPTIONIST` | Tenant staff directory contains internal trainerUserId; Trainer cannot enumerate, Owner/Manager/Receptionist only | 403 Trainer, 404 foreign resource |
| `POST /organizations/{orgId}/services` | `OWNER\|MANAGER` | tenant only | 403 Trainer |
| `GET /organizations/{orgId}/services` | `OWNER\|MANAGER\|RECEPTIONIST\|TRAINER` | own Tenant; approved catalog fields | 404 foreign service |
| `POST /organizations/{orgId}/business-hours` | `OWNER\|MANAGER` | scoped Branch/Resource same tenant | 404 foreign resource |
| `GET /organizations/{orgId}/business-hours` | `OWNER\|MANAGER\|RECEPTIONIST\|TRAINER` | own Tenant schedule rules only | 404 foreign schedule rule |
| `PATCH /organizations/{orgId}/business-hours/{hourId}` | `OWNER\|MANAGER` | may deactivate own Tenant rule; cannot edit retroactive Sessions | 403 Receptionist, 404 foreign rule |
| `POST /organizations/{orgId}/schedule-exceptions` | `OWNER\|MANAGER` | resource/branch same tenant, reason for override | 403 Receptionist, 422 missing reason |
| `GET /organizations/{orgId}/schedule-exceptions` | `OWNER\|MANAGER\|RECEPTIONIST\|TRAINER` | own Tenant, bounded time window | 404 foreign exception |
| `PATCH /organizations/{orgId}/schedule-exceptions/{exceptionId}` | `OWNER\|MANAGER` | deactivate own Tenant rule only | 403 Receptionist, 404 foreign exception |
| `GET /public/organizations/{orgId}/sessions` | `PUBLIC_PUBLISHED` | No credential or Membership. Only PUBLISHED target; list restricted to upcoming and 31-day range; published detail visibility does not authorize booking if time elapsed. PublicSession only, without staff data. | 404 for absent/unpublished/hidden tenant or session. Strict public allowlist: T-44. |
| `POST /organizations/{orgId}/sessions` | `OWNER\|MANAGER` | service/branch/trainer/room same tenant and schedulable | 409 resource conflict, 404 foreign ID |
| `GET /organizations/{orgId}/sessions` | `OWNER\|MANAGER\|RECEPTIONIST\|ASSIGNED_TRAINER` | ACTIVE tenant staff Membership; Owner/Manager/Receptionist can list tenant; TRAINER only assigned active Trainer Resource sessions; StaffSessionList only. | 401 unauthenticated, 403 wrong role, 404 foreign/non-assigned; never public; T-44. |
| `GET /public/organizations/{orgId}/sessions/{sessionId}` | `PUBLIC_PUBLISHED` | No credential or Membership. Only PUBLISHED target; list restricted to upcoming and 31-day range; published detail visibility does not authorize booking if time elapsed. PublicSession only, without staff data. | 404 for absent/unpublished/hidden tenant or session. Strict public allowlist: T-44. |
| `GET /organizations/{orgId}/sessions/{sessionId}` | `OWNER\|MANAGER\|RECEPTIONIST\|ASSIGNED_TRAINER` | ACTIVE tenant staff Membership; Owner/Manager/Receptionist own tenant; TRAINER only assigned session; StaffSession only. | 401 unauthenticated, 404 foreign or unassigned; never return staff data on a public request; T-44. |
| `POST /organizations/{orgId}/sessions/{sessionId}/publish` | `OWNER\|MANAGER` | session tenant; Draft; valid resources | 404 foreign,409 invalid state |
| `POST /organizations/{orgId}/sessions/{sessionId}/cancel` | `OWNER\|MANAGER` | same tenant; before start; reason required | 404 foreign,409 started |
| `POST /organizations/{orgId}/sessions/{sessionId}/finish` | `OWNER\|MANAGER` | same tenant; after end | 409 too early |
| `PATCH /organizations/{orgId}/sessions/{sessionId}/capacity` | `OWNER\|MANAGER` | same tenant; Draft/Published before start | 409 below committed |
| `POST /organizations/{orgId}/sessions/{sessionId}/bookings` | `AUTH_SELF\|OWNER\|MANAGER\|RECEPTIONIST` | customer=self by default; staff may provide existing `customerId`; Session published same tenant; authorization checked inside TX | 403 staff unauthorized, 404 hidden/cross-tenant, 409 duplicate/full |
| `GET /organizations/{orgId}/bookings/me` | `AUTH_SELF` | tenant + `customer_id = principal.user_id` only; no membership required | 404 foreign tenant, no other Booking rows |
| `POST /organizations/{orgId}/bookings/{bookingId}/cancel` | `AUTH_SELF_OWNER\|OWNER\|MANAGER\|RECEPTIONIST` | owner can cancel own before cutoff; Staff same Tenant before start with reason | 404 foreign or other customer's ID for self, 422 cutoff |
| `POST /organizations/{orgId}/bookings/{bookingId}/attendance` | `OWNER\|MANAGER\|RECEPTIONIST\|ASSIGNED_TRAINER` | same Tenant, Session Finished; Trainer must own Trainer Resource | 403 Trainer on unrelated Session, 409 invalid state |
| `GET /organizations/{orgId}/reports/occupancy` | `OWNER\|MANAGER` | tenant only, bounded date range | 403 Receptionist |
| `GET /health/live` | `PUBLIC` | no detail/secrets | 200 only generic |
| `GET /health/ready` | `INTERNAL_MONITOR` | Internal private-network/proxy allowlist AND monitorAuth header required; monitor secret is provisioned outside repository. | 401 absent/invalid monitorAuth, 403 forbidden network, 503 DB unready; T-47. |

## Mandatory field-level and error policies

1. `PublicSession` MUST be materialized with an explicit allowlist from service title/branch name/Session instants and non-guaranteed availability; never serialize a `StaffSession` or spread a database ORM entity on public routes. `additionalProperties: false` is also enforced at schema level. No `$ref` or `oneOf` from PublicSession to StaffSession.
2. Staff Session read is `GET /organizations/{orgId}/sessions[/...{sessionId}]`; `security: [bearerAuth]` and staff RBAC/ABAC are mandatory. Trainer-only view is restricted to assigned sessions, not an authorization to view another trainer's schedule.
3. Public read is `GET /public/organizations/{orgId}/sessions[/...{sessionId}]`; it returns 404 for any unpublished or unknown session and is never a source of cancelled/draft/finished status leakage.
4. Owner/Manager mutable Session transitions remain governed by State Machines: only Draft publish, only before-start session cancel, finish after end, capacity bounded by committed seats. No role bypass of those conditions.
5. For tenant object denial return 404 when object isn't visible, and 403 when object is in an authorized scope but function/role is forbidden; distinguish 401 bad credential from 403 known-denied role. Authenticated read fields, including Membership roster and trainer Resource linkage, remain separate from public read.
6. The internal `Resource` response contains trainerUserId; therefore generic `GET /resources` is Owner/Manager/Receptionist only. Assigned Trainer uses filtered staff Sessions, not generic resource enumeration. `Booking` response excludes the internal `createdByActorId`, retained only in database/audit.
7. No `X-BookCore-Monitor-Key` value or environment credential is present in docs or repo. Monitoring credentials and network policy are future infrastructure, NOT VERIFIED.

**Coverage:** 38 exact method+path operation pairs. Public-safety and authorization behavior are specified but runtime **NOT VERIFIED**. Static contract tests T-44..T-47 are in Requirements Traceability.
