import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncQueueWorkerService } from '../sync-queue-worker.service';

@Injectable()
export class SyncRetryTask {
  private readonly log = new Logger(SyncRetryTask.name);

  constructor(private readonly worker: SyncQueueWorkerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    const n = await this.worker.drainPending(80);
    if (n > 0) {
      this.log.log({ action: 'sync_retry.cron', processed: n });
    }
  }
}
