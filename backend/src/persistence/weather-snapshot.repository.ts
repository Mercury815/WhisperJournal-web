import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { WeatherSnapshot } from '../models/domain.types';
import { RedisService } from '../modules/redis/redis.service';
import { deserialize, serialize } from './redis-json';
import { K } from './redis-keys';

@Injectable()
export class WeatherSnapshotRepository {
  constructor(private readonly redis: RedisService) {}

  private r(): Redis {
    return this.redis.getRequiredClient();
  }

  async saveSnapshot(row: WeatherSnapshot): Promise<void> {
    await this.r().set(K.weatherSnap(row.id), serialize(row));
    await this.r().set(K.weatherSnapIdx(row.location, row.capturedAt.toISOString().slice(0, 10)), row.id);
  }

  async findLatestForDay(location: string, dateKey: string): Promise<WeatherSnapshot | null> {
    const id = await this.r().get(K.weatherSnapIdx(location, dateKey));
    if (!id) {
      return null;
    }
    const raw = await this.r().get(K.weatherSnap(id));
    return raw ? deserialize<WeatherSnapshot>(raw) : null;
  }

  buildFromCurrent(
    partial: Omit<WeatherSnapshot, 'id' | 'createdAt'> & { id?: string },
  ): WeatherSnapshot {
    const now = new Date();
    return {
      id: partial.id ?? randomUUID(),
      location: partial.location,
      weatherType: partial.weatherType,
      temperature: partial.temperature,
      humidity: partial.humidity,
      source: partial.source,
      capturedAt: partial.capturedAt,
      createdAt: now,
    };
  }
}
