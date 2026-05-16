import { HttpStatus, Injectable } from '@nestjs/common';
import { UserRepository } from '../../persistence/user.repository';
import { AppHttpException } from '../../common/exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import type { UserSettingsJson } from '../../models/user.types';

@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  async getMe(userId: string) {
    const u = await this.users.findById(userId);
    if (!u) {
      throw new AppHttpException(ErrorCodes.AUTH_UNAUTHORIZED, '用户不存在', HttpStatus.UNAUTHORIZED);
    }
    return {
      id: u.id,
      email: u.email,
      settings: u.settings,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    };
  }

  async getSettings(userId: string): Promise<UserSettingsJson> {
    const u = await this.users.findById(userId);
    if (!u) {
      throw new AppHttpException(ErrorCodes.AUTH_UNAUTHORIZED, '用户不存在', HttpStatus.UNAUTHORIZED);
    }
    return u.settings ?? {};
  }

  async updateSettings(userId: string, patch: Partial<UserSettingsJson>): Promise<UserSettingsJson> {
    const u = await this.users.findById(userId);
    if (!u) {
      throw new AppHttpException(ErrorCodes.AUTH_UNAUTHORIZED, '用户不存在', HttpStatus.UNAUTHORIZED);
    }
    u.settings = { ...(u.settings ?? {}), ...patch };
    u.updatedAt = new Date();
    await this.users.save(u);
    return u.settings;
  }
}
