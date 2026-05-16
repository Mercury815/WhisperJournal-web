import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DiaryRepository } from '../../../persistence/diary.repository';

@Injectable()
export class SoftDeleteCleanupTask {
  private readonly log = new Logger(SoftDeleteCleanupTask.name);

  constructor(
    private readonly config: ConfigService,
    private readonly diaries: DiaryRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    const days = this.config.get<number>('jobs.softDeleteRetentionDays') ?? 90;
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const n = await this.diaries.hardDeleteSoftDeletedBefore(cutoff);
    if (n > 0) {
      this.log.log({ action: 'cleanup.soft_deleted', removed: n, cutoff: cutoff.toISOString() });
    }
  }
}
