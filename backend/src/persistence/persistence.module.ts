import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../modules/redis/redis.module';
import { UserRepository } from './user.repository';
import { DeviceRepository } from './device.repository';
import { DiaryRepository } from './diary.repository';
import { EmotionDictRepository } from './emotion-dict.repository';
import { WeatherSnapshotRepository } from './weather-snapshot.repository';
import { SyncQueueRepository } from './sync-queue.repository';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    UserRepository,
    DeviceRepository,
    DiaryRepository,
    EmotionDictRepository,
    WeatherSnapshotRepository,
    SyncQueueRepository,
  ],
  exports: [
    UserRepository,
    DeviceRepository,
    DiaryRepository,
    EmotionDictRepository,
    WeatherSnapshotRepository,
    SyncQueueRepository,
  ],
})
export class PersistenceModule {}
