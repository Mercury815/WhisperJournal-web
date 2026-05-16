import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AppHttpException } from '../exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import type { JwtSession } from '../utils/session.util';

/** 仅允许已登录用户（非匿名 JWT） */
@Injectable()
export class RegisteredUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user: JwtSession }>();
    const u = req.user?.user;
    if (!u) {
      throw new AppHttpException(
        ErrorCodes.AUTH_UNAUTHORIZED,
        '需要登录',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return true;
  }
}
