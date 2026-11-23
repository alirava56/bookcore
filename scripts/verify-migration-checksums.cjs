'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const text=fs.readFileSync('apps/api/src/infrastructure/database/migration-checksums.ts','utf8');
for(const name of fs.readdirSync('db/migrations').filter(x=>x.endsWith('.sql'))){
 const hash=crypto.createHash('sha256').update(fs.readFileSync('db/migrations/'+name)).digest('hex');
 assert.ok(text.includes(`'${name}': '${hash}'`),'migration checksum constant stale: '+name);
}
console.log(`PASS migration checksum constants equal ${fs.readdirSync('db/migrations').filter(x=>x.endsWith('.sql')).length} SQL sources`);
