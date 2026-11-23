# Phase 04 API Contract — Implemented Source Surface

**نکته:** `docs/api/openapi.yaml` همچنان قرارداد طراحی کامل BookCore است؛ هیچ ادعایی مبنی بر عملیاتی بودن ۳۸ Endpoint آن وجود ندارد. Generator در `scripts/generate-openapi.ts` فقط Routeهای NestJS فعلی را تولید می‌کند و نیازمند نصب وابستگی‌های واقعی و اجرای NestJS است.

| Method | Path after `/api/v1` | Auth | Success | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | Public + DB rate limit | 201 User | Email normalized; Argon2id |
| POST | `/auth/login` | Public + DB rate limit | 200 Tokens | Generic invalid credentials |
| POST | `/auth/refresh` | Refresh holder + DB rate limit | 200 Tokens | one-time + replay revocation |
| POST | `/auth/logout` | Bearer + active DB Session | 204 | revoke own Session |
| GET | `/me` | Bearer + active DB Session | 200 MeResponse | only active Memberships |
| POST | `/organizations` | Bearer | 201 Organization | New Owner + Audit atomic |
| GET | `/organizations/{orgId}` | Bearer + ACTIVE Membership | 200 Organization | 404 hidden foreign tenant |
| GET | `/organizations/{orgId}/members` | Bearer + Owner/Manager | 200 MembershipList | UUID cursor, 1..100 limit |
| POST | `/organizations/{orgId}/members` | Bearer + Owner/Manager | 201 Membership | existing user; restricted role grants |
| PATCH | `/organizations/{orgId}/members/{userId}` | Bearer + Owner/Manager | 200 Membership | last owner protected |
| GET | `/health/live` | Public | 200 | generic process health |
| GET | `/health/ready` | Monitor key + direct IP | 200 or 503 | DB migration readiness |

Errors use `application/problem+json` RFC 9457 compatible structure with stable `code`; 401 invalid principal, 403 denied local role, 404 hidden foreign tenant, 409 role/uniqueness conflict, 422 semantic invalidity, 429 rate limit, 503 unavailable/unknown commit.

**Documented contract adjustments:** minimum name length ۲ در `POST /organizations` بر اساس Database CHECK؛ password complexity 12+ با سیاست قوی‌تر؛ Refresh 256-bit random base64url. تغییر/تفسیر با ADR-021 ثبت شده است.

### Generated implementation OpenAPI
`npm run openapi:current` (پس از npm install/build) باید `docs/api/phase04-implemented.openapi.json` را با صرفاً ۱۲ عملیات روی ۱۱ مسیر واقعی بسازد. این فایل در محیط فعلی قابل تولید نبود؛ ساختگی تحویل نمی‌شود. Contract کامل Design در مخزن موجود است.
