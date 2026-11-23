# ADR-016 — SQL-native PostgreSQL constraints, ORM provisional

- **Status:** Provisionally prefer Drizzle; **pending TS-03**.
- **Decision:** PostgreSQL native partial unique/composite FK/exclusion and triggers specified in reviewed migrations, not inferred from ORM metadata. Use migration role separate from runtime; expand/contract with tests and backup/restore. Drizzle is the default for Spike because of SQL-first handling; Prisma remains credible if raw SQL inside same TX and custom migration drift checks perform better.
- **Alternatives:** Prisma with custom SQL (not categorically rejected); ORM-only schema definitions (rejected for GiST exclusion); Redis capacity lock (rejected).
- **Trade-offs:** hand-maintained SQL, specialized DB expertise, cross-DB portability sacrificed for correctness; database schema introspection tests mandatory.
- **Verification:** TS-02/03/06, T-19,T-32,T-39; no code or production migration in Phase 01. Official references in database design spec.
