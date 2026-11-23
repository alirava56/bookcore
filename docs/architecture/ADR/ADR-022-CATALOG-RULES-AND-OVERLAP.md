# ADR-022 — Catalog, weekly rules and exceptions (Phase05)

**Status:** Adopted for source implementation, PostgreSQL correctness `NOT VERIFIED`.

## Decision

Branch/Service/Resource remain tenant-owned; `TRAINER` is one tenant-wide Resource per active TRAINER membership, while ROOM references an active Branch. Existing 001–005 migrations remain immutable. Add 006 for Branch address, schedules, immutable Rule lifecycle and tenant-safe FKs. Weekly rules are stored as weekday/local-time/overnight offset, NOT as UTC timestamps. `p05_weekly_overlap` checks pairs on a 10080-minute cycle with wraparound, enforced in a SECURITY DEFINER trigger that serializes active insertions with an Organization lock. Schedule Exceptions are absolute UTC instants and active scoped overlaps are rejected using PostgreSQL native GiST exclusions.

## Alternative considered

Converting every recurring weekly rule to a fixed UTC interval would fail across DST and is rejected. In-memory overlap validation alone would permit races across replicas and is rejected. Deleting obsolete rules would destroy history and is rejected.

## Consequences

CLOSED overrides OPEN_OVERRIDE across Branch/Resource scopes; where no active rule or override exists, availability is denied. Source-level tests show expected DST and midnight handling, but PG/Lock/Trigger behavior remains unverified. New CHECK constraints are initially `NOT VALID` to avoid breaking installations with previously valid long names; legacy rows require later validation. Requires operator approval for scheduling policy before Pilot.
