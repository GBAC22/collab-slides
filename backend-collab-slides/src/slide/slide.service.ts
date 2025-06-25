import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlideDto } from './dto/create-slide.dto';
import { UpdateSlideDto } from './dto/update-slide.dto';
import { SlideData } from '../export/export.service'; 

@Injectable()
export class SlideService {
  constructor(private prisma: PrismaService) {}

  create(createSlideDto: CreateSlideDto) {
    return this.prisma.slide.create({
      data: createSlideDto,
    });
  }

  findAllByProject(projectId: string) {
    return this.prisma.slide.findMany({
      where: { projectId },
    });
  }

  findOne(id: string) {
    return this.prisma.slide.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateSlideDto: UpdateSlideDto) {
    const slide = await this.prisma.slide.findUnique({ where: { id } });
    if (!slide) throw new NotFoundException('Slide not found');

    return this.prisma.slide.update({
      where: { id },
      data: {
        ...updateSlideDto,
       // updatedAt: new Date()
      }
    });
  }

  delete(id: string) {
    return this.prisma.slide.delete({
      where: { id },
    });
  }



  async createManySlides(projectId: string, slides: SlideData[]) {
    for (const slide of slides) {
      await this.prisma.slide.create({
        data: {
          projectId,
          title: slide.title,
          content: slide.content || '',
          bulletPoints: slide.bulletPoints || [],
          slideType: slide.slideType || 'content',
          imagePrompt: slide.imagePrompt,
          imageUrl: slide.imageUrl,
          data: slide.data || {},
        }
      });
    }
  }


}
