import { Injectable, Logger } from '@nestjs/common';
import { SyncQueueRepository } from '../../persistence/sync-queue.repository';

/**
 * 同步队列占位处理：后续可将 diary 等业务重放逻辑接入 handleOne。
 */
@Injectable()
export class SyncQueueWorkerService {
  private readonly log = new Logger(SyncQueueWorkerService.name);

  constructor(private readonly syncQueue: SyncQueueRepository) {}

  async drainPending(limit = 50): Promise<number> {
    const rows = await this.syncQueue.listPending(limit);
    let n = 0;
    for (const row of rows) {
      if (row.nextRetryAt && row.nextRetryAt > new Date()) {
        continue;
      }
      const touched = await this.handleOne(row.id);
      if (touched) {
        n += 1;
      }
    }
    return n;
  }

  async handleOne(id: string): Promise<boolean> {
    const row = await this.syncQueue.findById(id);
    if (!row || row.status !== 'pending') {
      return false;
    }
    if (row.nextRetryAt && row.nextRetryAt > new Date()) {
      return false;
    }

    row.lastTriedAt = new Date();
    row.retryCount += 1;
    row.updatedAt = new Date();

    const maxRetry = 10;
    if (row.retryCount >= maxRetry) {
      row.status = 'failed';
      row.nextRetryAt = null;
      await this.syncQueue.save(row);
      this.log.warn({ action: 'sync_queue.dead', id: row.id, retries: row.retryCount });
      return true;
    }

    const backoffMs = Math.min(60_000 * row.retryCount, 3_600_000);
    row.nextRetryAt = new Date(Date.now() + backoffMs);
    await this.syncQueue.save(row);
    this.log.log({
      action: 'sync_queue.retry_scheduled',
      id: row.id,
      retry: row.retryCount,
      nextRetryAt: row.nextRetryAt.toISOString(),
    });
    return true;
  }
}
