# BookCore — PostgreSQL Physical Design Specification (design-only)

**Status:** target physical schema, NOT executed SQL migration. PostgreSQL پشتیبانی‌شده و نسخه دقیق باید در Spike قفل شود. Naming snake_case؛ UUID سراسری PK و تمام جداول سازمانی ستون tenant_id NOT NULL؛ هر FK حساس `(tenant_id,id)` را تطبیق می‌دهد. هیچ حذف cascade سوابق رزرو. `timestamptz` با semantics UTC؛ Default DB `clock_timestamp()` برای eventهای immutable، `now()` برای timestamps عمومی، زمان سیاست deadline از `clock_timestamp()` در Transaction.

## 1. Type legend and relation rules
`uuid` با `gen_random_uuid()`, `citext` برای email, `text` برای enum constrained by CHECK, `integer` و `smallint`, `boolean`, `jsonb`, `timestamptz`, `date`, `time without time zone`; قرارداد enumها در بخش‌های این سند. همه `id`ها PK UUID default-generated و `tenant_id` دارای FK به `organizations(id)` با `ON DELETE RESTRICT`. هر جدول با `(tenant_id,id)` نیازمند `UNIQUE (tenant_id,id)` برای FK child است، حتی با PK UUID. `created_at timestamptz NOT NULL DEFAULT now()` برای immutable/auditable، ستون `updated_at` برای mutable. FKها با `ON UPDATE RESTRICT, ON DELETE RESTRICT` مگر جایی صریحاً خلاف آمده. اصول انتخاب indexها پیشنهاد طراحی‌اند و باید با EXPLAIN واقعی تأیید شوند.

## 2. Inventory — exact columns, nullability, constraints

### `users` [global]
`id uuid PK NN`, `email citext NN UNIQUE`, `password_hash text NN`, `status text NN CHECK IN ('ACTIVE','SUSPENDED')`, `email_verified_at timestamptz NULL`, `created_at timestamptz NN`, `updated_at timestamptz NN`. Email normalize/validate at API؛ Argon2id hash نه credential plaintext. بدون hard delete در صورت Booking؛ privacy anonymization workflow با سیاست حقوقی. Index `users(status)` فقط اگر سنجش نشان دهد.

### `auth_sessions` [global]
`id uuid PK NN`, `user_id uuid NN FK users`, `created_at timestamptz NN`, `expires_at timestamptz NN`, `revoked_at timestamptz NULL`, `last_seen_at timestamptz NULL`, `client_label text NULL`; CHECK `expires_at>created_at`. Index `(user_id, revoked_at)`. AccessToken دارای `sid` و `sub`؛ token signed و active session DB verify برای Writes، Refresh جریان مستقل.

### `refresh_tokens` [global]
`id uuid PK NN`, `auth_session_id uuid NN FK auth_sessions`, `token_hash text NN UNIQUE`, `issued_at timestamptz NN`, `expires_at timestamptz NN`, `consumed_at timestamptz NULL`, `revoked_at timestamptz NULL`, `previous_token_id uuid NULL FK refresh_tokens`; CHECK expires>issued. Index `(auth_session_id,consumed_at)`. Raw token هرگز ذخیره نشود؛ برای Refresh یک row active، قفل auth_session → refresh_token؛ مصرف دوباره token پس از Rotation موجب ابطال session و همه tokenها و 401 می‌شود.

### `organizations`
`id uuid PK NN`, `name text NN CHECK length 2..160`, `timezone text NN` (IANA validated in app/DB reference validation), `cancellation_cutoff_min integer NN DEFAULT 120 CHECK 0..10080`, `status text NN CHECK IN ('ACTIVE','SUSPENDED')`, `created_at NN timestamptz`, `updated_at NN timestamptz`. Index status اختیاری. هیچ OwnerID تکراری؛ Owner از Membership.

