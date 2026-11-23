# ADR-013 — Tenant-local Trainer Resource and GiST exclusion

- **Status:** Accepted for design, needs PostgreSQL Spike.
- **Context:** Resource FK to branch cannot allow Trainer across branches without duplicate Trainer resources that bypass time conflict.
- **Decision:** Resource type TRAINER uses `trainer_user_id` and nullable branch; one Trainer Resource per User per Tenant, multi-branch assignment allowed. ROOM belongs to one Branch. Session references one Trainer and at most one Room. Draft creates active allocation, cancellation sets inactive. Half-open `[start,end)` allocated UTC interval expands before/after buffers; GiST EXCLUDE on `(tenant_id,resource_id,tstzrange)` with partial active predicate and `btree_gist` rejects conflict.
- **Assumptions:** trainer working for two independent Organizations not globally locked by BookCore; cross-org conflict is OUT OF SCOPE; one session trainer only; Room exclusive.
- **Alternatives rejected:** trainer resource per branch (same-human clash), in-memory lock, separate trainer schedule from room schedule, DB advisory locks instead of hard exclusion.
- **Trade-offs:** global scheduling for contractor working across tenants requires opt-in later; Draft may block resources until cancelled; buffer edits need new workflow.
- **Verification:** T-08,T-09,T-19,T-30,T-32,T-36; SQLSTATE 23P01 verified on actual PG.
