import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { Device } from '../models/domain.types';
import { RedisService } from '../modules/redis/redis.service';
import { deserialize, serialize } from './redis-json';
import { K } from './redis-keys';


@Injectable()
export class DeviceRepository {
  constructor(private readonly redis: RedisService) {}

  private r(): Redis {
    return this.redis.getRequiredClient();
  }

  async findByDeviceId(deviceId: string): Promise<Device | null> {
    const pk = await this.r().get(K.deviceDid(deviceId));
    if (!pk) {
      return null;
    }
    return this.findByPk(pk);
  }

  async findByPk(id: string): Promise<Device | null> {
    const raw = await this.r().get(K.devicePk(id));
    return raw ? deserialize<Device>(raw) : null;
  }

  async save(device: Device): Promise<void> {
    const pipe = this.r().pipeline();
    pipe.set(K.devicePk(device.id), serialize(device));
    pipe.set(K.deviceDid(device.deviceId), device.id);
    if (device.userId) {
      pipe.sadd(K.devicesOfUser(device.userId), device.id);
    }
    await pipe.exec();
  }

  async findLatestForUser(userId: string): Promise<Device | null> {
    const ids = await this.r().smembers(K.devicesOfUser(userId));
    let best: Device | null = null;
    for (const id of ids) {
      const d = await this.findByPk(id);
      if (!d) {
        continue;
      }
      if (!best || d.lastSeenAt.getTime() > best.lastSeenAt.getTime()) {
        best = d;
      }
    }
    return best;
  }

  createNew(partial: { deviceId: string; userId: string | null }): Device {
    const now = new Date();
    return {
      id: randomUUID(),
      deviceId: partial.deviceId,
      userId: partial.userId,
      createdAt: now,
      lastSeenAt: now,
      mergedAt: null,
    };
  }
}
