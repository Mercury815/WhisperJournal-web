import type { Device } from '../../models/domain.types';
import type { User } from '../../models/domain.types';
import type { UserSettingsJson } from '../../models/user.types';

export type AccessPayload =
  | { typ: 'user'; sub: string; tv: number }
  | { typ: 'anon'; sub: string; did: string };

export type RefreshPayload =
  | { typ: 'refresh-user'; sub: string; tv: number }
  | { typ: 'refresh-anon'; sub: string; did: string };

export type AuthContext = {
  user: User | null;
  device: Device | null;
};

/** 对外返回的用户信息（绝不包含 passwordHash） */
export type PublicUser = {
  id: string;
  email: string | null;
  settings: UserSettingsJson;
  createdAt: Date;
  lastLoginAt: Date | null;
};
