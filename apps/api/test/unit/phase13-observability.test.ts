import test from 'node:test';import assert from 'node:assert/strict';
import {MetricsRegistry,metricRoute,statusClass,safeLogFields} from '../../src/common/observability/metrics.domain';
test('route labels accept template names only and reject raw UUID routes',()=>{
 assert.equal(metricRoute('/organizations/:orgId/sessions/:sessionId'),'/organizations/:orgId/sessions/:sessionId');
 assert.equal(metricRoute('/organizations/12345/sessions'),'unmatched');
 assert.equal(metricRoute('/organizations/123e4567-e89b-12d3-a456-426614174000'),'unmatched');
 assert.equal(metricRoute('/path?secret=value'),'unmatched');
 assert.equal(metricRoute({path:'/auth'}),'unmatched');
});
test('status classes are bounded and do not reveal raw response data',()=>{
 assert.equal(statusClass(201),'2xx');assert.equal(statusClass(503),'5xx');
 assert.equal(statusClass(999),'unknown');
});
test('structured field redaction removes secret keys, untrusted text and PII',()=>{
 const actual=safeLogFields({event:'BookingConfirmed',authorization:'Bearer secret',customerId:'uuid',
  requestId:'123e4567-e89b-12d3-a456-426614174000',message:'refresh=private',
  route:'/organizations/:orgId',status:409,category:'business',operation:'create',code:'SESSION_FULL'});
 assert.equal(actual.event,'BookingConfirmed');assert.equal(actual.status,409);
 assert.ok(!JSON.stringify(actual).includes('secret'));
 assert.ok(!JSON.stringify(actual).includes('customerId'));
});
test('request metrics measure actual samples and do not expose full path IDs',()=>{
 const m=new MetricsRegistry();m.requestStart();m.requestFinish('POST','/organizations/:orgId/sessions/:id/bookings',201,.023);
 m.requestStart();m.requestFinish('POST','/organizations/123e4567-e89b-12d3-a456-426614174000',409,.202);
 assert.equal(m.active(),0);const rendered=m.render();
 assert.match(rendered,/bookcore_http_requests_total/);assert.match(rendered,/status_class="2xx"/);
 assert.match(rendered,/status_class="4xx"/);assert.ok(!rendered.includes('123e4567-e89b-12d3-a456-426614174000'));
});
test('histogram has cumulative buckets, finite sum and correct count',()=>{
 const m=new MetricsRegistry();for(const ms of [0.02,0.5,3]){m.requestStart();m.requestFinish('GET','/health/ready',200,ms);}
 const exp=m.render();assert.match(exp,/le="\+Inf"} 3/);assert.match(exp,/duration_seconds_count.* 3/);
 assert.match(exp,/duration_seconds_sum.* 3\.52/);
});
test('metrics operational events are finite and predefined, never a user label',()=>{
 const m=new MetricsRegistry();m.event('db_unknown_commit');m.event('http_rejected_overload');
 m.poolState(10,2,5);const exp=m.render();
 assert.match(exp,/db_unknown_commit/);assert.match(exp,/state="waiting"} 5/);
});
test('high-cardinality labels are capped and active gauge never underflows',()=>{
 const m=new MetricsRegistry();for(let i=0;i<300;i++)m.requestFinish('GET',`/resource/:p${i}`,200,0.1);
 assert.ok((m.render().match(/bookcore_http_requests_total\{/g)||[]).length<=129);assert.equal(m.active(),0);
});
