import { IsArray, IsString, IsUUID, MaxLength, ArrayMaxSize } from 'class-validator';

export class FeedbackDto {
  @IsUUID()
  diaryId!: string;

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  emotions!: string[];

  @IsString()
  @MaxLength(64)
  primaryEmotion!: string;
}
