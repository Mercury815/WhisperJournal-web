export type UserSettingsJson = {
  soundEnabled?: boolean;
  defaultAudioType?: string;
  autoLoginEnabled?: boolean;
  minimalModePreference?: boolean;
  themePreference?: string;
  lastWeatherPermission?: string;
  weatherLocation?: { label: string; lat: number; lon: number };
  /** 注册时同意条款的时间（ISO） */
  termsAcceptedAt?: string;
};
