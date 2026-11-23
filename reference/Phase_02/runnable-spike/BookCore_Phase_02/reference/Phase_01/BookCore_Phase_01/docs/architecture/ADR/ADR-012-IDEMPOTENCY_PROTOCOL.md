# ADR-012 — Single-TX terminal idempotency and transactional outbox

- **Status:** Accepted for design, not implemented.
- **Context:** blueprint §7.3 vs §15.3 conflicted on persist rejection inside rolled-back TX. Lost responses and duplicate key concurrency require deterministic reply.
- **Decision:** `(tenant_id,actor_id,operation,key)` unique; canonical request SHA-256 includes concrete path; Claim and domain mutation and terminal cached 201/200 or expected business 409/422 and Outbox are committed in one TX. Expected domain rejection commits no business mutation, but terminal response persists. Unhandled 5xx rolls back everything and is **not** cached; no committed PROCESSING rows. Unknown COMMIT returns no success claim; client retries with same Key. Replay after checking current authorization. Key retention 24h provisional; expired keys while stored replay, new key after expiration expected.
- **Outbox:** one event ID per domain event, at-least-once dispatch via SKIP LOCKED, lease/retry, downstream event-id dedupe; not exactly-once provider delivery.
- **Alternatives rejected:** write cached rejection after ROLLBACK without independent durable transaction; Redis-only idempotency; treating 5xx as terminal; guaranteeing provider exactly-once.
- **Trade-offs:** pessimistic unique lock wait, storage and TTL, replay returns historical result even if later state changed; clean retention policy essential.
- **Verification:** T-03/04/05/15/16/28/35, forced lost reply and 23P01/unique collisions. Cache/consumer secrets excluded.
