#!/bin/sh
set -eu
# Runs only on the first initialization of a NEW development database.
: "${PG_DEV_APP_PASSWORD:?PG_DEV_APP_PASSWORD required}"
: "${PG_DEV_WORKER_PASSWORD:?PG_DEV_WORKER_PASSWORD required}"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v app_password="$PG_DEV_APP_PASSWORD" -v worker_password="$PG_DEV_WORKER_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE bookcore_app LOGIN PASSWORD %L', :'app_password') \gexec
SELECT format('CREATE ROLE bookcore_worker_login LOGIN PASSWORD %L', :'worker_password') \gexec
SQL