### `memberships` [tenant]
`tenant_id uuid NN FK organizations`, `user_id uuid NN FK users`, `role text NN CHECK IN ('OWNER','MANAGER','RECEPTIONIST','TRAINER')`, `status text NN CHECK IN ('ACTIVE','REVOKED')`, `created_at timestamptz NN`, `updated_at timestamptz NN`, `revoked_at timestamptz NULL`, `revoked_by uuid NULL FK users`; `PRIMARY KEY(tenant_id,user_id)`؛ check status/`revoked_at` consistent؛ Index `(tenant_id,role,status)`. Owner آخر با Transaction row lock organizations و شمارش Owner active پیش از Revocation؛ future branch-scoped ACL خارج MVP.

### `branches` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `name text NN CHECK 2..120`, `address text NULL`, `active boolean NN DEFAULT true`, `created_at timestamptz NN`, `updated_at timestamptz NN`; `UNIQUE(tenant_id,id)`, optional `UNIQUE(tenant_id,name)`. Soft-deactivation only. Sessions FK `(tenant_id,branch_id)`.

### `resources` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `branch_id uuid NULL`, `type text NN CHECK IN('TRAINER','ROOM')`, `trainer_user_id uuid NULL`, `display_name text NN`, `active boolean NN`, `buffer_before_min integer NN DEFAULT 0`, `buffer_after_min integer NN DEFAULT 0`, `created_at/updated_at timestamptz NN`؛ `CHECK buffer_... BETWEEN 0 AND 240`; `CHECK ((type='TRAINER' AND trainer_user_id IS NOT NULL AND branch_id IS NULL) OR (type='ROOM' AND branch_id IS NOT NULL AND trainer_user_id IS NULL))`; FK `(tenant_id,branch_id)→branches`, `(tenant_id,trainer_user_id)→memberships` (nullable composite)؛ unique `(tenant_id,id)`؛ partial unique `(tenant_id,trainer_user_id) WHERE type='TRAINER'`؛ Index `(tenant_id,branch_id,type,active)`. A User's active Membership verified at Session creation; revoking membership does not erase historical FK.

### `services` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `title text NN`, `duration_min integer NN CHECK 5..1440`, `active boolean NN`, `created_at/updated_at timestamptz NN`; unique `(tenant_id,id)`؛ optional unique `(tenant_id,title)` if validated. Duration default suggestion only؛ actual Session start/end authoritative.

### `business_hours` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `branch_id uuid NULL`, `resource_id uuid NULL`, `iso_weekday smallint NN CHECK 1..7`, `start_local time NN`, `end_local time NN`, `end_day_offset smallint NN CHECK IN (0,1)`, `active boolean NN`, `created_at/updated_at NN`; XOR branch/resource scope CHECK, FK `(tenant_id,branch_id)` and `(tenant_id,resource_id)`؛ CHECK `(end_day_offset=1 OR end_local>start_local)` and `(end_day_offset=0 OR end_local<=start_local)`؛ desired non-overlap weekly periods enforced in Application + tested validation, optionally materialized exclusion from canonical UTC dates not valid for recurring DST; Index `(tenant_id,iso_weekday,branch_id,resource_id)`. Hours in org timezone, across midnight supported. Rules overlap ambiguity on policy updates rejected.

### `schedule_exceptions` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `branch_id uuid NULL`, `resource_id uuid NULL`, `kind text NN CHECK IN ('CLOSED','OPEN_OVERRIDE')`, `start_at timestamptz NN`, `end_at timestamptz NN`, `reason text NN`, `created_by uuid NN FK users`, `created_at timestamptz NN`, `active boolean NN`; XOR branch/resource, CHECK end>start، FK composite، Index `(tenant_id,branch_id,start_at)` and `(tenant_id,resource_id,start_at)`؛ Range intersection validated for new Sessions؛ changes never retroactively cancel.

