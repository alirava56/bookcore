import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

// Intentionally internal, not reachable over HTTP until real authz and domain verification exist.
// Only callable with the transaction-scoped client supplied by UnitOfWork.run.
export interface LockedSession {
  id:string;tenant_id:string;status:string;capacity_total:number;seats_committed:number;
}
@Injectable()
export class BookingSqlAdapter {
  async lockSession(client:PoolClient,tenantId:string,sessionId:string):Promise<LockedSession|null> {
    const result=await client.query<LockedSession>(
      'SELECT id,tenant_id,status,capacity_total,seats_committed FROM sessions WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [tenantId,sessionId],
    );
    return result.rows[0] ?? null;
  }
  async appendOutbox(client:PoolClient,tenantId:string,aggregateType:string,
    aggregateId:string,eventType:string):Promise<string> {
    const id=randomUUID();
    await client.query('INSERT INTO outbox_events(id,tenant_id,aggregate_type,aggregate_id,event_type,payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
      [id,tenantId,aggregateType,aggregateId,eventType,JSON.stringify({id:aggregateId})]);
    return id;
  }
}
