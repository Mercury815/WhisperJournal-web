import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import envConfig from './config/env.config';
import authConfig from './config/auth.config';
import weatherConfig from './config/weather.config';
import audioConfig from './config/audio.config';
import redisConfig from './config/redis.config';
import jobsConfig from './config/jobs.config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestContextMiddleware } from './common/middlewares/request-context.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { DiaryModule } from './modules/diary/diary.module';
import { UserModule } from './modules/user/user.module';
import { WeatherModule } from './modules/weather/weather.module';
import { EmotionModule } from './modules/emotion/emotion.module';
import { StatsModule } from './modules/stats/stats.module';
import { DebugModule } from './modules/debug/debug.module';
import { SharedModule } from './shared/shared.module';
import { RedisModule } from './modules/redis/redis.module';
import { PersistenceModule } from './persistence/persistence.module';
import { JobsModule } from './modules/jobs/jobs.module';
import type { IncomingMessage } from 'http';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig, authConfig, weatherConfig, audioConfig, redisConfig, jobsConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('env.nodeEnv') === 'development';
        return {
          pinoHttp: {
            transport: isDev
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
            autoLogging: true,
            customProps: (req: IncomingMessage) => ({
              traceId: (req as IncomingMessage & { traceId?: string }).traceId,
            }),
          },
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    SharedModule,
    RedisModule,
    PersistenceModule,
    JobsModule.register(),
    HealthModule,
    AuthModule,
    DiaryModule,
    UserModule,
    WeatherModule,
    EmotionModule,
    StatsModule,
    DebugModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
