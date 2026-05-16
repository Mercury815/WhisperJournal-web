import { registerAs } from '@nestjs/config';

export default registerAs('weather', () => {
  const host = (process.env.WEATHER_API_HOST ?? 'https://devapi.qweather.com').replace(/\/$/, '');
  return {
    /** 兼容旧字段，一般留空 */
    apiUrl: process.env.WEATHER_API_URL ?? '',
    apiKey: (process.env.WEATHER_API_KEY ?? '').trim(),
    /** 控制台「设置」中的独立 API Host；未配置时用官方开发域（建议尽快换独立 Host） */
    apiHost: host,
    /** API KEY 凭据 ID，仅作日志/排查；请求里用 key 参数即可 */
    credentialId: (process.env.WEATHER_CREDENTIAL_ID ?? '').trim(),
  };
});
