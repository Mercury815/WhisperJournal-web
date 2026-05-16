import { HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import type { AccessPayload, PublicUser, RefreshPayload } from './auth.types';
import { AppHttpException } from '../../common/exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import { UserRepository } from '../../persistence/user.repository';
import { DeviceRepository } from '../../persistence/device.repository';
import { DiaryRepository } from '../../persistence/diary.repository';
import type { User } from '../../models/domain.types';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UserRepository,
    private readonly devices: DeviceRepository,
    private readonly diaries: DiaryRepository,
  ) {}

  toPublicUser(u: User): PublicUser {
    return {
      id: u.id,
      email: u.email,
      settings: u.settings ?? {},
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    };
  }

  async anonymous(clientDeviceId?: string): Promise<{
    deviceId: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const deviceId = clientDeviceId?.trim() || randomUUID();
    let device = await this.devices.findByDeviceId(deviceId);
    const now = new Date();
    if (!device) {
      device = this.devices.createNew({ deviceId, userId: null });
      await this.devices.save(device);
    } else {
      device.lastSeenAt = now;
      await this.devices.save(device);
    }
    const accessToken = await this.signAccessAnonymous(device);
    const refreshToken = await this.signRefreshAnonymous(device);
    return { deviceId, accessToken, refreshToken };
  }

  /**
   * 注册：唯一邮箱 + 强密码 + 明示同意条款；不记录明文密码与完整邮箱到日志。
   */
  async register(
    email: string,
    password: string,
    passwordConfirm: string,
    _acceptTerms: boolean,
    bindDeviceId?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    if (password !== passwordConfirm) {
      throw new AppHttpException(ErrorCodes.VALIDATION_ERROR, '两次输入的密码不一致', HttpStatus.BAD_REQUEST);
    }

    const normalized = email.trim().toLowerCase();
    try {
      const existing = await this.users.findByEmail(normalized);
      if (existing) {
        this.log.warn({ action: 'auth.register.duplicate', emailHash: this.maskEmailForLog(normalized) });
        throw new AppHttpException(
          ErrorCodes.AUTH_EMAIL_TAKEN,
          '该邮箱已被注册，请直接登录',
          HttpStatus.CONFLICT,
        );
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const now = new Date().toISOString();
      const user = this.users.createNew({
        email: normalized,
        passwordHash,
        tokenVersion: 0,
        settings: { termsAcceptedAt: now },
        phone: null,
        lastLoginAt: new Date(),
      });
      await this.users.save(user);

      this.log.log({ action: 'auth.register.ok', userId: user.id });

      if (bindDeviceId) {
        await this.bindDeviceToUser(bindDeviceId, user.id);
      }

      const fresh = (await this.users.findById(user.id))!;
      const accessToken = await this.signAccessUser(fresh);
      const refreshToken = await this.signRefreshUser(fresh);
      return { accessToken, refreshToken, user: this.toPublicUser(fresh) };
    } catch (e) {
      if (e instanceof AppHttpException) {
        throw e;
      }
      this.mapPersistenceOrJwtError(e, 'register');
    }
  }

  /**
   * 登录：仅已注册账号；错误提示统一，降低邮箱枚举风险。
   */
  async login(
    email: string,
    password: string,
    bindDeviceId?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const normalized = email.trim().toLowerCase();

    const loginFail = (): never => {
      this.log.warn({ action: 'auth.login.fail', emailHash: this.maskEmailForLog(normalized) });
      throw new AppHttpException(
        ErrorCodes.AUTH_UNAUTHORIZED,
        '邮箱或密码错误',
        HttpStatus.UNAUTHORIZED,
      );
    };

    try {
      const found = await this.users.findByEmail(normalized);

      if (!found) {
        this.log.warn({ action: 'auth.login.fail', emailHash: this.maskEmailForLog(normalized) });
        throw new AppHttpException(
          ErrorCodes.AUTH_UNAUTHORIZED,
          '邮箱或密码错误',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const passwordHash = found.passwordHash;
      if (!passwordHash) {
        this.log.warn({ action: 'auth.login.fail', emailHash: this.maskEmailForLog(normalized) });
        throw new AppHttpException(
          ErrorCodes.AUTH_UNAUTHORIZED,
          '邮箱或密码错误',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const ok = await bcrypt.compare(password, passwordHash);
      if (!ok) {
        loginFail();
      }

      const user = found;
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
      await this.users.save(user);

      this.log.log({ action: 'auth.login.ok', userId: user.id });

      if (bindDeviceId) {
        await this.bindDeviceToUser(bindDeviceId, user.id);
      }

      const fresh = (await this.users.findById(user.id))!;
      const accessToken = await this.signAccessUser(fresh);
      const refreshToken = await this.signRefreshUser(fresh);
      return { accessToken, refreshToken, user: this.toPublicUser(fresh) };
    } catch (e) {
      if (e instanceof AppHttpException) {
        throw e;
      }
      this.mapPersistenceOrJwtError(e, 'login');
    }
  }

  /** 检查邮箱是否已被注册 */
  async checkEmailExists(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    try {
      const existing = await this.users.findByEmail(normalized);
      return !!existing;
    } catch (e) {
      this.mapPersistenceOrJwtError(e, 'checkEmail');
    }
  }

  /** Redis / JWT 等底层错误：返回明确状态码与文案，避免笼统 500 */
  private mapPersistenceOrJwtError(err: unknown, ctx: string): never {
    this.log.error({ action: 'auth.persistence_or_jwt', ctx, err });
    const hint =
      err instanceof Error &&
      (/secret|jwt|private\s*key/i.test(err.message) || err.message.includes('secret'));
    if (hint) {
      throw new AppHttpException(
        ErrorCodes.SERVER_ERROR,
        '认证配置无效：请检查 backend/.env 中 JWT_ACCESS_SECRET、JWT_REFRESH_SECRET 是否已设置。',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    throw new AppHttpException(
      ErrorCodes.SERVER_ERROR,
      '数据服务不可用：请确认 Redis 已启动，且 backend/.env 中 REDIS_HOST（如 127.0.0.1）与端口正确。',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /** 日志中仅保留邮箱不可逆摘要，避免泄露明文 */
  private maskEmailForLog(email: string): string {
    const h = createHash('sha256').update(email).digest('hex').slice(0, 12);
    return `sha256:${h}`;
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.get<string>('auth.jwtRefreshSecret'),
      });
    } catch {
      throw new AppHttpException(
        ErrorCodes.AUTH_TOKEN_EXPIRED,
        '刷新令牌无效或已过期',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (payload.typ === 'refresh-user') {
      const user = await this.users.findById(payload.sub);
      if (!user || user.tokenVersion !== payload.tv) {
        throw new UnauthorizedException();
      }
      const accessToken = await this.signAccessUser(user);
      const nextRefresh = await this.signRefreshUser(user);
      return { accessToken, refreshToken: nextRefresh };
    }

    if (payload.typ === 'refresh-anon') {
      const device = await this.devices.findByPk(payload.sub);
      if (!device || device.deviceId !== payload.did) {
        throw new UnauthorizedException();
      }
      device.lastSeenAt = new Date();
      await this.devices.save(device);
      const accessToken = await this.signAccessAnonymous(device);
      const nextRefresh = await this.signRefreshAnonymous(device);
      return { accessToken, refreshToken: nextRefresh };
    }

    throw new UnauthorizedException();
  }

  async logout(userId: string): Promise<void> {
    await this.users.incrementTokenVersion(userId);
    this.log.log({ action: 'auth.logout', userId });
  }

  private async bindDeviceToUser(deviceClientId: string, userId: string): Promise<void> {
    const device = await this.devices.findByDeviceId(deviceClientId);
    if (!device) {
      return;
    }
    const now = new Date();
    device.userId = userId;
    device.mergedAt = now;
    device.lastSeenAt = now;
    await this.devices.save(device);

    await this.diaries.bindAnonDiariesToUser(deviceClientId, userId);
  }

  private async signAccessUser(user: User): Promise<string> {
    const p: AccessPayload = { typ: 'user', sub: user.id, tv: user.tokenVersion };
    return this.jwt.signAsync(p, {
      secret: this.config.get<string>('auth.jwtAccessSecret'),
      expiresIn: this.config.get<string>('auth.accessExpires') ?? '15m',
    });
  }

  private async signRefreshUser(user: User): Promise<string> {
    const p: RefreshPayload = { typ: 'refresh-user', sub: user.id, tv: user.tokenVersion };
    return this.jwt.signAsync(p, {
      secret: this.config.get<string>('auth.jwtRefreshSecret'),
      expiresIn: this.config.get<string>('auth.refreshExpires') ?? '7d',
    });
  }

  private async signAccessAnonymous(device: import('../../models/domain.types').Device): Promise<string> {
    const p: AccessPayload = { typ: 'anon', sub: device.id, did: device.deviceId };
    return this.jwt.signAsync(p, {
      secret: this.config.get<string>('auth.jwtAccessSecret'),
      expiresIn: this.config.get<string>('auth.accessExpires') ?? '15m',
    });
  }

  private async signRefreshAnonymous(device: import('../../models/domain.types').Device): Promise<string> {
    const p: RefreshPayload = {
      typ: 'refresh-anon',
      sub: device.id,
      did: device.deviceId,
    };
    return this.jwt.signAsync(p, {
      secret: this.config.get<string>('auth.jwtRefreshSecret'),
      expiresIn: this.config.get<string>('auth.refreshExpires') ?? '7d',
    });
  }
}
