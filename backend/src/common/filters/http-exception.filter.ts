import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppHttpException, isAppHttpExceptionPayload } from '../exceptions/app-http.exception';
import { ErrorCodes, type ErrorCode } from '../../types/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCodes.SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof AppHttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (isAppHttpExceptionPayload(body)) {
        res.status(status).json(body);
        this.logError(req, status, body.error.code, body.error.message, exception);
        return;
      }
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        const m = (body as { message?: string | string[] }).message;
        message = Array.isArray(m) ? m.join(', ') : (m ?? message);
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = ErrorCodes.RATE_LIMITED;
      } else if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.UNPROCESSABLE_ENTITY) {
        code = ErrorCodes.VALIDATION_ERROR;
      } else if (status === HttpStatus.UNAUTHORIZED) {
        code = ErrorCodes.AUTH_UNAUTHORIZED;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        { err: exception, path: req.url, method: req.method },
        exception.stack,
      );
    }

    res.status(status).json({
      success: false,
      error: { code, message },
    });
  }

  private logError(
    req: Request,
    status: number,
    code: string,
    message: string,
    exception: unknown,
  ): void {
    if (status >= 500) {
      this.logger.error({ path: req.url, method: req.method, code, message, exception });
    }
  }
}
