import { Equals, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** 密码：8–128 位，须含字母与数字（降低纯数字/弱口令风险） */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, {
    message: '密码须同时包含字母与数字',
  })
  password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  passwordConfirm!: string;

  /** 须阅读并同意隐私与条款（仅注册时校验） */
  @IsBoolean()
  @Equals(true, { message: '请先同意隐私政策与服务条款' })
  acceptTerms!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}
