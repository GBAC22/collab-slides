import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollabService {
  constructor(private readonly prisma: PrismaService) {}

  async updateSlide(slideId: string, changes: any, userId?: string) {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: {
        project: {
          select: {
            id: true,
            members: {
              where: { userId },
              select: { role: true }
            }
          }
        }
      }
    });

    if (!slide) {
      throw new NotFoundException(`Slide con ID ${slideId} no encontrado`);
    }

    if (userId && !slide.project.members.length) {
      throw new ForbiddenException('No tienes permiso para editar este slide');
    }

    return this.prisma.slide.update({
      where: { id: slideId },
      data: {
        title: changes.title ?? slide.title,
        content: changes.content ?? slide.content,
        imageUrl: changes.imageUrl ?? slide.imageUrl,
        updatedAt: new Date(),
      },
    });
  }


  async deleteSlide(slideId: string) {
  return this.prisma.slide.delete({
    where: { id: slideId },
  });
}
}