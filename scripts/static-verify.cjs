'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=process.cwd();
const required=['apps/api/src/main.ts','apps/api/src/app.module.ts','apps/api/src/bootstrap.ts',
 'apps/api/src/modules/health/health.controller.ts','apps/api/src/common/security/authorization.ts',
 'apps/api/src/infrastructure/transactions/unit-of-work.ts','docs/api/openapi.yaml',
 'reference/Phase_02/BookCore-Phase-02-Technical-Spike-Final-Verified.zip',
 'db/migrations/001_core.sql','db/migrations/002_resource_guard.sql',
 'db/migrations/003_hardening.sql','db/migrations/004_history_consistency.sql',
 'db/migrations/005_identity_security.sql','db/migrations/006_catalog_availability.sql',
 'apps/api/src/modules/identity/identity.service.ts','apps/api/src/modules/identity/identity.controller.ts',
 'apps/api/src/modules/organizations/organizations.service.ts',
 'apps/api/src/modules/organizations/organizations.controller.ts',
 'apps/api/src/modules/catalog/catalog.service.ts','apps/api/src/modules/catalog/availability.ts',
 'apps/api/src/modules/scheduling/session.service.ts','apps/api/src/modules/scheduling/session.controller.ts',
 'db/migrations/007_session_permissions.sql'];
for(const p of required)assert.ok(fs.existsSync(path.join(root,p)),`missing ${p}`);
for(const p of ['health','booking','identity','organizations','catalog','scheduling'])assert.ok(fs.existsSync(path.join('apps/api/src/modules',p)),`module missing: ${p}`);
const packageJson=JSON.parse(fs.readFileSync('package.json'));
assert.ok(packageJson.scripts['test:unit']&&packageJson.scripts['test:integration']);
assert.match(fs.readFileSync('apps/api/src/app.module.ts','utf8'),/APP_GUARD/);
assert.match(fs.readFileSync('apps/api/src/common/security/authorization.ts','utf8'),/AUTHENTICATION_REQUIRED/);
assert.ok(!fs.existsSync('package-lock.json') || JSON.parse(fs.readFileSync('package-lock.json')).lockfileVersion>=2);
const runner=fs.readFileSync('scripts/run-tests.cjs','utf8');
assert.ok(runner.includes('counts.discovered>=declarations')&&runner.includes('counts.skipped===0')&&runner.includes('compiledCalls<declarations')&&runner.includes("mode==='recovery'")&&runner.includes('BOOKCORE_PHASE12_RUN_RESTORE')); 
for(const p of fs.readdirSync('db/migrations'))assert.match(p,/^\d{3}_[\w-]+\.sql$/);
console.log(`PASS static source requirements; ${required.length} mandatory paths; 6 preserved + additive phase06 migration`);
