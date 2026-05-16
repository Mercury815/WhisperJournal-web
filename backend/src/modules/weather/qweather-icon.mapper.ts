/**
 * 和风天气 icon 代码 → 前端统一 weatherType
 * @see https://dev.qweather.com/docs/resource/icons/
 */
export function mapQweatherIconToWeatherType(icon: string): string {
  const n = parseInt(icon, 10);
  if (Number.isNaN(n)) {
    return 'unknown';
  }
  if (n === 100 || n === 150) {
    return 'clear';
  }
  if ((n >= 101 && n <= 104) || (n >= 151 && n <= 153)) {
    return 'cloudy';
  }
  if (n === 302 || n === 303 || n === 304) {
    return 'storm';
  }
  if ((n >= 300 && n <= 399) || n === 350 || n === 351) {
    return 'rain';
  }
  if (n >= 400 && n <= 499) {
    return 'snow';
  }
  if (n >= 500 && n <= 515) {
    return 'fog';
  }
  if (n === 999 || n === 901 || n === 900) {
    return 'unknown';
  }
  if (n >= 800 && n <= 807) {
    return 'clear';
  }
  return 'unknown';
}
