import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { User } from '../models/domain.types';
import { RedisService } from '../modules/redis/redis.service';
import { deserialize, serialize } from './redis-json';
import { K } from './redis-keys';

@Injectable()
export class UserRepository {
  constructor(private readonly redis: RedisService) {}

  private r(): Redis {
    return this.redis.getRequiredClient();
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.r().get(K.user(id));
    return raw ? deserialize<User>(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const id = await this.r().get(K.userEmail(email));
    if (!id) {
      return null;
    }
    return this.findById(id);
  }

  async save(user: User): Promise<void> {
    const pipe = this.r().pipeline();
    pipe.set(K.user(user.id), serialize(user));
    if (user.email) {
      pipe.set(K.userEmail(user.email), user.id);
    }
    await pipe.exec();
  }

  createNew(partial: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): User {
    const now = new Date();
    return {
      id: partial.id ?? randomUUID(),
      email: partial.email,
      phone: partial.phone,
      passwordHash: partial.passwordHash,
      tokenVersion: partial.tokenVersion ?? 0,
      settings: partial.settings ?? {},
      createdAt: now,
      updatedAt: now,
      lastLoginAt: partial.lastLoginAt ?? null,
    };
  }

  async incrementTokenVersion(userId: string): Promise<void> {
    const u = await this.findById(userId);
    if (!u) {
      return;
    }
    u.tokenVersion += 1;
    u.updatedAt = new Date();
    await this.save(u);
  }
}
