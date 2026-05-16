import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisService) {}

  @Get()
  async check() {
    const redis = await this.redis.ping();
    return { status: 'ok', service: 'whisperjournal-api', redis };
  }
}
