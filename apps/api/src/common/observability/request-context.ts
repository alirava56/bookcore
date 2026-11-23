import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface CorrelatedRequest extends Request { requestId?: string; }
export function requestContext(req: CorrelatedRequest,res:Response,next:NextFunction): void {
  // Server-owned only: don't allow a client to impersonate a trusted trace ID.
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
