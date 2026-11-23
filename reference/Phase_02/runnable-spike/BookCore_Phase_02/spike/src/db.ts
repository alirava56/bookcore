import { Pool, type PoolClient } from 'pg';

export type SqlClient = Pick<PoolClient, 'query'>;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://bookcore:bookcore_local_only@127.0.0.1:55432/bookcore_spike',
  max: Number(process.env.PG_POOL_MAX || 12),
  application_name: process.env.BOOKCORE_INSTANCE || `bookcore-spike-${process.pid}`,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 5000,
});

/** A network-level failure during COMMIT means neither success nor abort is proven. */
export class UnknownCommitOutcome extends Error {
  constructor(cause: unknown) {
    super('COMMIT response unknown: recover with original Idempotency-Key; do not guess the outcome', {cause});
    this.name = 'UnknownCommitOutcome';
  }
}
export const codeOf = (err: unknown): string | undefined =>
  err !== null && typeof err === 'object' && 'code' in err && typeof err.code === 'string' ? err.code : undefined;

/** Only a PostgreSQL ERROR response is evidence of a rejected COMMIT.
 * FATAL/PANIC may terminate the connection after an uncertain server-side outcome;
 * never reinterpret such a lost acknowledgement as a proven rollback.
 */
export const serverRejectedTransaction = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const obj = err as { code?: unknown; severity?: unknown };
  return typeof obj.code === 'string' && /^[A-Z0-9]{5}$/.test(obj.code)
    && obj.severity === 'ERROR';
};
const retryableAbort = (err:unknown) => serverRejectedTransaction(err) &&
  ['40P01','40001'].includes(codeOf(err) ?? '');

export async function transaction<T>(fn:(client: PoolClient)=>Promise<T>, attempts=3):Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error('invalid retry budget');
  for (let attempt=1; attempt<=attempts; attempt++) {
    const client = await pool.connect();
    let begun=false, commitStarted=false, committed=false, broken=false, retry=false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED'); begun=true;
      await client.query("SELECT set_config('lock_timeout', $1, true)", [process.env.LOCK_TIMEOUT || '30s']);
      await client.query("SELECT set_config('statement_timeout', $1, true)", [process.env.STATEMENT_TIMEOUT || '60s']);
      await client.query("SELECT set_config('idle_in_transaction_session_timeout', '120s', true)");
      const result=await fn(client);
      commitStarted=true;
      await client.query('COMMIT'); committed=true;
      return result;
    } catch (err) {
      if (begun && !commitStarted) {
        try { await client.query('ROLLBACK'); } catch { broken=true; }
      }
      if (commitStarted) {
        broken=true; // uncertain/failed COMMIT connections must never re-enter the pool.
        if (!serverRejectedTransaction(err)) throw new UnknownCommitOutcome(err);
      }
      if (retryableAbort(err) && attempt < attempts) retry=true;
      else throw err;
    } finally {
      // If COMMIT started but never returned success, even a definitive SQL error
      // can leave a session in a connection-level state not worth reusing.
      client.release(broken || (commitStarted && !committed));
    }
    if(retry) {
      // Bounded backoff after releasing the connection, not while holding a pool slot.
      await new Promise<void>(r=>setTimeout(r,attempt*30));
      continue;
    }
  }
  throw new Error('retry budget exhausted');
}
export const one = async <T>(db:SqlClient, sql:string, params:unknown[]=[]):Promise<T|null> => {
  const r=await db.query(sql,params);
  return (r.rows[0] as T|undefined)??null;
};
export async function closeDb():Promise<void> {await pool.end();}
