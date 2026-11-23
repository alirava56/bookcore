# ADR-029 — Outbox v1 payload compatibility, lease fencing and recovery
Status: SOURCE IMPLEMENTED; POSTGRESQL NOT VERIFIED

Context: Generic validation accepted `{}` for `BookingConfirmed`. A 20-record sequential claim under 45s lease could expire before later records were processed. Permanently failed events could block aggregate ordering without an operational retry mechanism.

Decision: Enumerate actual emitted event types, aggregate identities and v1 payload shapes; reject unknown fields, oversized/sensitive payloads and unsupported versions. Preserve historically emitted minimal payload shapes without retroactive rewrite. Claim one event per tick; fence finalization by ownership and live lease; receipt and durable per-tenant/type projection in one transaction; `published_at` denotes only internal completion. Introduce a privileged CLI and tenant-Owner-checked SECURITY DEFINER requeue, audit operator and reason.

Trade-offs: throughput per worker is lower; external delivery is NOT implemented; ops role must be securely provisioned; PostgreSQL multi-worker behavior and role grants remain unverified. Aggregate poison events must not be silently skipped.
