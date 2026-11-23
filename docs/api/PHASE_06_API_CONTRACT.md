# Phase 06 API — Implementation Contract

Base path: `/api/v1`. Authority: `docs/api/openapi.yaml` (future design); only currently implemented routes must appear in generated `docs/api/phase06-implemented.openapi.json` after installing dependencies.

| Method | Path suffix | Visibility | Response |
|---|---|---|---|
| POST | `/organizations/{orgId}/sessions` | OWNER/MANAGER | 201 StaffSession |
| GET | `/organizations/{orgId}/sessions` | Staff scoped | 200 StaffSessionList |
| GET | `/organizations/{orgId}/sessions/{sessionId}` | Staff scoped | 200 StaffSession |
| POST | `/organizations/{orgId}/sessions/{sessionId}/publish` | OWNER/MANAGER | 200 StaffSession |
| POST | `/organizations/{orgId}/sessions/{sessionId}/cancel` | OWNER/MANAGER; required Idempotency-Key | 200 StaffSession |
| POST | `/organizations/{orgId}/sessions/{sessionId}/finish` | OWNER/MANAGER | 200 StaffSession |
| PATCH | `/organizations/{orgId}/sessions/{sessionId}/capacity` | OWNER/MANAGER; required Idempotency-Key | 200 StaffSession |
| GET | `/public/organizations/{orgId}/sessions` | Explicit public | 200 PublicSessionList |
| GET | `/public/organizations/{orgId}/sessions/{sessionId}` | Explicit public | 200 PublicSession |

Date filtering: `from`, `to`, `limit` (1..100) and stable cursor with `(startAt,id)`. Maximum window 31 days. Query instants require explicit offset. Errors use RFC 9457 `application/problem+json` and stable codes; unknown COMMIT returns 503 with `UNKNOWN_COMMIT_OUTCOME` and client must retry with original key. A 200 PublicSession `seatsAvailable` is merely a snapshot, not a capacity guarantee.

Static strict YAML, duplicate keys, `$ref` and public-leakage checks pass; generated Swagger artifact **NOT VERIFIED** without dependencies.
