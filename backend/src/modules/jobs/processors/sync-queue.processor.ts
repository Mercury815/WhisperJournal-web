import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { SyncQueueWorkerService } from '../sync-queue-worker.service';

@Processor('sync')
export class SyncQueueProcessor {
  private readonly log = new Logger(SyncQueueProcessor.name);

  constructor(private readonly worker: SyncQueueWorkerService) {}

  @Process('retry')
  async handle(job: Job<{ id: string }>): Promise<void> {
    await this.worker.handleOne(job.data.id);
    this.log.log({ action: 'sync_queue.bull', jobId: job.id, rowId: job.data.id });
  }
}
