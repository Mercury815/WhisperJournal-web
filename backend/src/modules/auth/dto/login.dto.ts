import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  /** 登录兼容历史口令：仅长度限制；新账号请走注册强策略 */
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  /** 登录后绑定到该设备的匿名数据 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}