### `sessions` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `branch_id uuid NN`, `service_id uuid NN`, `trainer_resource_id uuid NN`, `room_resource_id uuid NULL`, `start_at timestamptz NN`, `end_at timestamptz NN`, `timezone_snapshot text NN`, `status text NN CHECK IN ('DRAFT','PUBLISHED','CANCELLED','FINISHED')`, `capacity_total integer NN CHECK 1..1000`, `seats_committed integer NN DEFAULT 0`, `version bigint NN DEFAULT 0`, `created_by uuid NN FK users`, `cancel_reason text NULL`, `created_at/updated_at timestamptz NN`; CHECK end>start, `(end_at-start_at)<= interval '24 hours'` and `seats_committed BETWEEN 0 AND capacity_total`، CHECK trainer_resource_id<>room_resource_id, composite FK to branch/service/resources `(tenant_id,id)`, unique `(tenant_id,id)`؛ Index `(tenant_id,start_at,id)`, `(tenant_id,branch_id,start_at,id)`, `(tenant_id,trainer_resource_id,start_at)`, `(tenant_id,status,start_at)`. Trigger/Transaction policy validates types, room branch, org zone and training member status, immutable sensitive fields when published/effective bookings. No cascade into history.

### `resource_allocations` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `session_id uuid NN`, `resource_id uuid NN`, `start_at timestamptz NN`, `end_at timestamptz NN`, `active boolean NN DEFAULT true`, `created_at timestamptz NN`, `deactivated_at timestamptz NULL`; CHECK end>start؛ FK `(tenant_id,session_id)→sessions`, `(tenant_id,resource_id)→resources`؛ unique `(tenant_id,id)` و `(tenant_id,session_id,resource_id)`؛ **GiST EXCLUDE** `(tenant_id WITH =, resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&) WHERE(active)`؛ Index `(tenant_id,session_id)`؛ deactivation retains historical row. Two allocations for same Session cannot duplicate resource. Application plus constraint trigger ensures interval = Session interval expanded by resource buffer and exactly trainer + optional room allocations. `INSERT/UPDATE` writes only via Scheduling TxPort.

### `bookings` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `session_id uuid NN`, `customer_id uuid NN FK users`, `created_by_actor_id uuid NN FK users`, `status text NN CHECK IN ('CONFIRMED','CANCELLED','ATTENDED','NO_SHOW')`, `created_at timestamptz NN`, `cancelled_at timestamptz NULL`, `cancel_reason text NULL`, `updated_at timestamptz NN`; FK `(tenant_id,session_id)→sessions`, unique `(tenant_id,id)`؛ Partial Unique `(tenant_id,session_id,customer_id) WHERE status IN ('CONFIRMED','ATTENDED','NO_SHOW')`; Index `(tenant_id,customer_id,created_at DESC,id)` and `(tenant_id,session_id,status)`؛ soft status, no DELETE. `created_by_actor_id` not used as customer ownership. Cancellation metadata only on CANCELLED, validated by CHECK/trigger.

### `booking_events` [tenant, append-only]
`id uuid PK NN`, `tenant_id uuid NN`, `booking_id uuid NN`, `from_status text NULL`, `to_status text NN`, `actor_id uuid NN FK users`, `reason text NULL`, `at timestamptz NN`, `trace_id text NULL`؛ FK `(tenant_id,booking_id)→bookings`؛ Index `(tenant_id,booking_id,at,id)`؛ only INSERT, deny UPDATE/DELETE via privileges/trigger. `from_status NULL` only initial CONFIRMED.

### `audit_events` [tenant, append-only]
`id uuid PK NN`, `tenant_id uuid NN`, `actor_id uuid NN FK users`, `action text NN`, `aggregate_type text NN`, `aggregate_id uuid NN`, `reason text NULL`, `metadata jsonb NN DEFAULT '{}'`, `occurred_at timestamptz NN`, `trace_id text NULL`؛ Index `(tenant_id,aggregate_type,aggregate_id,occurred_at)`؛ forbid PII/secrets and UPDATE/DELETE. Integrity of generic aggregate_id is app contract, not FK; `booking_events` has strict FK.

