import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pool,closeDb} from './db.js';

async function main(){
 const dir=resolve(process.cwd(),'migrations');
 const client=await pool.connect();
 try{
  // Ownership of this tracking table belongs to the migration role, not runtime.
  await client.query(`CREATE TABLE IF NOT EXISTS spike_migrations(
   name text PRIMARY KEY, checksum_sha256 text NOT NULL CHECK(checksum_sha256 ~ '^[a-f0-9]{64}$'),
   applied_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
  for(const file of readdirSync(dir).filter(x=>/^\d{3}_[\w-]+\.sql$/.test(x)).sort()){
    const sql=readFileSync(resolve(dir,file),'utf8');
    const checksum=createHash('sha256').update(sql).digest('hex');
    await client.query('BEGIN');
    try {
      await client.query('SELECT pg_advisory_xact_lock(121221, 202602)');
      const done=await client.query<{checksum_sha256:string}>(
        'SELECT checksum_sha256 FROM spike_migrations WHERE name=$1 FOR UPDATE',[file]);
      if(!done.rowCount){
        await client.query(sql);
        await client.query('INSERT INTO spike_migrations(name,checksum_sha256) VALUES($1,$2)',[file,checksum]);
      } else if (done.rows[0]?.checksum_sha256!==checksum) {
        throw new Error(`MIGRATION_DRIFT: ${file} SHA256 differs from applied version`);
      }
      await client.query('COMMIT');
      process.stdout.write(`${done.rowCount?'verified':'applied'} ${file} ${checksum}\n`);
    }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}
  }
 }finally{client.release();await closeDb();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
