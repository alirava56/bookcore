# ADR-028 — Unknown outcomes and safe recovery
Status: PROVISIONAL; runtime and fault-injection tests NOT VERIFIED

Context: With opaque bearer Refresh tokens, a consumed token's legitimate lost response cannot securely be distinguished from malicious replay. Session creation previously committed without an idempotency recoverability contract.

Decision A: Preserve single-use refresh and replay revocation. Upon unknown transaction outcome, return `REFRESH_OUTCOME_UNKNOWN_REAUTH_REQUIRED`; do not replay potentially consumed raw token. Credential-based reauthentication is an explicit safe fallback. A grace period would weaken bearer replay detection and is not accepted without sender proof.

Decision B: Add optional `Idempotency-Key` for Session draft creation, documented in OpenAPI. Same actor/org/operation/payload/key maps to one committed response. Request without key keeps old behavior and no guaranteed lost-response recovery. Existing exclusion constraints remain authoritative.

Trade-offs: safer refresh may log out two legitimate concurrent devices; optional Session keys do not protect clients that omit key. End-to-end PostgreSQL/HTTP integration and unknown-COMMIT fault injection remain open.
