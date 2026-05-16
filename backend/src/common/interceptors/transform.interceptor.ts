import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** 统一成功响应：{ success, data, message } */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'success' in data &&
          (data as { success: boolean }).success === false
        ) {
          return data;
        }
        return {
          success: true,
          data: data === undefined ? null : data,
          message: 'ok',
        };
      }),
    );
  }
}
