import { Injectable } from '@nestjs/common';

/** 仅开发调试用内存状态，不参与生产持久化 */
@Injectable()
export class DebugRuntimeService {
  weatherOverride?: { weatherType?: string; temperature?: number | null; humidity?: number | null };
  timeOffsetMs = 0;
  transitionTrigger?: string;
}