### `idempotency_records` [tenant]
`tenant_id uuid NN`, `actor_id uuid NN FK users`, `operation text NN`, `key uuid NN`, `request_hash text NN CHECK length=64`, `state text NN CHECK IN ('PROCESSING','FINAL')`, `response_status smallint NULL`, `response_body jsonb NULL`, `response_headers jsonb NULL`, `created_at timestamptz NN`, `expires_at timestamptz NN`; PRIMARY KEY `(tenant_id,actor_id,operation,key)`؛ CHECK expires>created; `FINAL ⇔ response_status,body non-null`؛ CHECK `response_status BETWEEN 200 AND 499` (do not persist infrastructure 5xx)؛ Index `(expires_at)` for worker; `PROCESSING` MUST NOT COMMIT (guard with deferred DB constraint trigger or all access through privileged TX protocol verified in Spike). Response bodies exclude credentials and PII. An expired record may still replay while retained; after purge key can be reused; client must choose fresh key after 24 h.

### `outbox_events` [tenant]
`id uuid PK NN`, `tenant_id uuid NN`, `aggregate_type text NN`, `aggregate_id uuid NN`, `event_type text NN`, `payload jsonb NN`, `created_at timestamptz NN`, `available_at timestamptz NN`, `lease_until timestamptz NULL`, `published_at timestamptz NULL`, `attempts integer NN DEFAULT 0 CHECK >=0`, `last_error_code text NULL`؛ Index `(published_at,available_at,created_at)` WHERE published_at IS NULL; unique event id globally. Notification delivery not included in critical TX, publisher retry using lease and SKIP LOCKED. No cascade delete with organization.

## 3. Core PostgreSQL constraint contract (illustrative; not executed)
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE sessions
  ADD CONSTRAINT chk_session_capacity CHECK
  (capacity_total >= 1 AND seats_committed >= 0 AND seats_committed <= capacity_total);
CREATE UNIQUE INDEX ux_booking_effective
  ON bookings (tenant_id,session_id,customer_id)
  WHERE status IN ('CONFIRMED','ATTENDED','NO_SHOW');
ALTER TABLE resource_allocations
  ADD CONSTRAINT no_exclusive_resource_overlap EXCLUDE USING gist (
    tenant_id WITH =,
    resource_id WITH =,
    tstzrange(start_at,end_at,'[)') WITH &&
  ) WHERE (active);
-- All FK references to tenant-owned rows use (tenant_id, id):
ALTER TABLE bookings ADD CONSTRAINT fk_booking_session_tenant
  FOREIGN KEY (tenant_id,session_id)
  REFERENCES sessions (tenant_id,id) ON DELETE RESTRICT;
