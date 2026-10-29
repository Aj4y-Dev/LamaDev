import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'FILE_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

/** Every error leaves as { error: { code, message, details? } }. Stack traces never reach the client. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? 'ERROR';
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { code?: string; message?: unknown; details?: unknown };
        if (b.code) code = b.code;
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) message = b.message.join(', ');
        details = b.details;
      }
    } else {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
  }
}
