# ADR-023 — Phase05 retained security boundaries

**Status:** Security-policy source decision; deployment risks open.

Retain Phase04 global APP_GUARD; all new routes authenticated, staff-role-checked and never Public. Writes revalidate AuthSession+Membership in UnitOfWork with org lock. GET Catalog Resource directory is restricted to OWNER/MANAGER/RECEPTIONIST, and trainer schedule rules are scoped to owned TRAINER Resource. No client-supplied authorization context is trusted. Audit/Outbox mutations occur in the same transaction.

**Refresh trade-off:** Maintain strict replay detection and session-family revocation for concurrent use of consumed refresh credentials. Differentiating stolen token from legitimate lost-acknowledgement replay cannot be guaranteed without a more substantial recovery protocol. Clients must serialize refresh and be ready to reauthenticate; unknown COMMIT remains risk. Do not silently add retry grace that an attacker can exploit.

**Membership consent:** Existing admin-add-UUID operation does not prove staff acceptance. No invitation design is implemented in Phase05; customer-facing staff-affiliation consent needs an approved workflow prior to rollout.

**Ingress security:** Direct peer IP is spoof-resistant, but NAT/reverse-proxy sharing can impose shared auth-rate limits. Apply trusted-ingress protection and retention maintenance before public deployment.
