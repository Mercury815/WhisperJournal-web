import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: (process.env.REDIS_HOST ?? '').trim(),
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: (process.env.REDIS_PASSWORD ?? '').trim() || undefined,
}));
