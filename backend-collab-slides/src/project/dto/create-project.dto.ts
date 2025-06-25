// src/project/dto/create-project.dto.ts
export class CreateProjectDto {
  name: string;
  description?: string;
  method?: string; // 'manual' | 'ai-text' | 'ai-voice'
}