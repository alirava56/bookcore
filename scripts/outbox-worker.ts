import {runOutboxWorker} from '../apps/api/src/modules/outbox/outbox.worker';
if(require.main===module)runOutboxWorker().catch(()=>{process.stderr.write('OUTBOX_WORKER_START_FAILED\n');process.exitCode=1;});
