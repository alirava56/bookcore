import {pool,closeDb} from './db.js';
// Detect drifts including wrong buffer intervals and unintended extra allocations.
export const reconciliationSql = `
SELECT s.tenant_id,s.id AS session_id,
 s.seats_committed AS counter,(
 SELECT count(*) FROM bookings b WHERE b.tenant_id=s.tenant_id AND b.session_id=s.id
 AND b.status IN ('CONFIRMED','ATTENDED','NO_SHOW')) AS actual_effective,
 (SELECT count(*) FROM resource_allocations a WHERE a.tenant_id=s.tenant_id
 AND a.session_id=s.id AND a.active) AS actual_allocations,
 CASE WHEN s.status='CANCELLED' THEN 0 ELSE (1+CASE WHEN s.room_resource_id IS NULL THEN 0 ELSE 1 END) END AS expected_allocations,
 (SELECT count(*) FROM resource_allocations a JOIN resources r ON r.tenant_id=a.tenant_id AND r.id=a.resource_id
  WHERE a.tenant_id=s.tenant_id AND a.session_id=s.id AND a.active AND
   (a.start_at <> s.start_at-(r.buffer_before_min*interval '1 minute') OR
    a.end_at <> s.end_at+(r.buffer_after_min*interval '1 minute') OR
    NOT ((r.type='TRAINER' AND r.id=s.trainer_resource_id) OR
         (r.type='ROOM' AND r.id=s.room_resource_id AND r.branch_id=s.branch_id)))) AS bad_intervals
FROM sessions s
WHERE s.seats_committed<>(SELECT count(*) FROM bookings b WHERE b.tenant_id=s.tenant_id AND b.session_id=s.id
  AND b.status IN ('CONFIRMED','ATTENDED','NO_SHOW'))
 OR (SELECT count(*) FROM resource_allocations a WHERE a.tenant_id=s.tenant_id AND a.session_id=s.id AND a.active)
    <> CASE WHEN s.status='CANCELLED' THEN 0 ELSE (1+CASE WHEN s.room_resource_id IS NULL THEN 0 ELSE 1 END) END
 OR EXISTS(SELECT 1 FROM resource_allocations a JOIN resources r ON r.tenant_id=a.tenant_id AND r.id=a.resource_id
  WHERE a.tenant_id=s.tenant_id AND a.session_id=s.id AND a.active AND
   (a.start_at <> s.start_at-(r.buffer_before_min*interval '1 minute') OR
    a.end_at <> s.end_at+(r.buffer_after_min*interval '1 minute') OR
    NOT ((r.type='TRAINER' AND r.id=s.trainer_resource_id) OR
         (r.type='ROOM' AND r.id=s.room_resource_id AND r.branch_id=s.branch_id))));`;
// Supplementary detection only: transactional deferred triggers provide the
// enforcement. This report verifies complete append-only history on persisted rows.
export const bookingHistoryReconciliationSql = `
SELECT b.tenant_id,b.id AS booking_id,b.status,b.cancel_reason,
 count(e.id)::int AS event_count,
 max(e.to_status) FILTER (WHERE e.rn=1) AS first_to,
 max(e.from_status) FILTER (WHERE e.rn=1) AS first_from,
 max(e.to_status) FILTER (WHERE e.rn=2) AS second_to,
 max(e.from_status) FILTER (WHERE e.rn=2) AS second_from,
 max(e.reason) FILTER (WHERE e.rn=2) AS second_reason
FROM bookings b LEFT JOIN LATERAL (
 SELECT ev.id,ev.from_status,ev.to_status,ev.reason,
   row_number() OVER (ORDER BY ev.event_order) rn
 FROM booking_events ev WHERE ev.tenant_id=b.tenant_id AND ev.booking_id=b.id
) e ON true
GROUP BY b.tenant_id,b.id,b.status,b.cancel_reason
HAVING count(e.id) <> CASE WHEN b.status='CONFIRMED' THEN 1 ELSE 2 END
 OR max(e.to_status) FILTER (WHERE e.rn=1) IS DISTINCT FROM 'CONFIRMED'
 OR max(e.from_status) FILTER (WHERE e.rn=1) IS NOT NULL
 OR (b.status<>'CONFIRMED' AND (
   max(e.to_status) FILTER (WHERE e.rn=2) IS DISTINCT FROM b.status
   OR max(e.from_status) FILTER (WHERE e.rn=2) IS DISTINCT FROM 'CONFIRMED'
   OR (b.status='CANCELLED' AND max(e.reason) FILTER (WHERE e.rn=2) IS DISTINCT FROM b.cancel_reason)
 ))`;
if(process.argv[1]?.endsWith('reconcile.js')){
 Promise.all([pool.query(reconciliationSql),pool.query(bookingHistoryReconciliationSql)])
  .then(async ([r,h])=>{
    console.log(JSON.stringify({sessionDrifts:r.rows,bookingHistoryDrifts:h.rows},null,2));
    await closeDb();
    if(r.rows.length || h.rows.length) process.exitCode=1;
  }).catch(async e=>{console.error(e);await closeDb();process.exitCode=2;});
}
