/** The range denotes session start instants in [from,to), max 31 UTC days. */
const RFC3339=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
export function occupancyRange(from:unknown,to:unknown):{from:string;to:string} {
 if(typeof from!=='string'||typeof to!=='string'||!RFC3339.test(from)||!RFC3339.test(to))
  throw new Error('INVALID_REPORTING_RANGE');
 const check=(raw:string):number=>{
  const value=Date.parse(raw);
  if(!Number.isFinite(value))throw new Error('INVALID_REPORTING_RANGE');
  const suffix=raw.slice(19).match(/(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/);
  if(!suffix)throw new Error('INVALID_REPORTING_RANGE');
  const hours=Number(suffix[3]??0),mins=Number(suffix[4]??0);
  if(hours>14||(hours===14&&mins>0))throw new Error('INVALID_REPORTING_RANGE');
  const offset=suffix[1]==='Z'?0:(suffix[2]==='+'?1:-1)*(hours*60+mins);
  if(new Date(value+offset*60000).toISOString().slice(0,19)!==raw.slice(0,19))
   throw new Error('INVALID_REPORTING_RANGE');
  return value;
 };
 const f=check(from),t=check(to);
 if(t<=f||t-f>31*86400000)
  throw new Error('INVALID_REPORTING_RANGE');
 const output={from:new Date(f).toISOString(),to:new Date(t).toISOString()};
 // Reject normalized impossible calendar dates and erroneous offset forms.
 if(!Number.isFinite(Date.parse(output.from))||!Number.isFinite(Date.parse(output.to)))
  throw new Error('INVALID_REPORTING_RANGE');
 return output;
}
