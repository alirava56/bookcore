# Inspector v2 — راهنمای عملیاتی

**نیازمندی:** PostgreSQL 17، Migration 012، LOGIN شخصی عضو `bookcore_inspector` و ثبت‌شده در `bookcore_operator_identities` با User فعال و عضویت OWNER فعال در همان Tenant. `BOOKCORE_INSPECT_DATABASE_URL` باید Credential جدا از HTTP/Worker باشد. `BOOKCORE_INSPECTION_CURSOR_KEY` باید حداقل ۳۲ بایت تصادفی Base64URL و تنها در Secret Manager باشد.

**استفاده:** پس از Build:

```sh
node dist/scripts/operational-inspection-v2.js --tenant '<uuid>' --all --limit 50 --max-pages 20
node dist/scripts/operational-inspection-v2.js --tenant '<uuid>' --kind BOOKING --limit 50 --max-pages 20 --cursor '<signed-cursor>'
```

`--all` تا شش نوع SESSION/BOOKING/OUTBOX/COUNTER/INVITATION/CONSENT را می‌خواند. اگر سقف صفحات تمام شود، خروجی `incompleteKinds` و `cursors` دارد. Cursor با HMAC، Tenant/Kind/AsOf/After را به هم متصل می‌کند؛ تغییر Key در میانهٔ پیمایش باعث ابطال Cursor می‌شود. هر Page یک `READ ONLY` مستقل با Timeout ۱۲ ثانیه دارد؛ `--all` حداکثر ۲۰هزار سطر را در یک اجرای CLI می‌پیماید.

**خروجی و Exit:** JSON شامل یافته‌ها، پوشش هر نوع، `coverageComplete`, `consistentSnapshot:false`, `certifiedIntegrity:false`. Exit ۰ فقط اگر `--all` تمام شود و یافته‌ای نباشد؛ ۲ اگر همهٔ انواع تمام شوند ولی یافته وجود داشته باشد؛ ۳ برای پیمایش ناقص؛ ۱ برای خطای دسترسی/اجرا. Exit صفر **گواهی یکپارچگی تراکنشی نیست**.

**حریم خصوصی:** خروجی فقط مشخصات Aggregate و Diagnostic را شامل می‌شود؛ حاوی توکن/Password نیست، اما UUIDها عملیاتی هستند و باید محدود به Operator بمانند.

**محدودیت:** بعد از Resume یک Kind، نمی‌توان ادعا کرد همهٔ Kindها در یک Snapshot دیده شده‌اند؛ مصرف‌کننده باید Coverage نوع‌ها را بیرون از این CLI ثبت کند. Indexهای UUID به‌جای `OFFSET` استفاده می‌شوند. هیچ تعمیر خودکار فعال نیست.
