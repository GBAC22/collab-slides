import { IsOptional, IsString, IsArray, IsObject } from 'class-validator';

export class UpdateSlideDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  bulletPoints?: string[];

  @IsOptional()
  slideType?: string;

  @IsOptional()
  imagePrompt?: string;

  @IsOptional()
  imageUrl?: string;

  @IsOptional()
  data?: any;
}
