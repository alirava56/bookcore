"use strict";
const cp=require('node:child_process');
const r=cp.spawnSync(process.execPath,['--test','--test-reporter=tap','apps/api/test/unit/phase16-recovery-policy.test.cjs'],{cwd:process.cwd(),encoding:'utf8',timeout:30000});
const s=(r.stdout||'')+(r.stderr||'');process.stdout.write(s);
const item=(k)=>{const a=[...s.matchAll(new RegExp('^# '+k+' (\\d+)$','gm'))];return a.length?Number(a.at(-1)[1]):-1;};
if(r.status!==0||item('tests')<3||item('pass')!==item('tests')||item('fail')!==0||item('skipped')!==0||item('cancelled')!==0)process.exitCode=1;
