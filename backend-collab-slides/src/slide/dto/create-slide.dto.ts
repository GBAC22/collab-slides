import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class CreateSlideDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsArray()
  @IsOptional()
  bulletPoints?: string[];

  @IsString()
  slideType: string;

  @IsString()
  @IsOptional()
  imagePrompt?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @IsString()
  projectId: string;
}
