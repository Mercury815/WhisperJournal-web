import { registerAs } from '@nestjs/config';

export default registerAs('jobs', () => ({
  /** 软删除日记物理清理：保留天数 */
  softDeleteRetentionDays: parseInt(process.env.SOFT_DELETE_RETENTION_DAYS ?? '90', 10),
}));
