/** 与前端可对的统一天气枚举（降级为 unknown） */
export function mapWmoCodeToWeatherType(code: number): string {
  if (code === 0) {
    return 'clear';
  }
  if (code >= 1 && code <= 3) {
    return 'cloudy';
  }
  if (code === 45 || code === 48) {
    return 'fog';
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return 'rain';
  }
  if (code >= 71 && code <= 77) {
    return 'snow';
  }
  if (code >= 95) {
    return 'storm';
  }
  if (code >= 56 && code <= 57) {
    return 'rain';
  }
  return 'unknown';
}
