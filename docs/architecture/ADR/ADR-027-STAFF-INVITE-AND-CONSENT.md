# ADR-027 — Invitation-required membership and scoped booking consent
Status: PROVISIONALLY ACCEPTED IN SOURCE; RUNTIME NOT VERIFIED

Context: Existing direct member creation permitted involuntary staff affiliations. Staff on-behalf Booking had been fail-closed without customer authorization.

Decision: Existing direct membership creation returns 409 `STAFF_INVITATION_REQUIRED`; use a 256-bit single-use hashed invitation accepted by the invitee with a valid JWT. Role hierarchy is checked on invitation and acceptance. Customer grants short-lived tenant-scoped consent only on their own authenticated identity; staff Booking enforces current role + tenant/customer consent inside its capacity transaction.

Alternatives rejected: assuming consent from UUID/email, staff self-grant, global unbounded mandate, silent activation upon invite.

Consequences: clients using direct membership API must migrate; no email/SMS delivery service; old memberships are retained. Booking and invitation races require real PostgreSQL tests. Review product consent wording/expiration defaults before Pilot.
