import { writeFileSync } from 'node:fs';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { buildApplication } from '../apps/api/src/bootstrap';

async function generate(): Promise<void> {
  const app = await buildApplication();
  try {
    await app.init();
    const config = new DocumentBuilder().setTitle('BookCore Backend API').setVersion('0.16.0')
      .addBearerAuth().addApiKey({ type: 'apiKey', in: 'header', name: 'X-BookCore-Monitor-Key' }, 'monitorAuth').build();
    const document = SwaggerModule.createDocument(app, config);
    const output = process.env.OPENAPI_CURRENT_OUTPUT || 'docs/api/implemented.openapi.json';
    writeFileSync(output, JSON.stringify(document, null, 2) + '\n');
  } finally {
    await app.close();
  }
}

generate().catch(() => {
  process.stderr.write('Implemented OpenAPI generation failed.\n');
  process.exitCode = 1;
});
