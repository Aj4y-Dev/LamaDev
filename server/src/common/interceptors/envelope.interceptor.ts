import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Observable, tap, map } from 'rxjs';

/** Wraps results as { data } and logs request id, status and duration (never bodies or images). */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const id = randomUUID().slice(0, 8);
    const started = Date.now();
    return next.handle().pipe(
      tap(() => this.logger.log(`${id} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`)),
      map((data) => ({ data: data ?? null })),
    );
  }
}
