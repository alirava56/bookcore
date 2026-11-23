"use strict";
const {verify}=require('./manifest-core.cjs');
try{
 const raw=process.argv.slice(2);if(raw.length>1||raw.some(v=>!['--mode=release','--mode=workspace'].includes(v)))throw new Error('INVALID_ARGS');
 const mode=raw[0]?.split('=')[1]||'release';
 const result=verify(process.cwd(),mode);
 console.log(`PASS ${mode.toUpperCase()} MANIFEST: ${result.verified} hash/size checks; ${result.untracked.length} untracked entries; releaseCertified=${result.releaseCertified}`);
 if(mode==='workspace'&&result.untracked.length)console.warn('WORKSPACE WARNING: untracked additions, NOT a release package certification');
}catch(error){console.error('FAIL MANIFEST:',error.message);process.exitCode=1;}
