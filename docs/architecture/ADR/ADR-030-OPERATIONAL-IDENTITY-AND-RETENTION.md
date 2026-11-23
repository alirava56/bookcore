# ADR-030 — Operator-bound database operations, inspect-only domain repair

**Decision:** Accepted at source-design level, runtime validation pending.

**Context:** Phase09 outbox recovery trusted a caller-selected User UUID; lifecycle retention has no approved policy for destroying booking/idempotency history. Competing jobs require bounded transactions and explicit identity.

**Decision:** Authenticated dedicated PostgreSQL LOGIN => `session_user` => controlled registry => active BookCore User/OWNER and group role. No actor argument is authoritative. SECURITY DEFINER uses fixed search_path, tenant predicate, Organization/Membership lock, per-event lock, immutable audit. Operations have independent roles, not shared HTTP role. Inspection remains read-only with bounded samples; no automatic repair of domain state. Only auth-rate-limit buckets older than 48h may be cleaned in limited batches, after separate operator authorization.

**Alternatives considered:** Trusting a CLI actor UUID (rejected: spoofable attribution); custom GUC (rejected: caller can SET it); shared DBA Login (rejected: no attribution); implementing an operations HTTP endpoint (rejected: expanded attack surface); automatic counter reset (rejected: can destroy evidence); immediate idempotency cleanup (rejected: unknown COMMIT/replay risk).

**Trade-offs:** Requires external provision of per-operator credentials; limited Inspector does not prove full tenant integrity; postgres superusers remain out-of-band trusted; retention growth must be monitored. Existing Legacy function retained for historical migrations but privilege removed from Ops role. CLI contract changes are explicit and documented.

**Verification:** PostgreSQL 17 role tests, cross-tenant negative tests, 2-transaction race, process restart, clean install/upgrade, and audit immutability MUST PASS before release. Not executed in this environment.
