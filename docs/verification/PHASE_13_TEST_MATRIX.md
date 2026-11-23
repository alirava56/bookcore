# Phase 13 — Test Matrix

| سناریو | کد تست | محیط | مدرک پذیرش | وضعیت اولیه |
|---|---|---|---|---|
| Metric labels / histogram / redaction | `phase13-observability.test.ts` | Node + TypeScript global | TAP بدون Skip/Fail | Source Pure قابل اجرا |
| Backup/Restore policy و mock execute | `phase13-recovery.test.cjs` | Node + Mock Executables | TAP، کنترل خطا و Branch واقعی | Source Mock قابل اجرا |
| MonitorGuard/private endpoint/drain | `phase13-observability-http.test.ts` | npm + NestJS | HTTP status 401/200/503 بدون Leak | NOT VERIFIED |
| Booking capacity 1 و 20، 100 کاربر × 3 | `booking-postgres.test.ts` | PostgreSQL17 + 2 independent Nest processes | DB counts + events/outbox + p50/p95/p99، 6 دور | NOT VERIFIED |
| Secure age producer/verifier | `phase13-recovery.test.cjs` + runbook | age + PG17 + 2 trust hosts | هیچ کلید خصوصی در Producer؛ Decrypt و Restore مستقل | Mock فقط؛ Runtime NOT VERIFIED |
| Restore حقیقی با PG session_user/role | `phase12-backup-restore.test.ts` و Runbook | PostgreSQL17 Disposable | SQL ledger، ACL، integrity و failure stages | NOT VERIFIED |
| Pool saturation / transaction retry | `transaction.test.ts` + Load Harness | Nest/PG واقعی | کنترل Timeout و Ledger نهایی | NOT VERIFIED |
| Outbox lease/worker shutdown | تست‌های inherited Phase08/09 | دو Worker/PG | Fenced commit، at-least-once و Rollback | NOT VERIFIED |
| OpenAPI/Migration Checksum/Manifest | Scripts موجود | Node/Python | Exit0 و هش دقیق | قابل اجرا |

**Test definitions != executed results.** هیچ آزمون SQL/HTTP یا بازیابی بدون Log واقعی PASS نمی‌گیرد.
