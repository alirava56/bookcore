/** Bounded in-process Prometheus exposition. One instance per API process; multi-replica
 * collectors must scrape each replica separately. No business identifiers are labels. */
export const BUCKETS=[0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10] as const;
export type MetricEvent='db_transaction_retry'|'db_unknown_commit'|'db_connection_error'|
 'db_pool_acquire_error'|'http_rejected_overload'|'outbox_processing_failure'|
 'outbox_lease_lost'|'inspection_failure'|'auth_rejected'|'authorization_denied'|
 'booking_capacity_conflict'|'idempotent_replay';
export function metricRoute(path:unknown):string {
 if(typeof path!=='string'||path.length>160||!/^\/?[A-Za-z0-9_:/.-]+$/.test(path))return 'unmatched';
 // Only Nest/Express route templates are permitted, never actual URL paths with values.
 if(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(path)||/\/\d+(?:\/|$)/.test(path))return 'unmatched';
 return path||'unmatched';
}
export function statusClass(status:number):string {
 return Number.isInteger(status)&&status>=100&&status<=599?String(Math.floor(status/100))+'xx':'unknown';
}
export function safeLogFields(fields:Record<string,unknown>):Record<string,string|number> {
 const allowed=['event','requestId','method','route','status','durationMs','code','operation','attempt','category','instance'];
 const output:Record<string,string|number>={};
 for(const key of allowed){const v=fields[key];if(typeof v==='number'&&Number.isFinite(v))output[key]=v;
  else if(typeof v==='string'){
   if(key==='requestId'&&/^[a-f0-9-]{36}$/i.test(v))output[key]=v;
   else if(key==='route')output[key]=metricRoute(v);
   else if(key==='instance'&&/^[a-zA-Z0-9_-]{1,32}$/.test(v))output[key]=v;
   else if(['event','method','code','operation','category'].includes(key)&&/^[A-Za-z0-9_.-]{1,64}$/.test(v))output[key]=v;
  }
 }
 return output;
}
const EVENT_NAMES:readonly MetricEvent[]=['db_transaction_retry','db_unknown_commit','db_connection_error',
 'db_pool_acquire_error','http_rejected_overload','outbox_processing_failure','outbox_lease_lost','inspection_failure','auth_rejected','authorization_denied',
 'booking_capacity_conflict','idempotent_replay'];
export class MetricsRegistry {
 private readonly counters=new Map<string,number>();
 private readonly hist=new Map<string,{buckets:number[];count:number;sum:number}>();
 private readonly durations=new Map<string,{count:number;sum:number;buckets:number[]}>();
 private inflight=0;
 private pools={total:0,idle:0,waiting:0};
 private counter(key:string):void{this.counters.set(key,(this.counters.get(key)??0)+1);}
 requestStart():void{this.inflight++;}
 requestFinish(method:string,route:unknown,status:number,seconds:number):void{
  this.inflight=Math.max(0,this.inflight-1);
  const safeMethod=['GET','POST','PATCH','PUT','DELETE','HEAD','OPTIONS'].includes(method)?method:'OTHER';
  const name=metricRoute(route); const key=`${safeMethod}|${name}|${statusClass(status)}`;
  // Cap distinct series; unknown paths collapse to a sentinel.
  const series=this.hist.has(key)||this.hist.size<128?key:`${safeMethod}|other|${statusClass(status)}`;
  this.counter('http|'+series);
  const h=this.hist.get(series)??{buckets:BUCKETS.map(()=>0),count:0,sum:0};
  const value=Number.isFinite(seconds)&&seconds>=0?Math.min(seconds,3600):0;
  h.count++;h.sum+=value;BUCKETS.forEach((b,i)=>{if(value<=b)h.buckets[i]=(h.buckets[i]??0)+1;});
  this.hist.set(series,h);
 }
 observeDuration(name:'db_pool_acquire'|'db_transaction',durationSeconds:number):void {
  const h=this.durations.get(name)??{count:0,sum:0,buckets:BUCKETS.map(()=>0)};
  const secs=Number.isFinite(durationSeconds)&&durationSeconds>=0?Math.min(durationSeconds,3600):0;
  h.count++;h.sum+=secs;BUCKETS.forEach((b,i)=>{if(secs<=b)h.buckets[i]=(h.buckets[i]??0)+1;});
  this.durations.set(name,h);
 }
 event(event:MetricEvent):void {if(EVENT_NAMES.includes(event))this.counter('event|'+event);}
 poolState(total:number,idle:number,waiting:number):void {
  this.pools={total:Math.max(0,Math.floor(total)),idle:Math.max(0,Math.floor(idle)),
   waiting:Math.max(0,Math.floor(waiting))};
 }
 active():number{return this.inflight;}
 render():string {
  const lines:string[]=[
   '# TYPE bookcore_http_inflight gauge',`bookcore_http_inflight ${this.inflight}`,
   '# TYPE bookcore_db_pool_connections gauge',`bookcore_db_pool_connections{state="total"} ${this.pools.total}`,
   `bookcore_db_pool_connections{state="idle"} ${this.pools.idle}`,
   `bookcore_db_pool_connections{state="waiting"} ${this.pools.waiting}`,
   '# TYPE bookcore_http_requests_total counter','# TYPE bookcore_http_request_duration_seconds histogram',
   '# TYPE bookcore_operational_events_total counter',
   '# TYPE bookcore_db_operation_duration_seconds histogram'];
  const sanitize=(v:string)=>v.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  for(const [key,value] of [...this.counters.entries()].sort(([a],[b])=>a.localeCompare(b))){
   if(key.startsWith('event|'))lines.push(`bookcore_operational_events_total{event="${key.slice(6)}"} ${value}`);
   if(key.startsWith('http|')){
    const [method,route,code]=key.slice(5).split('|');
    lines.push(`bookcore_http_requests_total{method="${method}",route="${sanitize(route??'unmatched')}",status_class="${code}"} ${value}`);
   }
  }
  for(const [key,h] of [...this.hist.entries()].sort(([a],[b])=>a.localeCompare(b))){
   const [method,route,code]=key.split('|');const labels=`method="${method}",route="${sanitize(route??'unmatched')}",status_class="${code}"`;
   BUCKETS.forEach((bound,i)=>lines.push(`bookcore_http_request_duration_seconds_bucket{${labels},le="${bound}"} ${h.buckets[i]}`));
   lines.push(`bookcore_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${h.count}`);
   lines.push(`bookcore_http_request_duration_seconds_sum{${labels}} ${h.sum}`);
   lines.push(`bookcore_http_request_duration_seconds_count{${labels}} ${h.count}`);
  }
  for(const [operation,h] of this.durations){
    BUCKETS.forEach((bound,i)=>lines.push(`bookcore_db_operation_duration_seconds_bucket{operation="${operation}",le="${bound}"} ${h.buckets[i]}`));
    lines.push(`bookcore_db_operation_duration_seconds_bucket{operation="${operation}",le="+Inf"} ${h.count}`);
    lines.push(`bookcore_db_operation_duration_seconds_count{operation="${operation}"} ${h.count}`);
    lines.push(`bookcore_db_operation_duration_seconds_sum{operation="${operation}"} ${h.sum}`);
  }
  return lines.join('\n')+'\n';
 }
}
