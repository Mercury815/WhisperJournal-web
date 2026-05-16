import type { Request } from 'express';
import { HttpStatus } from '@nestjs/common';
import { AppHttpException } from '../exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import type { Device, User } from '../../models/domain.types';

export type JwtSession = { user: User | null; device: Device | null };

/** 写作/同步作用域：已登录用 userId；匿名用 deviceId（userId 为空） */
export type DiaryScope = {
  userId: string | null;
  deviceId: string;
};

const HDR = 'x-device-id';

export function resolveDiaryScope(req: Request & { user: JwtSession }): DiaryScope {
  const { user, device } = req.user;
  const headerId = (req.headers[HDR] as string | undefined)?.trim();

  if (user) {
    const deviceId = headerId || device?.deviceId;
    if (!deviceId) {
      throw new AppHttpException(
        ErrorCodes.VALIDATION_ERROR,
        '已登录请求需携带 X-Device-Id 或已绑定设备',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { userId: user.id, deviceId };
  }

  if (device) {
    return { userId: null, deviceId: device.deviceId };
  }

  throw new AppHttpException(ErrorCodes.AUTH_UNAUTHORIZED, '无效会话', HttpStatus.UNAUTHORIZED);
}
