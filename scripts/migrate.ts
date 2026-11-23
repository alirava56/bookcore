import { createHash } from 'node:crypto';
import { readdirSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

// Owner credentials MUST be different from runtime API credentials. Never default to DATABASE_URL.
export async function runMigrations():Promise<void> {
  const migrationUrl=process.env.MIGRATION_DATABASE_URL;
  if(!migrationUrl)throw new Error('MIGRATION_DATABASE_URL_REQUIRED');
  const pool=new Pool({connectionString:migrationUrl,max:1,connectionTimeoutMillis:5000});
  try {
    const client=await pool.connect();
    try {
      const files=readdirSync(resolve(process.cwd(),'db/migrations'))
        .filter(name=>/^\d{3}_[\w-]+\.sql$/.test(name)).sort();
      if(!files.length)throw new Error('NO_MIGRATIONS_DISCOVERED');
      for(const name of files) {
        const sql=readFileSync(resolve(process.cwd(),'db/migrations',name),'utf8');
        const checksum=createHash('sha256').update(sql).digest('hex');
        let begun=false;
        try {
          await client.query('BEGIN');begun=true;
          await client.query('SELECT pg_advisory_xact_lock(121221,202603)');
          await client.query(`CREATE TABLE IF NOT EXISTS bookcore_migrations (
             name text PRIMARY KEY, checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
             applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
          )`);
          const existing=await client.query<{checksum_sha256:string}>(
            'SELECT checksum_sha256 FROM bookcore_migrations WHERE name=$1 FOR UPDATE',[name]);
          if(existing.rows[0]) {
            if(existing.rows[0].checksum_sha256!==checksum) throw new Error('MIGRATION_DRIFT:'+name);
          } else {
            await client.query(sql);
            await client.query('INSERT INTO bookcore_migrations(name,checksum_sha256) VALUES ($1,$2)',[name,checksum]);
          }
          await client.query('COMMIT');begun=false;
          process.stdout.write(`${existing.rows[0]?'verified':'applied'} ${name} ${checksum}\n`);
        } catch(err) {
          if(begun)try{await client.query('ROLLBACK');}catch{ /* connection broken; do not mask initial failure */ }
          throw err;
        }
      }
    } finally { client.release(); }
  } finally { await pool.end(); }
}
if(require.main===module)runMigrations().catch(()=>{
  process.stderr.write('Migration failed; see database administrator for SQLSTATE details.\n');
  process.exitCode=1;
});
