import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Device } from '../../../models/domain.types';
import type { User } from '../../../models/domain.types';
import { UserRepository } from '../../../persistence/user.repository';
import { DeviceRepository } from '../../../persistence/device.repository';
import type { AccessPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UserRepository,
    private readonly devices: DeviceRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.jwtAccessSecret'),
    });
  }

  async validate(
    payload: AccessPayload,
  ): Promise<{ user: User | null; device: Device | null }> {
    if (payload.typ === 'user') {
      const user = await this.users.findById(payload.sub);
      if (!user || user.tokenVersion !== payload.tv) {
        throw new UnauthorizedException();
      }
      const device = await this.devices.findLatestForUser(user.id);
      return { user, device: device ?? null };
    }
    if (payload.typ === 'anon') {
      const device = await this.devices.findByPk(payload.sub);
      if (!device || device.deviceId !== payload.did) {
        throw new UnauthorizedException();
      }
      return { user: null, device };
    }
    throw new UnauthorizedException();
  }
}
