import type { UserSettingsJson } from './user.types';

export type { UserSettingsJson } from './user.types';

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  passwordHash: string | null;
  tokenVersion: number;
  settings: UserSettingsJson;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface Device {
  id: string;
  userId: string | null;
  deviceId: string;
  createdAt: Date;
  lastSeenAt: Date;
  mergedAt: Date | null;
}

export interface DiaryEntry {
  id: string;
  userId: string | null;
  deviceId: string;
  content: string;
  summary: string;
  emotions: unknown[];
  primaryEmotion: string | null;
  weatherType: string | null;
  weatherSnapshot: Record<string, unknown> | null;
  timePhase: string | null;
  dateKey: string;
  version: number;
  syncStatus: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  clientMutationId: string | null;
}

export interface EmotionDictionary {
  id: string;
  keyword: string;
  emotionType: string;
  weight: number;
  locale: string;
  isActive: boolean;
}

export interface WeatherSnapshot {
  id: string;
  location: string;
  weatherType: string;
  temperature: number | null;
  humidity: number | null;
  source: string;
  capturedAt: Date;
  createdAt: Date;
}

export interface SyncQueue {
  id: string;
  userId: string | null;
  deviceId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  status: string;
  retryCount: number;
  lastTriedAt: Date | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
