import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export const TRACE_HEADER = 'x-trace-id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = (req.headers[TRACE_HEADER] as string) || randomUUID();
    req.headers[TRACE_HEADER] = traceId;
    res.setHeader(TRACE_HEADER, traceId);
    req.traceId = traceId;
    next();
  }
}
