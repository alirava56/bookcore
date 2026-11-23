# BookCore — مدل دامنه، مالکیت و مرز ماژول‌ها

## واژگان ثابت
`User` هویت سراسری؛ `Membership` عضویت **کارمندی سازمان**؛ `Customer` نقش کسب‌وکاری کاربر مالک Booking بدون نیاز به Membership؛ `actor_id` اقدام‌کننده، `customer_id` دریافت‌کننده خدمت، `tenant_id` مالک داده. `Resource` موجودیت قابل زمان‌بندی داخل Tenant؛ `Trainer` نوع Resource با لینک `trainer_user_id`، نه خود User. `Session` یک نوبت خدمت با مربی و ظرفیت؛ `Booking` تعهد یک صندلی؛ `ResourceAllocation` اشغال فیزیکی منبع مستقل از تعداد Booking.

## Entity و Aggregate
| Entity | شناسه/مالک | قانون کلیدی | تغییر مجاز |
|---|---|---|---|
| User | global UUID | Email یکتا، `ACTIVE/SUSPENDED` | خود کاربر/Identity admin تحت سیاست |
| Organization | UUID, root tenant | timezone IANA, cutoff, وضعیت | Owner |
| Membership | `(tenant_id,user_id)` | `OWNER/MANAGER/RECEPTIONIST/TRAINER`, `ACTIVE/REVOKED`; Customer عضو ضروری نیست | Owner؛ Manager فقط Receptionist/Trainer |
| Branch | `(tenant_id,id)` | متعلق Tenant؛ soft deactivate | Owner/Manager |
| Resource | `(tenant_id,id)` | TRAINER با trainer_user_id فعال در Tenant و branch_id NULL؛ ROOM با branch_id؛ Resource یک Trainer در یک Tenant | Owner/Manager |
| Service | `(tenant_id,id)` | duration_min مثبت و فعال | Owner/Manager |
| Session | `(tenant_id,id)` | service/branch/resource موجود؛ start<end؛ Draft→Published→Finished یا Cancelled؛ Counter 0..total | Owner/Manager |
| ResourceAllocation | `(tenant_id,id)` | انحصاری؛ active interval نیم‌باز و Buffer؛ Session یک Trainer و 0/1 Room | فقط Scheduling در TX |
| Booking | `(tenant_id,id)` | customer_id جهانی، created_by_actor_id؛ CONFIRMED/CANCELLED/ATTENDED/NO_SHOW | Booking use case |
| BookingEvent | append-only UUID | before/after, actor, timestamp, reason, event kind | Booking/Audit در TX |
| IdempotencyRecord | `(tenant,actor,operation,key)` | request fingerprint و پاسخ نهایی در همان Commit | Platform/Booking |
| OutboxEvent | UUID, tenant | event_id و payload مینیمم؛ at-least-once | Aggregate use cases + dispatcher |

### Aggregate ownership
Session و Counter + Allocations در Scheduling/Booking تحت قفل Session؛ هیچ ماژولی حق تغییر مستقیم Counter جز Booking Application Service ندارد. Booking تغییر Lifecycle را مالک است، Scheduling تغییر Session و Allocation را مالک است؛ برای Cancel Session یک orchestration در Scheduling به `Booking.cancelAllForSession(...)` در **همان UnitOfWork** فراخوانی می‌کند. Repository داخلی بین ماژول‌ها وارد نمی‌شود؛ تراکنش مشترک از Platform UnitOfWork تزریق می‌شود؛ مالکیت سطر/نوشتن فقط از Interfaceهای اعلان‌شده. Eventها داخل همان TX ثبت می‌شوند.

