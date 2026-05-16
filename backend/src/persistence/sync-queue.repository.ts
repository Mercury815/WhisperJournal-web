import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { SyncQueue } from '../models/domain.types';
import { RedisService } from '../modules/redis/redis.service';
import { deserialize, serialize } from './redis-json';
import { K } from './redis-keys';

@Injectable()
export class SyncQueueRepository {
  constructor(private readonly redis: RedisService) {}

  private r(): Redis {
    return this.redis.getRequiredClient();
  }

  async findById(id: string): Promise<SyncQueue | null> {
    const raw = await this.r().get(K.syncQ(id));
    return raw ? deserialize<SyncQueue>(raw) : null;
  }

  async save(row: SyncQueue): Promise<void> {
    const pipe = this.r().pipeline();
    pipe.set(K.syncQ(row.id), serialize(row));
    if (row.status === 'pending') {
      pipe.sadd(K.syncQPending(), row.id);
    } else {
      pipe.srem(K.syncQPending(), row.id);
    }
    await pipe.exec();
  }

  async listPending(limit: number): Promise<SyncQueue[]> {
    const ids = await this.r().smembers(K.syncQPending());
    const out: SyncQueue[] = [];
    for (const id of ids.slice(0, limit)) {
      const row = await this.findById(id);
      if (row && row.status === 'pending') {
        out.push(row);
      }
    }
    return out;
  }

  createNew(
    partial: Omit<SyncQueue, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): SyncQueue {
    const now = new Date();
    return {
      id: partial.id ?? randomUUID(),
      userId: partial.userId,
      deviceId: partial.deviceId,
      entityType: partial.entityType,
      entityId: partial.entityId,
      payload: partial.payload ?? {},
      status: partial.status ?? 'pending',
      retryCount: partial.retryCount ?? 0,
      lastTriedAt: partial.lastTriedAt ?? null,
      nextRetryAt: partial.nextRetryAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }
}
