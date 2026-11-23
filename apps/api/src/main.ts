import { parseConfig } from './config/app-config';
import { buildApplication } from './bootstrap';

async function main():Promise<void> {
  const config=parseConfig(process.env);
  const app=await buildApplication(config);
  try {
    await app.listen(config.port,config.host);
  } catch(err) { await app.close();throw err; }
}
main().catch(()=>{
  // Never print raw configuration, DB URL or underlying SQL/stack in production.
  process.stderr.write('BookCore startup failed; check sanitized configuration and environment.\n');
  process.exitCode=1;
});