## Boundaries (وابستگی‌های رو به جلو)
| Context | Owned entities / Responsibility | Public interfaces / dependency | ممنوع |
|---|---|---|---|
| Identity | users, auth_sessions, refresh_tokens; Login/Revocation | `requireActiveSession`, `getUser`؛ وابسته به Platform | import Booking و tenant authorization |
| Organizations | organizations, memberships, branches; tenant roles | `authorizeMembershipLocked`, `requireBranch`؛ Identity, Platform | خواندن Booking Repository |
| Catalog | resources, services; trainer-user mapping | `resolveResources`, `getService`; Organizations | تغییر Session/Counter |
| Scheduling | hours/exceptions, sessions, allocations | `createDraft`, `publish`, `cancelSession`, `finish`, `updateCapacity`; Catalog/Organizations + Booking public port | ایجاد Booking بدون Booking port |
| Booking | bookings, booking_events, counter transition policy, idempotent write | `book`, `cancel`, `attendance`, `cancelAllForSession`; Scheduling read/lock ports, Identity, Organizations, Platform | دورزدن Row Lock و DB checks |
| Audit | تغییرات مهم actor/action و booking event read model | append audit port در UnitOfWork | Mutate Booking history |
| Reporting | read-only query/aggregation, tenant filters | query interfaces مجاز از Catalog/Scheduling/Booking | نوشتن Counter یا اعمال مجوز صرفاً در UI |
| Platform | UoW, SQL adapters, idempotency, Outbox dispatcher, health, observability | استاندارد خطا و Trace و TX | مقررات کسب‌وکار وابسته به HTTP |

وابستگی دوطرفه Scheduling↔Booking فقط در سطح **پورت‌های اپلیکیشن** ممکن است چرخه بسازد؛ برای رفع آن، `SessionLifecycleCoordinator` در Composition Root برنامه قرار می‌گیرد و دو پورت `SchedulingTxPort`, `BookingTxPort` را در UoW واحد فرا می‌خواند. هیچ Import چرخه‌ای در NestJS مجاز نیست. واگذاری Session ownership همچنان Scheduling باقی می‌ماند.

## ردیابی نقش، مالکیت و Token
- User چند Membership در Tenantهای مستقل می‌تواند داشته باشد؛ هر Tenant staff profile مستقل. مشتری می‌تواند بدون Membership، رزرو شخصی ثبت کند؛ هیچ `role=CUSTOMER` در جدول Membership ذخیره نمی‌شود؛ این یک اصلاح معنایی نسبت به Blueprint است (A-04).
- Trainer یک User دارد که Membership فعال TRAINER آن Tenant را داراست. یک Resource واحد در همان Tenant می‌تواند در Branchهای متفاوت Allocation داشته باشد. برای یک User در دو Tenant، دو Resource متفاوت داریم؛ **عدم تداخل بین Tenantها تضمین نمی‌شود** و نباید ادعای سراسری داشت.
- یک Booking متعلق به Tenant جلسه و به `customer_id` جهانی است؛ `created_by_actor_id` برای Staff با customer فرق دارد. Owner/Receptionist حق تغییر Customer یا Tenant موجود بعد از ساخت ندارند.
- Revocation عضو باید با قفل Membership و AuthSession در Transaction مدیریت شود؛ پس از Commit Revocation هیچ عملیات جدیدی که قفل عضویت را بعداً دریافت کند مجاز نیست. عملیات قبلاً قفل‌شده می‌تواند پیش از Commit Revocation کامل شود.
- Deactivate یک Customer، ثبت رزرو جدید و ورود را ممنوع می‌کند، ولی Booking و Eventهای قبلی بدون حذف باقی می‌مانند؛ Admin تا پیش از شروع می‌تواند با reason لغو کند. تغییر وضعیت User با زنجیره‌ای از Session cancels خودکار همراه نیست.

## Invariant Matrix
| Blueprint ID | Specification 1.1 | Enforcement |
|---|---|---|
| INV-01 | `capacity_total >= 1` و `0<=seats_committed<=capacity_total` | CHECK + UoW |
| INV-02 | `CONFIRMED/ATTENDED/NO_SHOW` مؤثر؛ Attendance Counter را عوض نمی‌کند | state machine + COUNT audit |
| INV-03 | درج Booking و Counter و Event در یک TX | TX + rollback |
| INV-04 | یک Customer/Session حداکثر یک effective Booking | Partial UNIQUE |
| INV-05 | تخصیص انحصاری Session به Resource بدون overlap | EXCLUDE GiST |
| INV-06 | only PUBLISHED and before start can book | locked session + DB time |
| INV-07 | change trainer/time with effective bookings forbidden | update policy |
| INV-08 | customer cutoff; staff override with reason before start | policy + DB time |
| INV-09 | Tenant FK and object-scoped permission | composite FK + policy |
| INV-10 | external notification not on booking commit path | outbox |
| INV-11 | same request/key exactly one effect; key hash mismatch 409 | Idempotency UNIQUE |
| INV-12 | no hard delete of booking/events | RESTRICT + DB permission + Audit |
| INV-13 | DB clock used for deadline checks | `clock_timestamp()` in locked TX |
| INV-14 | GET available seats not a reservation | POST TX authoritative |

