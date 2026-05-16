import { create } from 'zustand';

export type TimePhase = 'dawn' | 'day' | 'dusk' | 'night';
export type WeatherType = 'sunny' | 'rain' | 'snow' | 'cloudy';

export interface DebugState {
  enabled: boolean;
  overrideTime: TimePhase | null;
  overrideWeather: WeatherType | null;
  particleMultiplier: number;
  speedMultiplier: number;
  showInfo: boolean;
  demoMode: boolean;
}

export function getBaselineEnv(state: EnvironmentState): { timePhase: TimePhase; weather: WeatherType } {
  let timePhase = state.realTimePhase;
  let weather = state.realWeather;
  if (state.debug.enabled) {
    timePhase = state.debug.overrideTime ?? timePhase;
    weather = state.debug.overrideWeather ?? weather;
  }
  return { timePhase, weather };
}

export interface EnvironmentState {
  realTimePhase: TimePhase;
  realWeather: WeatherType;
  timestamp: number;
  isTransitioning: boolean;
  typingIntensity: number; // 0 to 1
  debug: DebugState;
  /** 用户自由调节场景（不受真实天气/时间约束）；开启时覆盖基准环境 */
  freeMode: boolean;
  freeTimePhase: TimePhase;
  freeWeather: WeatherType;

  setEnvironment: (env: Partial<Pick<EnvironmentState, 'realTimePhase' | 'realWeather' | 'timestamp' | 'isTransitioning'>>) => void;
  setTypingIntensity: (intensity: number) => void;
  setDebug: (debugPatch: Partial<DebugState>) => void;
  setFreeMode: (enabled: boolean) => void;
  setFreeEnvironment: (patch: Partial<{ timePhase: TimePhase; weather: WeatherType }>) => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  realTimePhase: 'day',
  realWeather: 'cloudy',
  timestamp: Date.now(),
  isTransitioning: false,
  typingIntensity: 0,
  freeMode: false,
  freeTimePhase: 'day',
  freeWeather: 'cloudy',
  debug: {
    enabled: process.env.NODE_ENV !== 'production',
    overrideTime: null,
    overrideWeather: null,
    particleMultiplier: 1,
    speedMultiplier: 1,
    showInfo: false,
    demoMode: false,
  },
  setEnvironment: (env) => set((state) => ({ ...state, ...env })),
  setTypingIntensity: (intensity) => set({ typingIntensity: intensity }),
  setDebug: (patch) => set((state) => ({ debug: { ...state.debug, ...patch } })),
  setFreeMode: (enabled) =>
    set((state) => {
      if (enabled) {
        const { timePhase, weather } = getBaselineEnv(state);
        return { ...state, freeMode: true, freeTimePhase: timePhase, freeWeather: weather };
      }
      return { ...state, freeMode: false };
    }),
  setFreeEnvironment: (patch) =>
    set((state) => ({
      ...state,
      freeTimePhase: patch.timePhase ?? state.freeTimePhase,
      freeWeather: patch.weather ?? state.freeWeather,
    })),
}));

export function getTimePhase(date: Date): TimePhase {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}

export function getEffectiveEnv(state: EnvironmentState) {
  const base = {
    typingIntensity: state.typingIntensity,
    timestamp: state.timestamp,
    debug: state.debug,
  };
  const baseline = getBaselineEnv(state);
  if (state.freeMode) {
    return {
      ...base,
      timePhase: state.freeTimePhase,
      weather: state.freeWeather,
    };
  }
  return {
    ...base,
    timePhase: baseline.timePhase,
    weather: baseline.weather,
  };
}
