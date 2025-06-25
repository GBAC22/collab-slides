import { Controller, Post, Body, Res, UploadedFile, UseInterceptors, UseGuards, Req, Get, Param } from '@nestjs/common';
import { ExportService, SlideData } from './export.service';
import { PlanGuard } from '../plan/plan.guard';
import { JwtGuard } from '../auth/jwt.guard';
import { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioService } from '../minio/minio.service';

@Controller('export')
@UseGuards(JwtGuard, PlanGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly minioService: MinioService
  ) {}

  @Post('generate-pptx')
  async generatePptx(
    @Body() body: { prompt: string; numSlides: number; theme?: string; projectId?: string },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const user: any = req['user'];
    const userId = user?.userId || user?.id || user?.sub;
    if (!userId) {
      return res.status(400).json({ message: 'Usuario no autenticado correctamente' });
    }

    try {
      console.log('✅ ExportController: Generando slides con', body);

      // Validaciones básicas
      if (!body.prompt || body.prompt.trim().length === 0) {
        return res.status(400).json({ message: 'El prompt es requerido' });
      }

      if (!body.numSlides || body.numSlides < 3 || body.numSlides > 25) {
        return res.status(400).json({ message: 'El número de slides debe estar entre 3 y 25' });
      }

      const slides = await this.exportService.generateSlidesWithAI(body.prompt, body.numSlides);
      console.log('✅ Slides generados:', slides.length);

      const url = await this.exportService.generatePptxFromSlides(
        slides,
        body.theme || 'professional',
        userId,
        body.projectId
      );
      console.log('✅ PPTX generado en URL:', url);

      return res.json({ success: true, fileUrl: url });
    } catch (err) {
      console.error('❌ Error en generatePptx:', err);
      return res.status(500).json({ message: err.message || 'Error al generar presentación' });
    }
  }

 @Post('generate-pptx-from-voice')
  @UseInterceptors(FileInterceptor('file'))
  async generatePptxFromVoice(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { theme?: string; projectId?: string },
    @Req() req: Request,
    @Res() res: Response
  ) {
    console.log("📥 Body recibido en generate-pptx-from-voice:", body);
    console.log("📥 Archivo recibido:", file ? `${file.originalname} (${file.size} bytes)` : 'No file');
    console.log("📥 Usuario extraído del token:", req['user']);
    
    const user: any = req['user'];
    const userId = user?.userId || user?.id || user?.sub;
    if (!userId) {
      return res.status(400).json({ message: 'Usuario no autenticado correctamente' });
    }

    if (!file) {
      return res.status(400).json({ message: 'Archivo de audio requerido' });
    }

    try {
      console.log('🎤 Transcribiendo y formateando...');
      const { prompt, numSlides, theme: extractedTheme } = await this.exportService.transcribeAudioAndFormatExtractTheme(file);

      const theme = body.theme || extractedTheme || 'professional';
      const title = `Genera diapositivas sobre ${prompt}`;

      console.log(`⚡ Generando slides: tema: "${prompt}", título: "${title}", slides: ${numSlides}, theme: ${theme}`);
      const slides = await this.exportService.generateSlidesWithAI(prompt, numSlides);

      const url = await this.exportService.generatePptxFromSlides(
        slides,
        theme,
        userId,
        body.projectId
      );

      return res.json({
        success: true,
        fileUrl: url,
        title,
        prompt,
        numSlides,
        theme
      });
    } catch (err) {
      console.error('❌ Error en generatePptxFromVoice:', err);
      return res.status(500).json({ message: err.message || 'Error al generar presentación desde audio' });
    }
  }

  @Post('generate-slides-preview')
  async generateSlidesPreview(
    @Body() body: { prompt: string; numSlides: number },
    @Res() res: Response
  ) {
    try {
      // Validaciones
      if (!body.prompt || body.prompt.trim().length === 0) {
        return res.status(400).json({ message: 'El prompt es requerido' });
      }

      if (!body.numSlides || body.numSlides < 3 || body.numSlides > 25) {
        return res.status(400).json({ message: 'El número de slides debe estar entre 3 y 25' });
      }

      const slides = await this.exportService.generateSlidesWithAI(body.prompt, body.numSlides);
      return res.json({ success: true, slides });
    } catch (err) {
      console.error('❌ Error en generateSlidesPreview:', err);
      return res.status(500).json({ message: err.message || 'Error al generar preview' });
    }
  }

  @Get('available-themes')
  async getAvailableThemes() {
    return {
      success: true,
      themes: [
        { name: 'professional', description: 'Tema profesional con azul corporativo', colors: { primary: '#2E86AB', background: '#FFFFFF' } },
        { name: 'modern', description: 'Diseño moderno con púrpura', colors: { primary: '#6C5CE7', background: '#F8F9FA' } },
        { name: 'corporate', description: 'Estilo corporativo clásico', colors: { primary: '#0984E3', background: '#FFFFFF' } },
        { name: 'creative', description: 'Diseño creativo con colores vibrantes', colors: { primary: '#FD79A8', background: '#FFEAA7' } },
        { name: 'dark', description: 'Tema oscuro elegante', colors: { primary: '#00CEC9', background: '#2D3436' } }
      ]
    };
  }

  @Get('download/:fileName')
  async downloadFile(@Param('fileName') fileName: string, @Res() res: Response) {
    try {
      console.log(`📥 Descargando archivo: ${fileName}`);
      
      // Validar nombre de archivo
      if (!fileName || !fileName.endsWith('.pptx')) {
        return res.status(400).json({ message: 'Nombre de archivo inválido' });
      }

      const stream = await this.minioService.getFileStream('presentations', fileName);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      stream.pipe(res);
      
      console.log(`✅ Descarga iniciada: ${fileName}`);
    } catch (err) {
      console.error(`❌ Error descargando ${fileName}:`, err);
      res.status(404).json({ message: 'Archivo no encontrado' });
    }
  }

  @Get('health')
  async healthCheck() {
    return {
      success: true,
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'ExportService'
    };
  }
}