## Domain events و پروتکل انتشار
`SessionCreated`, `SessionPublished`, `SessionCancelled`, `SessionFinished`, `SessionCapacityChanged`, `BookingConfirmed`, `BookingCancelled`, `BookingAttendanceMarked`, `MemberRevoked`, `ResourceAllocationChanged`. Eventها minimal و PII-free، شناسهٔ Tenant/aggregate/event و `occurred_at` دارند؛ Outbox transactionally inserted. Consumer duplicate-safe، گزارش از SQL read snapshot، نه Queue.

## Transaction boundaries and domain events per module
| Module | Unit of work / commit ownership | Emitted events | Forbidden TX behavior |
|---|---|---|---|
| Identity | registration and refresh rotation independently; active auth_session lock during other writes | `UserRegistered`, `SessionRevoked` (audit) | calling Scheduling repositories |
| Organizations | org+first owner atomic; membership update/last-owner check under organization lock | `OrganizationCreated`, `MemberRevoked` | altering Booking historical owner |
| Catalog | resource/service creation and status updates in local TX | `ResourceCreated`, `ServiceCreated` | changing allocations without Scheduling |
| Scheduling | create Session+allocations+outbox, publish, finish, capacity; cancel Session through Coordinator shared TX | `SessionCreated/Published/Finished/Cancelled`, `ResourceAllocationChanged` | committing cancellation before Booking.cancelAll |
| Booking | booking+counter+events+outbox+idempotency in one TX | `BookingConfirmed/Cancelled/AttendanceMarked` | updating sessions Counter without Session lock |
| Audit | write event in *caller* UoW, read in independent read-only TX | append audit only | standalone audit insert after business Commit |
| Reporting | read-only snapshot with tenant predicate | none | writing live aggregate state |
| Platform | UoW + idempotency claim; Outbox dispatcher separate post-commit TX | dispatch status only | external provider call within business TX |

All sessions and bookings are in the **same PostgreSQL database**; the coordinator owns the common transaction boundary and injects typed ports, so no cross-context distributed transaction or cyclic imports are required.

## Read projections / API-level domain protection (Phase 01 correction)
`Session` entity و `StaffSession` DTO دو شیء متفاوت‌اند؛ DTO عمومی `PublicSession` یک projection مبتنی بر allowlist است و هیچ وابستگی به `StaffSession` ندارد. Client ناشناس فقط از `/public/organizations/{orgId}/sessions` و detail آن، موارد `PUBLISHED` قابل نمایش را می‌بیند. مسیرهای `/organizations/{orgId}/sessions` برای Staff هستند و فقط با Membership فعال و محدودهٔ Trainer assigned پاسخ می‌دهند. نام خدمت/شعبه از Catalog و Organizations public display fields استخراج می‌شود؛ `seatsAvailable` snapshot است نه نگهداشت ظرفیت؛ `seatsCommitted`, `capacityTotal`, `trainerResourceId`, `roomResourceId`, `version`, `tenantId` در DTO عمومی ممنوع است.

`MeResponse = { user: User, memberships: ActiveMembership[] }`؛ آرایه فقط `Membership.status=ACTIVE` را دارد. هویت `Customer` هرگز به‌صورت role ساختگی در آن اضافه نمی‌شود. Token یا Password hash در profile وجود ندارد. Event instant (`createdAt`, `cancelledAt`, `BookingEvent.at`) UTC و مستقل از policy تطبیق Offset برای Session scheduling input است.
