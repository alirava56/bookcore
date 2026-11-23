# Phase05 HTTP contract alignment

The source of truth remains `docs/api/openapi.yaml` (OpenAPI 3.1 Design Contract). It now includes type-level request validation for XOR Branch/Resource Scope in Create BusinessHour and Create ScheduleException, alongside corrected name/title minimum lengths (2 chars) aligned to existing application validation. Responses for Trainer/Room Resource omit the irrelevant type-specific property rather than exposing it as null.

**Implemented routes (12):** POST/GET Branches, Services, Resources; POST/GET/PATCH BusinessHours and ScheduleExceptions, under `/api/v1/organizations/{orgId}`. Current-only OpenAPI is generated from the NestJS bootstrap with `npm run openapi:current` once dependencies are installed. It must not be represented as an executed artifact until that succeeds. All new routes have Bearer Authentication through the global APP_GUARD.

**Known contract decision requiring runtime review:** The code currently accepts milliseconds (0–3 decimal digits) on scheduling input; the exception request has matching `pattern`. Query `from/to` also has bounded ISO datetime parsing. Formal independent OpenAPI validation was unavailable; strict YAML and internal-ref verification were executed instead.
