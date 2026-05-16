import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { EmotionDictionary } from '../models/domain.types';
import { RedisService } from '../modules/redis/redis.service';
import { deserialize, serialize } from './redis-json';
import { K } from './redis-keys';

@Injectable()
export class EmotionDictRepository implements OnModuleInit {
  private readonly log = new Logger(EmotionDictRepository.name);

  constructor(private readonly redis: RedisService) {}

  private r(): Redis {
    return this.redis.getRequiredClient();
  }

  async onModuleInit(): Promise<void> {
    if ((await this.r().exists(K.emotionDictData())) > 0) {
      return;
    }
    const seeds: Omit<EmotionDictionary, 'id'>[] = [
      { keyword: '开心', emotionType: 'happy', weight: 1.2, locale: 'zh-CN', isActive: true },
      { keyword: '高兴', emotionType: 'happy', weight: 1.1, locale: 'zh-CN', isActive: true },
      { keyword: '难过', emotionType: 'sad', weight: 1.2, locale: 'zh-CN', isActive: true },
      { keyword: '伤心', emotionType: 'sad', weight: 1.1, locale: 'zh-CN', isActive: true },
      { keyword: '焦虑', emotionType: 'anxious', weight: 1.2, locale: 'zh-CN', isActive: true },
      { keyword: '平静', emotionType: 'calm', weight: 1.0, locale: 'zh-CN', isActive: true },
      { keyword: '生气', emotionType: 'angry', weight: 1.2, locale: 'zh-CN', isActive: true },
      { keyword: '累', emotionType: 'tired', weight: 1.0, locale: 'zh-CN', isActive: true },
    ];
    const rows: EmotionDictionary[] = seeds.map((s) => ({
      ...s,
      id: randomUUID(),
    }));
    await this.r().set(K.emotionDictData(), serialize(rows));
    this.log.log({ action: 'emotion.dictionary.seed', count: rows.length });
  }

  async findAll(locale?: string): Promise<EmotionDictionary[]> {
    const raw = await this.r().get(K.emotionDictData());
    if (!raw) {
      return [];
    }
    let rows = deserialize<EmotionDictionary[]>(raw);
    rows = rows.filter((r) => r.isActive);
    if (locale) {
      rows = rows.filter((r) => r.locale === locale);
    }
    return rows.sort((a, b) => a.keyword.localeCompare(b.keyword));
  }
}
