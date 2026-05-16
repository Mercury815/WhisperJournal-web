import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppHttpException } from '../../common/exceptions/app-http.exception';
import { ErrorCodes } from '../../types/error-codes';
import type { DiaryScope } from '../../common/utils/session.util';
import { EmotionDictRepository } from '../../persistence/emotion-dict.repository';
import { DiaryRepository } from '../../persistence/diary.repository';

@Injectable()
export class EmotionService {
  private readonly log = new Logger(EmotionService.name);

  constructor(
    private readonly dict: EmotionDictRepository,
    private readonly diaries: DiaryRepository,
  ) {}

  async listDictionary(locale?: string) {
    return this.dict.findAll(locale);
  }

  async recognize(text: string, locale = 'zh-CN') {
    let rows = await this.dict.findAll(locale);
    rows = [...rows].sort((a, b) => b.weight - a.weight);
    const t = text ?? '';
    const hits: { emotionType: string; weight: number; keyword: string }[] = [];
    for (const r of rows) {
      if (t.includes(r.keyword)) {
        hits.push({ emotionType: r.emotionType, weight: r.weight, keyword: r.keyword });
      }
    }
    const byType = new Map<string, { emotionType: string; score: number }>();
    for (const h of hits) {
      const prev = byType.get(h.emotionType);
      const add = h.weight;
      if (!prev) {
        byType.set(h.emotionType, { emotionType: h.emotionType, score: add });
      } else {
        prev.score += add;
      }
    }
    const sorted = [...byType.values()].sort((a, b) => b.score - a.score);
    const top = sorted.slice(0, 3).map((x) => x.emotionType);
    const primary = top[0] ?? 'calm';
    return {
      primaryEmotion: primary,
      emotions: top.length ? top : ['calm'],
      matched: hits.slice(0, 8),
    };
  }

  async feedback(
    scope: DiaryScope,
    diaryId: string,
    emotions: string[],
    primaryEmotion: string,
  ) {
    const entry = await this.diaries.findInScope(scope, diaryId);
    if (!entry || entry.isDeleted) {
      throw new AppHttpException(ErrorCodes.DIARY_NOT_FOUND, '日记不存在', HttpStatus.NOT_FOUND);
    }
    const emo = emotions.slice(0, 3);
    entry.emotions = emo;
    entry.primaryEmotion = primaryEmotion;
    entry.version += 1;
    entry.updatedAt = new Date();
    await this.diaries.save(entry);
    this.log.log({ action: 'emotion.feedback', diaryId });
    return {
      id: entry.id,
      emotions: entry.emotions,
      primaryEmotion: entry.primaryEmotion,
      version: entry.version,
    };
  }
}
