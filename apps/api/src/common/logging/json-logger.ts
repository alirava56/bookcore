import {safeLogFields} from '../observability/metrics.domain';
import { Injectable, type LoggerService } from '@nestjs/common';

// Only call this logger with curated metadata; never serialize request bodies or raw Error objects.
@Injectable()
export class JsonLogger implements LoggerService {
  private emit(level: string, message: unknown, context?: string): void {
    const entry = {
      at: new Date().toISOString(),
      level,
      context: context ?? 'BookCore',
      message: typeof message === 'string' ? message : 'non-string-event-redacted',
    };
    const line = JSON.stringify(entry);
    if (level === 'error') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  }
  event(fields:Record<string,string|number|undefined>,level:'info'|'error'='info'):void {
    const line=JSON.stringify({at:new Date().toISOString(),level,...safeLogFields(fields)});
    if(level==='error')process.stderr.write(line+'\n');
    else process.stdout.write(line+'\n');
  }
  log(message: unknown, context?: string): void { this.emit('info',message,context); }
  debug(message: unknown, context?: string): void { this.emit('debug',message,context); }
  warn(message: unknown, context?: string): void { this.emit('warn',message,context); }
  error(message: unknown, _trace?: string, context?: string): void { this.emit('error',message,context); }
  verbose(message: unknown, context?: string): void { this.emit('debug',message,context); }
  fatal(message: unknown, context?: string): void { this.emit('error',message,context); }
}
