import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import type { DiaryEntry } from '../models/domain.types';
import type { DiaryScope } from '../common/utils/session.util';
import { RedisService } from '../modules/redis/redis.service';
import { deserialize, serialize } from './redis-json';
import { diaryScopeKey, K } from './redis-keys';
import { parseMonth } from '../modules/diary/diary.utils';
import type { ListDiaryQueryDto } from '../modules/diary/dto/list-diary.query';

@Injectable()
export class DiaryRepository {
  constructor(private readonly redis: RedisService) {}

  private r(): Redis {
    return this.redis.getRequiredClient();
  }

  scopeKey(scope: DiaryScope): string {
    return diaryScopeKey(scope.userId, scope.deviceId);
  }

  async findById(id: string): Promise<DiaryEntry | null> {
    const raw = await this.r().get(K.diary(id));
    return raw ? deserialize<DiaryEntry>(raw) : null;
  }

  async findInScope(scope: DiaryScope, id: string): Promise<DiaryEntry | null> {
    const e = await this.findById(id);
    if (!e) {
      return null;
    }
    if (scope.userId) {
      return e.userId === scope.userId ? e : null;
    }
    return e.userId === null && e.deviceId === scope.deviceId ? e : null;
  }

  /** 含已软删，用于恢复 */
  async findInScopeAllowDeleted(scope: DiaryScope, id: string): Promise<DiaryEntry | null> {
    return this.findInScope(scope, id);
  }

  async findByMutation(deviceId: string, clientMutationId: string): Promise<DiaryEntry | null> {
    const id = await this.r().get(K.diaryMut(deviceId, clientMutationId));
    if (!id) {
      return null;
    }
    return this.findById(id);
  }

  private monthFromDateKey(dateKey: string): string {
    return dateKey.slice(0, 7);
  }

  async create(entry: DiaryEntry): Promise<void> {
    const sk = diaryScopeKey(entry.userId, entry.deviceId);
    const mk = this.monthFromDateKey(entry.dateKey);
    const pipe = this.r().pipeline();
    pipe.set(K.diary(entry.id), serialize(entry));
    pipe.sadd(K.diaryScope(sk), entry.id);
    pipe.sadd(K.diaryMonth(sk, mk), entry.id);
    if (entry.clientMutationId) {
      pipe.set(K.diaryMut(entry.deviceId, entry.clientMutationId), entry.id);
    }
    await pipe.exec();
  }

  async update(entry: DiaryEntry, prevDateKey?: string): Promise<void> {
    const sk = diaryScopeKey(entry.userId, entry.deviceId);
    const pipe = this.r().pipeline();
    pipe.set(K.diary(entry.id), serialize(entry));
    if (prevDateKey && prevDateKey !== entry.dateKey) {
      const oldM = this.monthFromDateKey(prevDateKey);
      const newM = this.monthFromDateKey(entry.dateKey);
      pipe.srem(K.diaryMonth(sk, oldM), entry.id);
      pipe.sadd(K.diaryMonth(sk, newM), entry.id);
    }
    await pipe.exec();
  }

  async save(entry: DiaryEntry): Promise<void> {
    await this.r().set(K.diary(entry.id), serialize(entry));
  }

  /** 按月份索引拉取（统计/日历用） */
  async listByMonth(scope: DiaryScope, yyyyMm: string): Promise<DiaryEntry[]> {
    const sk = this.scopeKey(scope);
    const ids = await this.r().smembers(K.diaryMonth(sk, yyyyMm));
    const rows: DiaryEntry[] = [];
    for (const id of ids) {
      const e = await this.findById(id);
      if (e && !e.isDeleted) {
        rows.push(e);
      }
    }
    rows.sort((a, b) => {
      const dk = b.dateKey.localeCompare(a.dateKey);
      if (dk !== 0) {
        return dk;
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return rows;
  }

  async list(scope: DiaryScope, q: ListDiaryQueryDto): Promise<{ list: DiaryEntry[]; total: number }> {
    const sk = this.scopeKey(scope);
    const ids = await this.r().smembers(K.diaryScope(sk));
    const rows: DiaryEntry[] = [];
    if (ids.length === 0) {
      return { list: [], total: 0 };
    }
    const pipe = this.r().pipeline();
    for (const id of ids) {
      pipe.get(K.diary(id));
    }
    const res = await pipe.exec();
    for (const r of res ?? []) {
      const err = r[0];
      const raw = r[1] as string | null;
      if (!err && raw) {
        rows.push(deserialize<DiaryEntry>(raw));
      }
    }

    let filtered = rows.filter((e) => !e.isDeleted);
    if (q.dateKey) {
      filtered = filtered.filter((e) => e.dateKey === q.dateKey);
    } else if (q.month) {
      const range = parseMonth(q.month);
      if (range) {
        filtered = filtered.filter((e) => e.dateKey >= range.start && e.dateKey <= range.end);
      }
    }

    filtered.sort((a, b) => {
      const dk = b.dateKey.localeCompare(a.dateKey);
      if (dk !== 0) {
        return dk;
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    const total = filtered.length;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);
    return { list, total };
  }

  async bindAnonDiariesToUser(deviceId: string, userId: string): Promise<void> {
    const oldSk = diaryScopeKey(null, deviceId);
    const newSk = diaryScopeKey(userId, deviceId);
    const ids = await this.r().smembers(K.diaryScope(oldSk));
    for (const id of ids) {
      const e = await this.findById(id);
      if (!e || e.userId !== null) {
        continue;
      }
      const prevMonth = this.monthFromDateKey(e.dateKey);
      e.userId = userId;
      e.updatedAt = new Date();
      const pipe = this.r().pipeline();
      pipe.srem(K.diaryScope(oldSk), id);
      pipe.srem(K.diaryMonth(oldSk, prevMonth), id);
      pipe.sadd(K.diaryScope(newSk), id);
      pipe.sadd(K.diaryMonth(newSk, prevMonth), id);
      pipe.set(K.diary(id), serialize(e));
      await pipe.exec();
    }
  }

  /** 物理删除：软删超过 cutoff 的条目及索引 */
  async hardDeleteSoftDeletedBefore(cutoff: Date): Promise<number> {
    const r = this.r();
    const allDiaryKeys: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await r.scan(cursor, 'MATCH', 'wj:diary:*', 'COUNT', 200);
      cursor = next;
      allDiaryKeys.push(...keys);
    } while (cursor !== '0');

    let removed = 0;
    for (const key of allDiaryKeys) {
      const raw = await r.get(key);
      if (!raw) {
        continue;
      }
      const e = deserialize<DiaryEntry>(raw);
      if (!e.isDeleted || !e.deletedAt || e.deletedAt >= cutoff) {
        continue;
      }
      const sk = diaryScopeKey(e.userId, e.deviceId);
      const mk = this.monthFromDateKey(e.dateKey);
      const pipe = r.pipeline();
      pipe.srem(K.diaryScope(sk), e.id);
      pipe.srem(K.diaryMonth(sk, mk), e.id);
      if (e.clientMutationId) {
        pipe.del(K.diaryMut(e.deviceId, e.clientMutationId));
      }
      pipe.del(key);
      await pipe.exec();
      removed += 1;
    }
    return removed;
  }
}
