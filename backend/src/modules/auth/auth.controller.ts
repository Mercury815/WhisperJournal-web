import { Body, Controller, Get, HttpException, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Device, User } from '../../models/domain.types';
import { AuthService } from './auth.service';
import { AnonymousDto } from './dto/anonymous.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

type JwtPayloadUser = { user: User | null; device: Device | null };

function parseEmailQuery(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.trim().toLowerCase();
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    return raw[0].trim().toLowerCase();
  }
  return '';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('anonymous')
  anonymous(@Body() body: AnonymousDto) {
    return this.auth.anonymous(body.deviceId);
  }

  /** 注册：强密码 + 双确认 + 明示同意条款（每分钟限流） */
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(
      body.email,
      body.password,
      body.passwordConfirm,
      body.acceptTerms,
      body.deviceId,
    );
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password, body.deviceId);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req: Request & { user: JwtPayloadUser }) {
    const u = req.user.user;
    if (u) {
      await this.auth.logout(u.id);
    }
    return { ok: true };
  }

  @Get('check-email')
  async checkEmail(@Req() req: Request) {
    try {
      const email = parseEmailQuery(req.query.email);
      if (!email) {
        return { available: false, exists: false, error: '邮箱不能为空' };
      }
      const exists = await this.auth.checkEmailExists(email);
      return { available: !exists, exists };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('检查邮箱时出错:', error);
      return { available: false, exists: false, error: '服务器错误，请稍后再试' };
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: Request & { user: JwtPayloadUser }) {
    const { user: u, device: d } = req.user;
    return {
      user: u ? this.auth.toPublicUser(u) : null,
      device: d
        ? { id: d.id, deviceId: d.deviceId, userId: d.userId }
        : null,
    };
  }
}
