"use strict";
const fs=require('node:fs');const path=require('node:path');
const {render,verify}=require('./manifest-core.cjs');
if(process.argv.length!==3||process.argv[2]!=='--write-release'){
 console.error('Usage: node scripts/generate-manifest.cjs --write-release');process.exit(2);
}
const file=path.join(process.cwd(),'MANIFEST.md');fs.writeFileSync(file,render(process.cwd()));
const info=verify(process.cwd(),'release');
console.log(`RELEASE MANIFEST GENERATED AND VERIFIED: ${info.verified} files`);
