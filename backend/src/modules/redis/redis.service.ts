import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy, OnModuleInit {
  private readonly log = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>('redis.host'));
  }

  getClient(): Redis | null {
    return this.client;
  }

  /** 主存储依赖 Redis，未连接时抛出 */
  getRequiredClient(): Redis {
    if (!this.client) {
      throw new Error('Redis 未连接：请配置 REDIS_HOST');
    }
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error(
        '必须配置 REDIS_HOST：持久化已改为仅使用 Redis（不再使用 PostgreSQL）。',
      );
    }
    const host = this.config.get<string>('redis.host')!;
    const port = this.config.get<number>('redis.port') ?? 6379;
    const password = this.config.get<string | undefined>('redis.password');
    this.client = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    try {
      await this.client.connect();
      await this.client.ping();
      this.log.log({ action: 'redis.connected', host, port });
    } catch (e) {
      this.log.error({ action: 'redis.connect_failed', err: e });
      await this.client.quit().catch(() => undefined);
      this.client = null;
      throw e;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  async ping(): Promise<'ok' | 'down'> {
    if (!this.client) {
      return 'down';
    }
    try {
      const p = await this.client.ping();
      return p === 'PONG' ? 'ok' : 'down';
    } catch {
      return 'down';
    }
  }
}
