# ADR-014 — Customer identity ≠ staff membership; revocation locking

- **Status:** Accepted for design; business participation model provisional.
- **Decision:** Global User is Customer by booking ownership, no Customer membership required; Membership is staff authorization only. Booking has customer_id separate from created_by_actor_id. Trainer resource links existing User via active tenant membership on creation. Staff authorization must lock Membership FOR SHARE in write TX, conflicting with UPDATE revoke; AuthSession FOR SHARE and active user validated. Last Owner cannot be revoked. Receptionist booking/cancel/attendance allowed, no session management; Manager manages resources/sessions and low-level staff but no Owner escalation. Cross-tenant invisible IDs → 404.
- **Rationale:** avoids falsely equating authentication with tenant authorization; Revocation has precise serialization point; preserves history after employee departs.
- **Alternatives rejected:** embedded JWT roles as sole authority; one customer account per tenant; separate trainer identity; unrestricted staff lookup.
- **Trade-offs:** DB reads on every sensitive write; staff customer ID must be known out-of-band and consent/identity verification PD-04 needed; manager/trainer dual duties use Resource link not role combination.
- **Verification:** T-12,T-13,T-24,T-29,T-31,T-33,T-34,T-37; stakeholder PD-01/04/08.
