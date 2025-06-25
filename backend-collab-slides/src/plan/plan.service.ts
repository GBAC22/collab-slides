import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  async getPlanUsage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true }
    });

    if (!user || !user.plan) {
      throw new BadRequestException('No se encontró el plan del usuario');
    }

    const planLimits = {
      free: {
        monthlyExports: 5,
        maxSlidesPerMonth: 20,
        maxImagesPerMonth: 10,
      },
      premium: {
        monthlyExports: 50,
        maxSlidesPerMonth: 200,
        maxImagesPerMonth: 100,
      },
      enterprise: {
        monthlyExports: 500,
        maxSlidesPerMonth: 2000,
        maxImagesPerMonth: 1000,
      },
    };

    const planKey = user.plan.name.toLowerCase();
    const limits = planLimits[planKey] || planLimits.free;

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const exportsThisMonth = await this.prisma.exportLog.count({
      where: {
        userId,
        createdAt: { gte: firstOfMonth }
      }
    });

    const slidesThisMonth = await this.prisma.slide.count({
      where: {
        project: { userId },
        createdAt: { gte: firstOfMonth }
      }
    });

    const imagesThisMonth = await this.prisma.slide.count({
      where: {
        project: { userId },
        imageUrl: { not: null },
        createdAt: { gte: firstOfMonth }
      }
    });

    return {
      plan: {
        name: user.plan.name,
        ...limits
      },
      usage: {
        exports: exportsThisMonth,
        slides: slidesThisMonth,
        images: imagesThisMonth
      },
      remaining: {
        exports: limits.monthlyExports - exportsThisMonth,
        slides: limits.maxSlidesPerMonth - slidesThisMonth,
        images: limits.maxImagesPerMonth - imagesThisMonth
      }
    };
  }

  async validateExportRequest(userId: string, requestedSlides: number, requestedImages: number) {
    const usage = await this.getPlanUsage(userId);

    if (usage.remaining.exports <= 0) {
      throw new BadRequestException('Límite de exportaciones alcanzado para este mes');
    }

    if (requestedSlides > usage.remaining.slides) {
      throw new BadRequestException(`Límite de slides superado: máximo ${usage.remaining.slides} disponibles`);
    }

    if (requestedImages > usage.remaining.images) {
      throw new BadRequestException(`Límite de imágenes superado: máximo ${usage.remaining.images} disponibles`);
    }
  }

  async findAll() {
    return this.prisma.plan.findMany();
  }

  async findOne(id: string) {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async assignUserToPlan(planId: string, userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { planId }
    });
  }
}
