import { DynamicModule, Module, type Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { WeatherModule } from '../weather/weather.module';
import { SyncQueueProcessor } from './processors/sync-queue.processor';
import { SyncQueueWorkerService } from './sync-queue-worker.service';
import { SyncRetryTask } from './tasks/sync-retry.task';
import { WeatherRefreshTask } from './tasks/weather-refresh.task';
import { SoftDeleteCleanupTask } from './tasks/soft-delete-cleanup.task';

@Module({})
export class JobsModule {
  static register(): DynamicModule {
    const redisHost = (process.env.REDIS_HOST ?? '').trim();
    const redisPort = parseInt(process.env.REDIS_PORT ?? '6379', 10);
    const redisPassword = (process.env.REDIS_PASSWORD ?? '').trim() || undefined;

    const imports: DynamicModule['imports'] = [ScheduleModule.forRoot(), WeatherModule];

    const providers: Provider[] = [
      SyncQueueWorkerService,
      SyncRetryTask,
      WeatherRefreshTask,
      SoftDeleteCleanupTask,
    ];

    if (redisHost) {
      imports.push(
        BullModule.forRoot({
          redis: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
          },
        }),
        BullModule.registerQueue({ name: 'sync' }),
      );
      providers.push(SyncQueueProcessor);
    }

    return {
      module: JobsModule,
      imports,
      providers,
    };
  }
}
