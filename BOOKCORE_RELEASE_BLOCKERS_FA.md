# BookCore — فهرست مسدودکننده‌های Release

همهٔ موارد زیر **مانع گواهی انتشار** هستند؛ فقدان شواهد به‌تنهایی اثبات وجود نقص Runtime نیست.

## BLK-001 — P0 — Dependencies/Build

- **نوع:** Missing infrastructure / missing execution evidence
- **شواهد/بازتولید:** npm lock Exit124 timeout; npm ci Exit1; typecheck/build unable to resolve types
- **علت:** No authentic dependency graph
- **اثر کسب‌وکاری/امنیتی:** No repeatable build or supply-chain trace
- **اصلاح:** Restore real Registry access, create authentic lockfile, npm ci, typecheck, lint and build
- **مسئول:** Build/DevOps
- **پذیرش:** Clean exact artifact build and CI logs
- **وضعیت:** OPEN

## BLK-002 — P0 — PostgreSQL17 / schema

- **نوع:** Missing execution evidence
- **شواهد/بازتولید:** 12 SQL migrations only checksum-verified; psql absent
- **علت:** No real disposable database available
- **اثر کسب‌وکاری/امنیتی:** DB constraints and role grants unproven
- **اصلاح:** Provision PG17, run migrations twice and negative SQL constraints
- **مسئول:** DBA/Backend
- **پذیرش:** Real SQLSTATE logs, counts and role evidence
- **وضعیت:** OPEN

## BLK-003 — P0 — NestJS / Identity / Tenant

- **نوع:** Missing execution evidence
- **شواهد/بازتولید:** 0 real HTTP/NestJS tests executed
- **علت:** Build and PG prerequisites missing
- **اثر کسب‌وکاری/امنیتی:** Customer/staff access and contract not certified
- **اصلاح:** Run full HTTP E2E and RBAC/consent negative matrix
- **مسئول:** Backend/Security
- **پذیرش:** Executed HTTP/DB snapshots and audit trail
- **وضعیت:** OPEN

## BLK-004 — P0 — Booking concurrency / unknown Commit

- **نوع:** Missing execution evidence
- **شواهد/بازتولید:** 100×2×3 and cross-transaction races not run
- **علت:** No shared PG17 and two API processes
- **اثر کسب‌وکاری/امنیتی:** Potential overbooking or duplicate side effects unassessed
- **اصلاح:** Run two-process concurrency; fix source on actual failures
- **مسئول:** DB/Backend
- **پذیرش:** Persisted rows and raw latency/status results
- **وضعیت:** OPEN

## BLK-005 — P1 — Outbox Worker

- **نوع:** Missing execution evidence
- **شواهد/بازتولید:** Two Workers and lease/crash not run
- **علت:** No PG17 multi-worker environment
- **اثر کسب‌وکاری/امنیتی:** Event delay/duplication consistency uncertain
- **اصلاح:** Run worker crash/lease/receipt/quarantine tests
- **مسئول:** Reliability
- **پذیرش:** Event rows and receipts, failure/retry logs
- **وضعیت:** OPEN

## BLK-006 — P0 — Backup/Restore/PITR

- **نوع:** Missing execution evidence
- **شواهد/بازتولید:** pg_dump/pg_restore/age absent
- **علت:** No isolated recovery instance
- **اثر کسب‌وکاری/امنیتی:** Unproven recovery; major data loss exposure
- **اصلاح:** Restore synthetic PG17 backup, compare ledger/ACL/data; exercise PITR
- **مسئول:** SRE/DBA
- **پذیرش:** Signed independent recovery exercise
- **وضعیت:** OPEN

## BLK-007 — P1 — Operational readiness

- **نوع:** Product-policy decision / missing execution evidence
- **شواهد/بازتولید:** No real CI/CD, alert, runbook or rollback drill
- **علت:** No approved infrastructure/operator policy
- **اثر کسب‌وکاری/امنیتی:** No demonstrated incident response/SLO
- **اصلاح:** Provision monitoring and manually approve operational drill
- **مسئول:** SRE/Product
- **پذیرش:** Raw successful CI/drill and business RPO/RTO approval
- **وضعیت:** OPEN

## BLK-008 — P2 — Historical retention/refresh recovery

- **نوع:** Product-policy decision / source technical debt
- **شواهد/بازتولید:** Inherited deferred register still open
- **علت:** Risk policy and runtime tests not finalized
- **اثر کسب‌وکاری/امنیتی:** Potential token/session ambiguities and storage growth
- **اصلاح:** Specify retention and secure recovery policy; run negative tests
- **مسئول:** Identity/Security
- **پذیرش:** Policy approval + PG17 retry/expire tests
- **وضعیت:** OPEN

## وضعیت پس از اصلاحات ۲۰۲۶-۱۱-۲۴

موارد بالای این بخش وضعیت تاریخی Phase 16 را نشان می‌دهند. اجرای محلی گیت‌های ساخت، دیتابیس، HTTP، ظرفیت، Worker، Restore منطقی و PITR در گزارش‌های جدید ثبت شد. موانع فعال عبارت‌اند از مقصد احراز‌شدهٔ GitHub، اجرای CI در آن مقصد، تأیید مستقل و تمرین بازیابی و استقرار در محیط هدف. تصمیم فعلی NO-GO است.
