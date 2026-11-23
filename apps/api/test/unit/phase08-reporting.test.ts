import test from 'node:test';import assert from 'node:assert/strict';
import {occupancyRange} from '../../src/modules/reporting/reporting.domain';
test('occupancy 31-day half-open UTC range',()=>{
 const r=occupancyRange('2026-11-01T00:00:00+03:30','2026-12-02T00:00:00+03:30');
 assert.equal(r.from,'2026-10-31T20:30:00.000Z');
 assert.equal(r.to,'2026-12-01T20:30:00.000Z');
});
test('occupancy missing dates, reversed intervals, invalid offsets, >31 days denied',()=>{
 for(const [from,to] of [[undefined,'2026-12-01T00:00:00Z'],['2026-11-02T00:00:00Z',undefined],
 ['2026-11-02T00:00:00Z','2026-11-01T00:00:00Z'],
 ['2026-11-01T00:00:00Z','2026-12-03T00:00:00Z'],
 ['2026-11-01T00:00:00','2026-11-02T00:00:00Z'],
 ['2026-11-01T00:00:00+15:00','2026-11-02T00:00:00Z']])
 assert.throws(()=>occupancyRange(from,to),/INVALID_REPORTING_RANGE/);
});

test('invalid calendar day and out-of-range timezone offsets are rejected',()=>{
 for(const from of ['2026-02-30T00:00:00Z','2026-11-01T00:00:00+14:45'])
  assert.throws(()=>occupancyRange(from,'2026-12-01T00:00:00Z'),/INVALID_REPORTING_RANGE/);
});
