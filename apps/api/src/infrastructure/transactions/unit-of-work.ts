import {Optional} from '@nestjs/common';
import {MetricsService} from '../../common/observability/metrics.registry';
import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { DatabaseService } from '../database/database.service';
import { confirmedPgAbort,sqlDisposition,UnknownCommitOutcome } from './sqlstate';

export interface TransactionPort {
  run<T>(fn:(client:PoolClient)=>Promise<T>,maxAttempts?:number):Promise<T>;
}
@Injectable()
export class UnitOfWork implements TransactionPort {
  constructor(private readonly database:DatabaseService,@Inject(APP_CONFIG) private readonly config:AppConfig,@Optional() private readonly metrics?:MetricsService) {}
  async run<T>(fn:(client:PoolClient)=>Promise<T>,maxAttempts=3):Promise<T> {
    if(!Number.isSafeInteger(maxAttempts) || maxAttempts<1 || maxAttempts>5)
      throw new Error('INVALID_TRANSACTION_RETRY_BUDGET');
    for(let attempt=1;attempt<=maxAttempts;attempt++) {
      const started=performance.now();
      const client=await this.database.connect();
      let inTransaction=false;
      let commitStarted=false;
      let committed=false;
      let broken=false;
      let retry=false;
      try {
        await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        inTransaction=true;
        await client.query("SELECT set_config('lock_timeout', $1, true)", [`${this.config.txLockTimeoutMs}ms`]);
        await client.query("SELECT set_config('statement_timeout', $1, true)", [`${this.config.txStatementTimeoutMs}ms`]);
        const result=await fn(client);
        commitStarted=true;
        await client.query('COMMIT');
        committed=true;
        return result;
      } catch(err) {
        if(inTransaction && !commitStarted) {
          try {await client.query('ROLLBACK');} catch {broken=true;}
        }
        if(commitStarted) {
          broken=true;
          if(!confirmedPgAbort(err)){this.metrics?.event('db_unknown_commit');throw new UnknownCommitOutcome();}
        }
        retry=sqlDisposition(err)==='retryable-abort' && attempt<maxAttempts &&
          (!broken || (commitStarted && confirmedPgAbort(err)));
        if(retry)this.metrics?.event('db_transaction_retry');
        if(!retry)throw err;
      } finally {
        // A failed COMMIT is never returned to the pool as a healthy connection.
        client.release(broken || (commitStarted && !committed));
        this.metrics?.observeDuration('db_transaction',(performance.now()-started)/1000);
      }
      if(retry) await new Promise<void>((resolve)=>setTimeout(resolve,Math.min(120,attempt*25)));
    }
    throw new Error('RETRY_BUDGET_EXHAUSTED');
  }
}
