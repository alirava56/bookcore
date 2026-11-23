import { ArgumentsHost, Catch, ExceptionFilter, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { exceptionCode,exceptionStatus,safeProblem } from './problem';
import type { CorrelatedRequest } from '../observability/request-context';
import { JsonLogger } from '../logging/json-logger';

@Catch()
@Injectable()
export class ProblemFilter implements ExceptionFilter {
  constructor(private readonly logger:JsonLogger) {}
  catch(ex:unknown,host:ArgumentsHost):void {
    const http=host.switchToHttp();
    const req=http.getRequest<CorrelatedRequest>();
    const res=http.getResponse<Response>();
    // Nest/Express may reject body parsing before it reaches validation.
    const rawStatus=exceptionStatus(ex);
    const bodyParserStatus=(ex && typeof ex==='object' && 'status' in ex) ? (ex as {status?:unknown}).status : undefined;
    const status=(rawStatus===500 && (bodyParserStatus===400||bodyParserStatus===413)) ? bodyParserStatus : rawStatus;
    const code=exceptionCode(ex,status);
    if(status>=500) this.logger.event({event:'http_failure',code,status,requestId:req.requestId},'error');
    res.status(status).type('application/problem+json').json(safeProblem(status,code,
      req.originalUrl?.split('?')[0] ?? '/',req.requestId));
  }
}
