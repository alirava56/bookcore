'use strict';
// Genuine separate Node.js process; initializes its own Nest application and its own PG pool.
// Executed from compiled integration tests. Not a simulated in-process concurrency lane.
const path=require('node:path');
let app;let finished=false;
async function close(code){
 if(finished)return;finished=true;
 try{if(app)await app.close();}catch(err){process.stderr.write(`WORKER_CLOSE_ERROR:${String(err)}\n`);code=1;}
 process.disconnect?.();process.exitCode=code;
}
process.on('message',message=>{if(message==='STOP')void close(0);});
process.on('SIGTERM',()=>{void close(1);});
process.on('uncaughtException',err=>{process.stderr.write(String(err));void close(1);});
process.on('unhandledRejection',err=>{process.stderr.write(String(err));void close(1);});
(async()=>{
 const root=process.cwd();
 const {parseConfig}=require(path.join(root,'dist/apps/api/src/config/app-config.js'));
 const {buildApplication}=require(path.join(root,'dist/apps/api/src/bootstrap.js'));
 app=await buildApplication(parseConfig({...process.env,NODE_ENV:'test',HTTP_HOST:'127.0.0.1'}));
 await app.listen(0,'127.0.0.1');
 const address=app.getHttpServer().address();
 process.send?.({kind:'READY',port:address.port});
})().catch(err=>{process.stderr.write(`WORKER_START_ERROR:${String(err)}\n`);void close(1);});
