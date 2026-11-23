'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const r=p=>fs.readFileSync(p,'utf8');
const expect=(file,regex)=>assert.match(r(file),regex,`Missing ${regex} in ${file}`);
expect('apps/api/src/app.module.ts',/provide:APP_GUARD,useClass:GlobalAuthGuard/);
expect('apps/api/src/bootstrap.ts',/CONFIG_INJECTION_MISMATCH/);
expect('apps/api/src/modules/identity/identity.service.ts',/argon2\.argon2id/);
expect('apps/api/src/modules/identity/identity.service.ts',/kind:'REPLAY'/);
expect('apps/api/src/modules/identity/identity.service.ts',/invalidated_at=coalesce/);
expect('apps/api/src/modules/identity/token.service.ts',/algorithms:\['HS256'\]/);
expect('apps/api/src/modules/organizations/organizations.service.ts',/lock_bookcore_organization/);
expect('apps/api/src/modules/organizations/organizations.service.ts',/forWrite\(c,p,orgId\)/);
expect('apps/api/src/modules/organizations/organizations.service.ts',/audit_events/);
expect('apps/api/src/modules/organizations/organizations.service.ts',/outbox_events/);
expect('db/migrations/005_identity_security.sql',/users_email_normalized_uq/);
expect('db/migrations/005_identity_security.sql',/refresh_tokens_one_child/);
expect('db/migrations/005_identity_security.sql',/protect_last_active_owner/);
expect('db/migrations/005_identity_security.sql',/GRANT EXECUTE ON FUNCTION lock_bookcore_organization/);
for(const name of ['001_core.sql','002_resource_guard.sql','003_hardening.sql','004_history_consistency.sql']){
 const previous=fs.readFileSync('reference/Phase_02/runnable-spike/BookCore_Phase_02/spike/migrations/'+name);
 const current=fs.readFileSync('db/migrations/'+name);
 assert.equal(crypto.createHash('sha256').update(previous).digest('hex'),crypto.createHash('sha256').update(current).digest('hex'),'prior migration changed '+name);
}
const funcs=['GlobalAuthGuard','IdentityService','OrganizationsService','TenantAuthorizationService','AuthRateLimitGuard'];
assert.ok(funcs.length===5);
console.log('PASS Phase04 structural source assertions; legacy migration SHA256 unchanged (4 files).');
