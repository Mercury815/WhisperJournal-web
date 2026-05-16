import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DiaryEntry } from '../../models/domain.types';
import type { DiaryScope } from '../../common/utils/session.util';
import { AppHttpException } from '../../common/exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import { DiaryRepository } from '../../persistence/diary.repository';
import { clampContent, makeSummary, parseMonth } from './diary.utils';
import type { CreateDiaryDto } from './dto/create-diary.dto';
import type { UpdateDiaryDto } from './dto/update-diary.dto';
import type { ListDiaryQueryDto } from './dto/list-diary.query';
import type { SyncDiaryDto, SyncDiaryItemDto } from './dto/sync-diary.dto';

@Injectable()
export class DiaryService {
  private readonly log = new Logger(DiaryService.name);

  constructor(private readonly diaries: DiaryRepository) {}

  toPublic(e: DiaryEntry) {
    return {
      id: e.id,
      userId: e.userId,
      deviceId: e.deviceId,
      content: e.content,
      summary: e.summary,
      emotions: e.emotions,
      primaryEmotion: e.primaryEmotion,
      weatherType: e.weatherType,
      weatherSnapshot: e.weatherSnapshot,
      timePhase: e.timePhase,
      dateKey: e.dateKey,
      version: e.version,
      syncStatus: e.syncStatus,
      isDeleted: e.isDeleted,
      deletedAt: e.deletedAt,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      clientMutationId: e.clientMutationId,
    };
  }

