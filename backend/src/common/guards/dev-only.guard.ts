import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppHttpException } from '../exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';

@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const env = this.config.get<string>('env.nodeEnv') ?? 'development';
    if (env !== 'development') {
      throw new AppHttpException(ErrorCodes.AUTH_UNAUTHORIZED, 'Not found', HttpStatus.NOT_FOUND);
    }
    return true;
  }
}
