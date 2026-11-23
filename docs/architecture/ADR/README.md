# BookCore Architecture Decision Register

BC-SENG-001 ADR-001..010 are preserved as design baseline inside the immutable original blueprint; no false claim of standalone legacy ADR files. The following Phase 01 decisions extend, do not rewrite, those entries:

| ADR | Decision | Baseline continuity |
|---|---|---|
| 011 | Session locking and atomic capacity lifecycle | ADR-002,004,009 |
| 012 | Idempotency transactional protocol and outbox semantics | ADR-006,007 |
| 013 | Tenant-local trainer and resource allocation/exclusion | ADR-003,008 |
| 014 | Identity/member separation, revocation, staff authorization | ADR-010 |
| 015 | UTC/IANA, scope and API contracts | ADR-005 |
| 016 | DB-first migrations and provisional ORM decision | ADR-001,002,008 |

Each ADR is a *design decision*, not an executed/approved production change. Any variance after Spike requires a revised ADR, contract and tests.

- `ADR-022-CATALOG-RULES-AND-OVERLAP.md` — Phase05 recurring rules and GiST constraints (runtime NOT VERIFIED)
- `ADR-023-PHASE05-SECURITY-AND-REFRESH.md` — staff visibility, consent and refresh replay trade-off
