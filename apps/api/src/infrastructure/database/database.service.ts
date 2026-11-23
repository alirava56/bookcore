import {Optional} from '@nestjs/common';
import {MetricsService} from '../../common/observability/metrics.registry';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryConfig } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import {REQUIRED_MIGRATION_SHA256} from './migration-checksums';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool:Pool;
  constructor(@Inject(APP_CONFIG) private readonly config:AppConfig,
    @Optional() private readonly metrics?:MetricsService) {
    this.pool=new Pool({
      connectionString:config.databaseUrl,
      max:config.dbPoolMax,
      connectionTimeoutMillis:config.connectionTimeoutMs,
      idleTimeoutMillis:30000,
      application_name:'bookcore-api',
    });
    // A network error on an idle client otherwise becomes an unhandled EventEmitter error.
    this.pool.on('error',()=>{ this.metrics?.event('db_connection_error'); });
  }
  poolStatistics():{total:number;idle:number;waiting:number} {
    return {total:this.pool.totalCount,idle:this.pool.idleCount,waiting:this.pool.waitingCount};
  }
  async connect():Promise<PoolClient> {
    const start=performance.now();
    try {return await this.pool.connect();}
    catch(err){this.metrics?.event('db_pool_acquire_error');throw err;}
    finally {this.metrics?.observeDuration('db_pool_acquire',(performance.now()-start)/1000);}
  }
  async ready():Promise<boolean> {
    try {
      const expected=Object.entries(REQUIRED_MIGRATION_SHA256);
      // pg supports per-query timeouts, which its QueryConfig type does not expose.
      const ledgerQuery:QueryConfig&{query_timeout:number}={
        text:`SELECT name,checksum_sha256 FROM bookcore_migrations WHERE name = ANY($1::text[])`,
        values:[expected.map(([name])=>name)],query_timeout:this.config.healthQueryTimeoutMs,
      };
      const result=await this.pool.query<{name:string;checksum_sha256:string}>(ledgerQuery);
      if(result.rows.length!==expected.length || result.rows.some(row=>
       REQUIRED_MIGRATION_SHA256[row.name]!==row.checksum_sha256))return false;
      const schemaQuery:QueryConfig&{query_timeout:number}={text:`SELECT
       to_regclass('public.users') IS NOT NULL AS users_ok,
       to_regclass('public.auth_sessions') IS NOT NULL AS sessions_ok,
       to_regclass('public.refresh_tokens') IS NOT NULL AS refresh_ok,
       to_regclass('public.memberships') IS NOT NULL AS members_ok,
       to_regclass('public.password_credentials') IS NOT NULL AS credentials_ok,
       to_regclass('public.business_hours') IS NOT NULL AS hours_ok,
       to_regclass('public.schedule_exceptions') IS NOT NULL AS exceptions_ok,
       to_regclass('public.processed_outbox_events') IS NOT NULL AS outbox_receipts_ok,
       to_regclass('public.staff_invitations') IS NOT NULL AS invitations_ok,
       to_regclass('public.booking_consents') IS NOT NULL AS consents_ok,
       to_regclass('public.outbox_event_counters') IS NOT NULL AS outbox_counters_ok,
       to_regclass('public.bookcore_operator_identities') IS NOT NULL AS ops_ok,
       to_regclass('public.bookcore_maintenance_audit') IS NOT NULL AS maintenance_ok`,
       query_timeout:this.config.healthQueryTimeoutMs};
      const schema=await this.pool.query<Record<string,boolean>>(schemaQuery);
      const r=schema.rows[0];
      return Boolean(r?.ops_ok&&r?.maintenance_ok&&r?.users_ok&&r?.sessions_ok&&r?.refresh_ok&&r?.members_ok&&r?.credentials_ok&&r?.hours_ok&&r?.exceptions_ok&&r?.outbox_receipts_ok&&r?.invitations_ok&&r?.consents_ok&&r?.outbox_counters_ok);
    } catch { return false; }
  }
  async onModuleDestroy():Promise<void> { await this.pool.end(); }
}
