import {MetricsService} from './common/observability/metrics.registry';
import {LifecycleState} from './common/observability/lifecycle-state';
import {safeProblem} from './common/errors/problem';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe,type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json,urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config/app-config';
import { parseConfig,type AppConfig } from './config/app-config';
import { JsonLogger } from './common/logging/json-logger';
import { ProblemFilter } from './common/errors/problem.filter';
import { requestContext } from './common/observability/request-context';

export async function configureApplication(app:INestApplication,config:AppConfig):Promise<INestApplication> {
  if(app.get<AppConfig>(APP_CONFIG)!==config)throw new Error('CONFIG_INJECTION_MISMATCH');
  const expressInstance=app.getHttpAdapter().getInstance() as {set:(key:string,value:unknown)=>void};
  expressInstance.set('trust proxy',config.trustedProxyHops || false);
  app.useLogger(app.get(JsonLogger));
  app.use(requestContext);
  const httpLogger=app.get(JsonLogger);
  const metrics=app.get(MetricsService);
  const lifecycle=app.get(LifecycleState);
  app.use((req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{
    const path=req.path;
    if(lifecycle.isDraining() && path!=='/api/v1/health/live'){
      res.status(503).type('application/problem+json').send(safeProblem(503,'INSTANCE_DRAINING',path));return;
    }
    if(metrics.active() >= (config.maxInflightRequests??64) && path!=='/api/v1/health/live' &&
       path!=='/api/v1/health/ready'){
      metrics.event('http_rejected_overload');
      res.setHeader('Retry-After','1');
      res.status(503).type('application/problem+json').send(safeProblem(503,'SERVER_OVERLOADED',path));return;
    }
    metrics.requestStart();const began=performance.now();
    res.once('finish',()=>{
      metrics.requestFinish(req.method,req.route?.path ?? 'unmatched',res.statusCode,
        (performance.now()-began)/1000);
      if(res.statusCode===401)metrics.event('auth_rejected');
      if(res.statusCode===403)metrics.event('authorization_denied');
    });
    res.once('close',()=>{if(!res.writableEnded)metrics.requestFinish(req.method,'unmatched',503,(performance.now()-began)/1000);});
    next();
  });
  app.use((req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{
    const start=performance.now();
    res.once('finish',()=>{
      const rid=(req as import('./common/observability/request-context').CorrelatedRequest).requestId;
      httpLogger.event({event:'http_response',requestId:rid,method:req.method,
        route:req.route?.path ?? 'unmatched',status:res.statusCode,
        durationMs:Math.round((performance.now()-start)*100)/100});
    });
    next();
  });
  app.use(helmet());
  app.use(json({limit:config.jsonBodyLimit,strict:true}));
  app.use(urlencoded({limit:config.jsonBodyLimit,extended:false}));
  app.enableCors({origin:config.corsOrigins.length?config.corsOrigins:false,credentials:false,
    methods:['GET','HEAD','POST','PATCH','OPTIONS'],allowedHeaders:['Content-Type','Authorization','Idempotency-Key'],maxAge:300});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,
    transform:true,forbidUnknownValues:true,validationError:{target:false,value:false}}));
  app.useGlobalFilters(app.get(ProblemFilter));
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks(['SIGTERM','SIGINT']);
  if(config.swaggerUi) {
    const builder=new DocumentBuilder().setTitle('BookCore Backend API')
      .setVersion('0.16.0').addBearerAuth()
      .addApiKey({type:'apiKey',in:'header',name:'X-BookCore-Monitor-Key'},'monitorAuth');
    const doc=SwaggerModule.createDocument(app,builder.build());
    SwaggerModule.setup('docs',app,doc);
  }
  return app;
}

export async function buildApplication(config:AppConfig=parseConfig(process.env)):Promise<INestApplication> {
  const app=await NestFactory.create(AppModule.forRoot(config),{bodyParser:false,bufferLogs:true});
  return configureApplication(app,config);
}
