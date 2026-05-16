import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '../../types/error-codes';
import { ErrorCodes } from '../../types/error-codes';

export class AppHttpException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ success: false, error: { code, message } }, status);
  }
}

export function isAppHttpExceptionPayload(body: unknown): body is {
  success: false;
  error: { code: ErrorCode; message: string };
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    (body as { success: unknown }).success === false &&
    'error' in body
  );
}

export const unauthorized = (message = 'Unauthorized') =>
  new AppHttpException(ErrorCodes.AUTH_UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
