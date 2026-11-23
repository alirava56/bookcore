'use strict';
const {spawn}=require('node:child_process');
const {fail}=require('./policy.cjs');
// Credentials are passed ONLY through environment, never command arguments or visible logs.
function run(bin,args,env,options={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(bin,args,{env,stdio:['ignore','pipe','pipe'],shell:false});
  let out='',outSize=0;let errSize=0;let timed=false;
  const t=setTimeout(()=>{timed=true;child.kill('SIGKILL');},options.timeoutMs||120000);
  child.stdout.on('data',v=>{outSize+=v.length;if(outSize<=1048576)out+=v.toString();else child.kill('SIGKILL');});
  child.stderr.on('data',v=>{errSize+=v.length;if(errSize>1048576)child.kill('SIGKILL');});
  child.on('error',()=>{clearTimeout(t);reject(new Error('EXTERNAL_COMMAND_UNAVAILABLE'));});
  child.on('close',code=>{clearTimeout(t);if(timed||code!==0||outSize>1048576||errSize>1048576)
   reject(new Error(timed?'EXTERNAL_COMMAND_TIMEOUT':'EXTERNAL_COMMAND_FAILED'));
   else resolve(out.trim());});
 });
}
function pipeCommands(source,args1,target,args2,env,timeoutMs=300000){
 return new Promise((resolve,reject)=>{
  const left=spawn(source,args1,{env,stdio:['ignore','pipe','pipe'],shell:false});
  const right=spawn(target,args2,{env,stdio:['pipe','pipe','pipe'],shell:false});
  left.stdout.pipe(right.stdin);right.stdin.on('error',()=>{});
  let out='',size=0,failed=false,done=0;const codes=[];
  const t=setTimeout(()=>{failed=true;left.kill('SIGKILL');right.kill('SIGKILL');},timeoutMs);
  for(const child of [left,right]){
   child.stderr.on('data',()=>{}); // Never print messages that may contain connection details.
   child.on('error',()=>{failed=true;left.kill('SIGKILL');right.kill('SIGKILL');});
   child.on('close',code=>{codes.push(code);done++;if(done===2){clearTimeout(t);
    if(failed||codes.some(x=>x!==0)||size>1048576)reject(new Error('BACKUP_PIPELINE_FAILED'));
    else resolve(out.trim());}});
  }
  right.stdout.on('data',chunk=>{size+=chunk.length;if(size<=1048576)out+=chunk.toString();else{left.kill('SIGKILL');right.kill('SIGKILL');}});
 });
}
module.exports={run,pipeCommands};