  async create(scope: DiaryScope, dto: CreateDiaryDto) {
    const content = clampContent(dto.content);
    if (dto.clientMutationId) {
      const dup = await this.diaries.findByMutation(scope.deviceId, dto.clientMutationId);
      if (dup) {
        const ok = await this.diaries.findInScope(scope, dup.id);
        if (ok) {
          this.log.log({ action: 'diary.create.idempotent', id: dup.id });
          return this.toPublic(dup);
        }
      }
    }
    const now = new Date();
    const row: DiaryEntry = {
      id: randomUUID(),
      userId: scope.userId,
      deviceId: scope.deviceId,
      content,
      summary: makeSummary(content),
      emotions: dto.emotions ?? [],
      primaryEmotion: dto.primaryEmotion ?? null,
      weatherType: dto.weatherType ?? null,
      weatherSnapshot: dto.weatherSnapshot ?? null,
      timePhase: dto.timePhase ?? null,
      dateKey: dto.dateKey,
      version: 1,
      syncStatus: 'synced',
      isDeleted: false,
      deletedAt: null,
      clientMutationId: dto.clientMutationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.diaries.create(row);
    this.log.log({ action: 'diary.create', id: row.id, userId: scope.userId, deviceId: scope.deviceId });
    return this.toPublic(row);
  }

  async update(scope: DiaryScope, id: string, dto: UpdateDiaryDto) {
    const entry = await this.mustGet(scope, id);
    if (entry.version !== dto.version) {
      throw new AppHttpException(
        ErrorCodes.DIARY_CONFLICT,
        '版本冲突，请刷新后重试',
        HttpStatus.CONFLICT,
      );
    }
    const prevDateKey = entry.dateKey;
    if (dto.content !== undefined) {
      const c = clampContent(dto.content);
      entry.content = c;
      entry.summary = makeSummary(c);
    }
    if (dto.primaryEmotion !== undefined) {
      entry.primaryEmotion = dto.primaryEmotion;
    }
    if (dto.weatherType !== undefined) {
      entry.weatherType = dto.weatherType;
    }
    if (dto.weatherSnapshot !== undefined) {
      entry.weatherSnapshot = dto.weatherSnapshot;
    }
    if (dto.timePhase !== undefined) {
      entry.timePhase = dto.timePhase;
    }
    entry.version = entry.version + 1;
    entry.syncStatus = 'synced';
    entry.updatedAt = new Date();
    await this.diaries.update(entry, prevDateKey !== entry.dateKey ? prevDateKey : undefined);
    this.log.log({ action: 'diary.update', id: entry.id });
    return this.toPublic(entry);
  }

  async getOne(scope: DiaryScope, id: string) {
    const e = await this.mustGet(scope, id);
    return this.toPublic(e);
  }

  async list(scope: DiaryScope, q: ListDiaryQueryDto) {
    const r = await this.diaries.list(scope, q);
    return {
      list: r.list.map((e) => this.toPublic(e)),
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      total: r.total,
    };
  }

  async remove(scope: DiaryScope, id: string) {
    const entry = await this.mustGet(scope, id);
    entry.isDeleted = true;
    entry.deletedAt = new Date();
    entry.version += 1;
    entry.syncStatus = 'synced';
    entry.updatedAt = new Date();
    await this.diaries.save(entry);
    this.log.log({ action: 'diary.soft_delete', id });
    return { id, ok: true };
  }

  async restore(scope: DiaryScope, id: string) {
    const entry = await this.diaries.findInScopeAllowDeleted(scope, id);
    if (!entry) {
      throw new AppHttpException(ErrorCodes.DIARY_NOT_FOUND, '日记不存在', HttpStatus.NOT_FOUND);
    }
    entry.isDeleted = false;
    entry.deletedAt = null;
    entry.version += 1;
    entry.syncStatus = 'synced';
    entry.updatedAt = new Date();
    await this.diaries.save(entry);
    this.log.log({ action: 'diary.restore', id });
    return this.toPublic(entry);
  }

  async sync(scope: DiaryScope, body: SyncDiaryDto) {
    if (body.deviceId !== scope.deviceId) {
      throw new AppHttpException(
        ErrorCodes.VALIDATION_ERROR,
        'deviceId 与令牌不一致',
        HttpStatus.BAD_REQUEST,
      );
    }

    const results: Array<{
      clientMutationId?: string;
      id?: string;
      status: 'ok' | 'conflict' | 'error';
      entry?: ReturnType<DiaryService['toPublic']>;
      serverVersion?: number;
      message?: string;
    }> = [];

    for (const item of body.items) {
      const tag = item.clientMutationId ?? item.id ?? 'unknown';
      try {
        const r = await this.syncOne(scope, item);
        results.push(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({
          clientMutationId: item.clientMutationId,
          id: item.id,
          status: 'error',
          message: msg,
        });
        this.log.warn({ action: 'diary.sync.item_error', tag, msg });
      }
    }

    this.log.log({ action: 'diary.sync.batch', count: body.items.length });
    return { results };
  }

  private async syncOne(
    scope: DiaryScope,
    item: SyncDiaryItemDto,
  ): Promise<{
    clientMutationId?: string;
    id: string;
    status: 'ok' | 'conflict';
    entry: ReturnType<DiaryService['toPublic']>;
    serverVersion?: number;
  }> {
    if (item.clientMutationId) {
      const dup = await this.diaries.findByMutation(scope.deviceId, item.clientMutationId);
      if (dup && (await this.diaries.findInScope(scope, dup.id))) {
        return { clientMutationId: item.clientMutationId, id: dup.id, status: 'ok', entry: this.toPublic(dup) };
      }
    }

    if (item.id) {
      const existing = await this.diaries.findInScope(scope, item.id);
      if (!existing) {
        throw new AppHttpException(ErrorCodes.DIARY_NOT_FOUND, '日记不存在', HttpStatus.NOT_FOUND);
      }

      if (existing.isDeleted && item.isDeleted !== true) {
        throw new AppHttpException(ErrorCodes.DIARY_NOT_FOUND, '日记已删除', HttpStatus.NOT_FOUND);
      }

      if (item.isDeleted === true) {
        if (item.version !== undefined && item.version !== existing.version) {
          return {
            id: existing.id,
            status: 'conflict',
            entry: this.toPublic(existing),
            serverVersion: existing.version,
          };
        }
        existing.isDeleted = true;
        existing.deletedAt = new Date();
        existing.version += 1;
        existing.syncStatus = 'synced';
        existing.updatedAt = new Date();
        await this.diaries.save(existing);
        return { id: existing.id, status: 'ok', entry: this.toPublic(existing) };
      }

      const hasPatch =
        item.content !== undefined ||
        item.dateKey !== undefined ||
        item.primaryEmotion !== undefined ||
        item.weatherType !== undefined ||
        item.weatherSnapshot !== undefined ||
        item.timePhase !== undefined ||
        item.emotions !== undefined;

      if (hasPatch) {
        if (item.version !== undefined && item.version !== existing.version) {
          return {
            id: existing.id,
            status: 'conflict',
            entry: this.toPublic(existing),
            serverVersion: existing.version,
          };
        }
        const prevDateKey = existing.dateKey;
        if (item.content !== undefined) {
          const c = clampContent(item.content);
          existing.content = c;
          existing.summary = makeSummary(c);
        }
        if (item.dateKey !== undefined) {
          existing.dateKey = item.dateKey;
        }
        if (item.primaryEmotion !== undefined) {
          existing.primaryEmotion = item.primaryEmotion ?? null;
        }
        if (item.weatherType !== undefined) {
          existing.weatherType = item.weatherType;
        }
        if (item.weatherSnapshot !== undefined) {
          existing.weatherSnapshot = item.weatherSnapshot ?? null;
        }
        if (item.timePhase !== undefined) {
          existing.timePhase = item.timePhase;
        }
        if (item.emotions !== undefined) {
          existing.emotions = item.emotions ?? [];
        }
        existing.version += 1;
        existing.syncStatus = 'synced';
        existing.updatedAt = new Date();
        await this.diaries.update(existing, prevDateKey !== existing.dateKey ? prevDateKey : undefined);
        return {
          clientMutationId: item.clientMutationId,
          id: existing.id,
          status: 'ok',
          entry: this.toPublic(existing),
        };
      }

      return { id: existing.id, status: 'ok', entry: this.toPublic(existing) };
    }

    if (!item.content || !item.dateKey) {
      throw new AppHttpException(
        ErrorCodes.VALIDATION_ERROR,
        '新建同步项需包含 content 与 dateKey',
        HttpStatus.BAD_REQUEST,
      );
    }

    const content = clampContent(item.content);
    const now = new Date();
    const row: DiaryEntry = {
      id: randomUUID(),
      userId: scope.userId,
      deviceId: scope.deviceId,
      content,
      summary: makeSummary(content),
      emotions: item.emotions ?? [],
      primaryEmotion: item.primaryEmotion ?? null,
      weatherType: item.weatherType ?? null,
      weatherSnapshot: item.weatherSnapshot ?? null,
      timePhase: item.timePhase ?? null,
      dateKey: item.dateKey,
      version: 1,
      syncStatus: 'synced',
      isDeleted: item.isDeleted ?? false,
      deletedAt: item.isDeleted ? new Date() : null,
      clientMutationId: item.clientMutationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.diaries.create(row);
    return {
      clientMutationId: item.clientMutationId,
      id: row.id,
      status: 'ok',
      entry: this.toPublic(row),
    };
  }

  private async mustGet(scope: DiaryScope, id: string): Promise<DiaryEntry> {
    const e = await this.diaries.findInScope(scope, id);
    if (!e || e.isDeleted) {
      throw new AppHttpException(ErrorCodes.DIARY_NOT_FOUND, '日记不存在', HttpStatus.NOT_FOUND);
    }
    return e;
  }
}
