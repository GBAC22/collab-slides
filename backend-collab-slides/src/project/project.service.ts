import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { ExportService } from '../export/export.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteUserDto } from './dto/invite-user.dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly exportService: ExportService
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    return this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        userId,
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
      include: {
        members: true,
        slides: true,
      },
    });
  }

  async findAllByUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        slides: true,
        members: true,
      },
    });

    return projects.map((project) => ({
      ...project,
      downloadUrl: project.pptxUrl
        ? `/export/download/${project.pptxUrl.split('/').pop()}`
        : null,
    }));
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: { include: { user: true } },
        slides: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const exists = await this.prisma.project.findUnique({ where: { id } });

    if (!exists) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
    });
  }

  async inviteUser(projectId: string, invite: InviteUserDto) {
    const exists = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (!exists) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: invite.userId,
        role: invite.role,
      },
    });
  }

  async delete(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este proyecto');
    }

    if (project.pptxUrl) {
      const fileName = project.pptxUrl.split('/').pop() || '';
      if (fileName) {
        try {
          await this.minioService.deleteFile('presentations', fileName);
          console.log(`✅ Archivo ${fileName} eliminado de MinIO`);
        } catch (err) {
          console.warn(`⚠️ No se pudo eliminar archivo MinIO: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    await this.prisma.projectMember.deleteMany({
      where: { projectId: id },
    });

    await this.prisma.slide.deleteMany({
      where: { projectId: id },
    });

    return this.prisma.project.delete({
      where: { id },
    });
  }



  private normalizeSlides(slides: any[]): any[] {
    return slides.map((slide, index) => {
      const isTitleSlide = index === 0;
      const isConclusionSlide = index === slides.length - 1;

      const normalized = {
        ...slide,
        title: slide.title?.trim() || (isTitleSlide ? 'Título de la presentación' : `Diapositiva ${index + 1}`),
        content: slide.content !== undefined ? slide.content : '',
        bulletPoints: this.ensureStringArray(slide.bulletPoints), // ✅ FIX: Usar método helper
        slideType: slide.slideType || (isTitleSlide ? 'title' : (isConclusionSlide ? 'conclusion' : 'content')),
        imagePrompt: slide.imagePrompt || undefined,
        imageUrl: slide.imageUrl || undefined,
        data: this.ensureDataObject(slide.data), // ✅ FIX: Usar método helper
      };

      return normalized;
    });
  }
  // 🚀 NUEVO MÉTODO EXPORTACIÓN
  async exportToPptx(projectId: string, userId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId } },
        slides: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    if (!project.members.length) {
      throw new ForbiddenException('No tienes permiso para exportar este proyecto');
    }

    if (!project.slides || project.slides.length === 0) {
      throw new NotFoundException('El proyecto no tiene slides para exportar');
    }

    console.log(`📤 Exportando proyecto ${projectId} con ${project.slides.length} slides existentes...`);

    // ✅ Convertir slides de DB al formato correcto con tipos seguros
    const slidesData = project.slides.map(slide => ({
      title: slide.title,
      content: slide.content || '',
      bulletPoints: this.ensureStringArray(slide.bulletPoints), // ✅ FIX: Conversión segura
      slideType: slide.slideType,
      imagePrompt: slide.imagePrompt || undefined,
      imageUrl: slide.imageUrl || undefined,
      data: this.ensureDataObject(slide.data) // ✅ FIX: Conversión segura
    }));

    const theme = 'professional';

    const fileUrl = await this.exportService.generatePptxFromExistingSlides(
      slidesData,
      theme,
      userId,
      projectId
    );

    console.log(`✅ PPTX exportado exitosamente: ${fileUrl}`);
    return fileUrl;
  }

  // ✅ Método helper para convertir JsonArray a string[]
  private ensureStringArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.filter(item => typeof item === 'string') as string[];
    }
    return [];
  }

  // ✅ Método helper para convertir JsonValue a Record<string, unknown>
  private ensureDataObject(value: any): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