```
`UNIQUE(tenant_id,id)` باید پیش از composite FK ایجاد شود. Exclusion violation SQLSTATE 23P01 به 409 map می‌شود. `tstzrange` یک بازه نیم‌باز (`end` تماس با `start` یعنی عدم تداخل) است؛ برای جلسه 23:30 تا 00:30 روز بعد UTC instant درست، به تاریخ محلی وابسته نیست. Buffer در start_at/end_at تخصیص ذخیره می‌شود و زمان قابل نمایش Session مستقل است.

## 4. Invariants beyond CHECK — database trigger specification
`CHECK` در یک سطر نمی‌تواند COUNT(Bookings) را با Counter تطبیق دهد؛ بنابراین لایه‌های تضمین: تراکنش‌های قفل‌دار + write privilege محدود + reconciliation query. در Spike باید یک **Constraint Trigger DEFERRABLE INITIALLY DEFERRED** روی `sessions`, `bookings`, `resource_allocations` برای وضعیت نهایی Commit ارزیابی شود: (۱) `sessions.seats_committed` = COUNT مؤثر bookingها؛ (۲) هر Session غیر CANCELLED دقیقاً Allocation فعال مربی و در صورت تعیین Room یکی برای Room دارد، بدون Allocation اضافی؛ (۳) interval allocation دقیقاً buffer-expanded Session interval؛ (۴) Session CANCELLED allocation فعال و booking مؤثر ندارد؛ (۵) نوع trainer/room و شعبه با Session سازگارند. Cross-table checks در trigger باید سطر Session را lock کنند و از عدم Deadlock اطمینان حاصل کنند. اگر overhead/locking خطرناک باشد، تغییر فقط از stored functions مجاز با deny-column UPDATE، Query تطبیق CI و on-call reconciliation، و Gate DB تا آزمون `NOT VERIFIED` می‌ماند. SQL بالا تمام این invariantها را به‌تنهایی اثبات نمی‌کند.

## 5. Tenant isolation, deletion, migrations
- Every read/write scoped by tenant from verified identity + target path, and owner filters; FK composite prevents cross-tenant relations even for accidental SQL writes. Global `users` FK intentionally cross tenant only through IDs، endpoint customer lookup unrestricted نیست.
- `ON DELETE RESTRICT` from sessions, bookings, booking_events, memberships and audit; deactivation through status. `organization.delete` در MVP وجود ندارد. Sensitive history retention/anonymization needs legal decision PD-07.
- Use incremental `expand → backfill → verify → contract`, forward-compatible API clients, migration in single controlled pipeline, not API startup, snapshot & restore plan; test migrations on real PostgreSQL incl `btree_gist` and GiST rollback/locks. For large production tables create indexes with appropriate CONCURRENTLY sequencing (cannot run inside generic transaction block). Not done in Phase 01.
- RBAC for DB role: application DML only named tables, none for schema; runtime cannot `DROP`, `TRUNCATE`, mutate Audit; privileged migration role separate. Future RLS may add defense in depth, not substitute authorization.

## 6. ORM decision matrix
| Criterion | Prisma | Drizzle |
|---|---|---|
| `tstzrange`, GiST exclusion, expression/predicate | custom SQL migration required; client coverage may need raw SQL | custom SQL migration required; SQL-first ergonomics helpful |
| Transaction explicit `FOR UPDATE` & typed raw queries | possible via raw queries inside interactive TX; verify connection scope | transaction with SQL primitive; verify same connection/isolation |
| Strict migration drift check | Migrate shadow DB and custom SQL verification | Drizzle Kit custom migrations and introspection; verify drift |
| Long-term readability/modeling | rich generated client | SQL-near syntax |

**Provisional default:** Drizzle + reviewed custom SQL migrations, only if technical Spike proves exclusion, partial unique, composite FK, serial booking TX and DB failure mapping. If Prisma demonstrably meets tests with lower operational risk, ADR revisited. This is *not* a final dependency decision. References: https://www.postgresql.org/docs/18/sql-createtable.html ; https://www.postgresql.org/docs/18/explicit-locking.html ; https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features ; https://orm.drizzle.team/docs/kit-custom-migrations .

## API projection and temporal invariants (design correction)
`staff_session` یک جدول مجزا نیست؛ `StaffSession` از `sessions + resources/branch/service` در tenant scope و Membership فعال ساخته می‌شود. `PublicSession` دقیقاً allowlist شامل `id, serviceTitle, branchName, startAt, endAt, timezone, status=PUBLISHED, seatsAvailable` است؛ API read service موظف است field-level projection انجام دهد، نه `SELECT *` و serialization یک entity داخلی. `seatsAvailable = capacity_total - seats_committed` تنها در سرور محاسبه می‌شود و counterهای داخلی از خروجی Public حذف می‌شوند. برای پاسخ‌های public `serviceTitle` از `services.title` و `branchName` از `branches.name` با join هم‌Tenant است؛ اگر display data موجود نباشد، عرضهٔ دادهٔ معیوب به‌جای fallback ساختگی مجاز نیست (design check, runtime NOT VERIFIED).

تمام `timestamptz` در PostgreSQL یک instant ذخیره می‌کنند و هنگام خروج از API به UTC RFC3339 با `Z` canonical serialize می‌شوند؛ فرمت نمایش SQL client/server timezone معادل واقعیت ذخیره‌شده نیست. اعتبارسنجی offset↔IANA فقط بر ورودی Session creation و `schedule_exceptions` اعمال می‌شود؛ نه `bookings.created_at/cancelled_at`، نه `booking_events.at`، و نه `from/to` query/report instant. `timezone_snapshot` مرتبط با Session، IANA اصلی را برای نمایش محلی حفظ می‌کند. جدول‌های DB تغییری نکرده‌اند؛ این فقط اصلاح حد و قرارداد projection است.
