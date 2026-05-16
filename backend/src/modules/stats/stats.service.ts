import { HttpStatus, Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import type { DiaryScope } from '../../common/utils/session.util';
import { parseMonth } from '../diary/diary.utils';
import { DiaryRepository } from '../../persistence/diary.repository';

@Injectable()
export class StatsService {
  constructor(private readonly diaries: DiaryRepository) {}

  async calendar(scope: DiaryScope, month: string) {
    const range = parseMonth(month);
    if (!range) {
      throw new AppHttpException(
        ErrorCodes.VALIDATION_ERROR,
        'month 格式应为 YYYY-MM',
        HttpStatus.BAD_REQUEST,
      );
    }
    const list = await this.diaries.listByMonth(scope, month);
    const seen = new Set<string>();
    const days: Array<{
      dateKey: string;
      hasEntry: boolean;
      primaryEmotion: string | null;
      summary: string;
      weatherType: string | null;
    }> = [];
    for (const e of list) {
      if (seen.has(e.dateKey)) {
        continue;
      }
      seen.add(e.dateKey);
      days.push({
        dateKey: e.dateKey,
        hasEntry: true,
        primaryEmotion: e.primaryEmotion,
        summary: e.summary,
        weatherType: e.weatherType,
      });
    }
    return { month, days };
  }

  async monthOverview(scope: DiaryScope, month: string) {
    const range = parseMonth(month);
    if (!range) {
      throw new AppHttpException(
        ErrorCodes.VALIDATION_ERROR,
        'month 格式应为 YYYY-MM',
        HttpStatus.BAD_REQUEST,
      );
    }
    const list = await this.diaries.listByMonth(scope, month);
    const entryCount = list.length;
    const activeDays = new Set(list.map((e) => e.dateKey)).size;
    return { month, entryCount, activeDays };
  }

  async emotionDistribution(scope: DiaryScope, month: string) {
    const range = parseMonth(month);
    if (!range) {
      throw new AppHttpException(
        ErrorCodes.VALIDATION_ERROR,
        'month 格式应为 YYYY-MM',
        HttpStatus.BAD_REQUEST,
      );
    }
    const list = await this.diaries.listByMonth(scope, month);
    const counts = new Map<string, number>();
    for (const e of list) {
      if (!e.primaryEmotion) {
        continue;
      }
      counts.set(e.primaryEmotion, (counts.get(e.primaryEmotion) ?? 0) + 1);
    }
    const items = [...counts.entries()].map(([emotion, count]) => ({ emotion, count }));
    return { month, items };
  }
}
