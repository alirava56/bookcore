import {book, type BookingInput} from './operations.js';
import {closeDb} from './db.js';

type Job = BookingInput;
let started=false;
let closing=false;
function sendAndDisconnect(message:unknown):void {
 if (closing) return;
 closing=true;
 if (!process.connected || !process.send) { process.exitCode=1; return; }
 process.send(message,err=>{
   if(err) process.exitCode=1;
   // Releasing the IPC channel lets the child exit naturally after pool.end().
   if(process.connected) process.disconnect();
 });
}
process.on('message',async (msg:unknown)=>{
 if(started) return;
 if(!msg || typeof msg!=='object' || !('type' in msg) || msg.type!=='go') return;
 started=true;
 try {
  const jobs=(msg as {jobs?:Job[]}).jobs;
  if(!Array.isArray(jobs) || jobs.length===0) throw new Error('invalid worker jobs');
  const start=performance.now();
  const results=await Promise.all(jobs.map(async job=>{
   const t0=performance.now();
   try {
    const r=await book(job);
    return {status:r.status,code:r.body.code??null,latencyMs:performance.now()-t0};
   } catch(err) {
    // Errors are preserved as observations, never mapped to successful bookings.
    return {status:0,code:err instanceof Error ? err.name : String(err),latencyMs:performance.now()-t0};
   }
  }));
  await closeDb();
  sendAndDisconnect({type:'finished',pid:process.pid,elapsedMs:performance.now()-start,results});
 } catch(err) {
  process.exitCode=1;
  try { await closeDb(); } catch { /* closing failed; process must fail */ }
  sendAndDisconnect({type:'fatal',pid:process.pid,error:err instanceof Error ? err.message : String(err)});
 }
});
process.on('disconnect',()=>{
 if(!closing) process.exitCode=1;
});
if(!process.send) throw new Error('worker requires Node IPC');
process.send({type:'ready',pid:process.pid},err=>{if(err)process.exitCode=1;});
