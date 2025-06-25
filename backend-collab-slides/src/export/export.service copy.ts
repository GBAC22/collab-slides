import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import axios from 'axios';
const PptxGenJS = require('pptxgenjs');
import { MinioService } from '../minio/minio.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as FormData from 'form-data';

export interface SlideData {
  title: string;
  content?: string;
  bulletPoints?: string[];
  slideType: 'title' | 'content' | 'bullets' | 'conclusion' | 'comparison' | 'timeline' | 'stats';
  imagePrompt?: string;
  data?: any; // Para datos específicos como estadísticas, comparaciones, etc.
}

@Injectable()
export class ExportService {
  private openai: OpenAI;

  constructor(
    private readonly minioService: MinioService,
    private readonly prisma: PrismaService
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

 

  async transcribeAudioAndFormatExtractTheme(file: Express.Multer.File): Promise<{ prompt: string, numSlides: number, theme: string }> {
    console.log('🎤 Enviando audio para transcripción real...');

    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname || 'audio.wav',
      contentType: file.mimetype || 'audio/wav'
    });
    formData.append('model', 'whisper-1');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
    }
    );

    const transcript: string = (response.data as any).text || 'Presentación general';
    console.log('✅ Transcripción completada:', transcript);

    // Ejemplo: procesar el texto transcrito
    const prompt = transcript.trim();
    const numSlides = 5;  // Podrías mejorar con análisis NLP
    const theme = 'professional'; // O extraer del texto si lo deseas

    return { prompt, numSlides, theme };
  }





  async generateSlidesWithAI(prompt: string, numSlides: number): Promise<SlideData[]> {
    console.log('🚀 Iniciando generación mejorada de slides con IA...');
    
    // Validaciones
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('El prompt no puede estar vacío');
    }
    if (numSlides < 3 || numSlides > 25) {
      throw new Error('El número de slides debe estar entre 3 y 25');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: `Eres un experto en crear presentaciones profesionales y atractivas. Tu tarea es generar contenido estructurado y de alta calidad para presentaciones PowerPoint.

REGLAS ESTRICTAS:
1. Devuelve ÚNICAMENTE un JSON válido sin texto adicional
2. Cada slide debe tener contenido único y relevante
3. Los títulos deben ser concisos pero descriptivos
4. El contenido debe ser profesional y bien estructurado
5. Las imágenes deben complementar el contenido`
        }, {
          role: 'user',
          content: `Crea una presentación profesional sobre: "${prompt}".

Genera EXACTAMENTE ${numSlides} slides con esta estructura JSON:
[
  {
    "title": "Título específico y atractivo",
    "content": "Contenido principal detallado (2-3 oraciones)",
    "bulletPoints": ["Punto específico 1", "Punto específico 2", "Punto específico 3"],
    "slideType": "title|content|bullets|conclusion|comparison|timeline|stats",
    "imagePrompt": "Descripción específica para imagen profesional",
    "data": {} // Para slides especiales como estadísticas o comparaciones
  }
]

ESTRUCTURA OBLIGATORIA:
- Slide 1: type "title" (introducción del tema)
- Slides 2-${numSlides-1}: mix de "content", "bullets", "comparison", "timeline", "stats" según el contenido
- Slide ${numSlides}: type "conclusion" (resumen y llamada a la acción)

TIPOS DE SLIDE:
- title: Slide de portada con título principal
- content: Contenido narrativo con texto descriptivo
- bullets: Lista de puntos clave (máximo 4 puntos)
- comparison: Comparación entre elementos
- timeline: Línea de tiempo o proceso
- stats: Datos numéricos o estadísticas
- conclusion: Slide final con resumen

REGLAS DE CONTENIDO:
- Títulos: máximo 8 palabras, específicos
- Contenido: 2-3 oraciones claras y concisas
- Bullet points: máximo 4 puntos, cada uno de 5-10 palabras
- ImagePrompt: descripción clara para imagen de negocio profesional
- Evita contenido genérico, sé específico al tema

Responde SOLO con el JSON, sin explicaciones.`
        }],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Respuesta de IA vacía');

      // Limpiar y parsear JSON
      let slides: SlideData[];
      try {
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        slides = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error('❌ JSON inválido:', text);
        throw new Error('La respuesta no es un JSON válido');
      }

      // Validaciones de estructura
      if (!Array.isArray(slides) || slides.length !== numSlides) {
        throw new Error(`Se esperaban ${numSlides} slides, se recibieron ${slides?.length || 0}`);
      }

      // Validar cada slide
      slides.forEach((slide, index) => {
        if (!slide.title || !slide.slideType) {
          throw new Error(`Slide ${index + 1} tiene estructura inválida`);
        }
        if (index === 0 && slide.slideType !== 'title') {
          slide.slideType = 'title'; // Forzar primer slide como título
        }
        if (index === slides.length - 1 && slide.slideType !== 'conclusion') {
          slide.slideType = 'conclusion'; // Forzar último slide como conclusión
        }
      });

      console.log('✅ Slides generados y validados correctamente');
      return slides;

    } catch (error) {
      console.error('Error generando slides:', error);
      // Fallback con slides básicos
      return this.generateFallbackSlides(prompt, numSlides);
    }
  }

  private generateFallbackSlides(prompt: string, numSlides: number): SlideData[] {
    console.log('🔄 Generando slides de fallback...');
    const slides: SlideData[] = [];
    
    // Slide título
    slides.push({
      title: prompt,
      content: `Una presentación profesional sobre ${prompt}`,
      slideType: 'title',
      imagePrompt: `Professional business presentation about ${prompt}`
    });

    // Slides intermedios
    for (let i = 1; i < numSlides - 1; i++) {
      slides.push({
        title: `Punto Clave ${i}`,
        content: `Contenido relevante sobre ${prompt} que aborda aspectos importantes del tema.`,
        bulletPoints: [
          `Aspecto importante ${i}.1`,
          `Característica clave ${i}.2`,
          `Beneficio principal ${i}.3`
        ],
        slideType: i % 2 === 0 ? 'content' : 'bullets',
        imagePrompt: `Business illustration for ${prompt} topic ${i}`
      });
    }

    // Slide conclusión
    slides.push({
      title: 'Conclusiones',
      content: `Resumen de los puntos clave sobre ${prompt} y próximos pasos a seguir.`,
      bulletPoints: [
        'Puntos clave revisados',
        'Objetivos alcanzados',
        'Próximos pasos'
      ],
      slideType: 'conclusion',
      imagePrompt: `Professional conclusion slide for ${prompt}`
    });

    return slides;
  }

  async generateImageWithDALLE(prompt: string): Promise<string> {
    console.log('🎨 Generando imagen con DALL-E:', prompt);
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: `Professional business presentation slide illustration: ${prompt}. Modern, clean, corporate style, minimal design, no text overlay, high quality, suitable for PowerPoint.`,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural',
        n: 1
      });
      
      const url = response.data?.[0]?.url;
      if (!url) throw new Error('No se generó la imagen');
      
      console.log('✅ Imagen generada:', url);
      return url;
    } catch (error) {
      console.warn('⚠️ Error generando imagen, usando placeholder:', error.message);
      return `https://via.placeholder.com/1024x1024/2E86AB/FFFFFF?text=${encodeURIComponent('Business Image')}`;
    }
  }

  async downloadImage(url: string): Promise<Buffer> {
    try {
      const res = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Presentation-Generator/1.0'
        }
      });
      return Buffer.from(res.data as ArrayBuffer);
    } catch (error) {
      console.error('Error descargando imagen:', error.message);
      throw new Error('No se pudo descargar la imagen');
    }
  }

  async generatePptxFromSlides(
    slides: SlideData[],
    theme: string,
    userId: string,
    projectId?: string
  ): Promise<string> {
    if (!userId) throw new Error('El ID del usuario es requerido');
    if (!slides || slides.length === 0) throw new Error('No hay slides para procesar');

    console.log('📊 Generando PPTX mejorado...');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = slides[0]?.title || 'Presentación';
    pptx.subject = 'Presentación generada automáticamente';
    
    const themeConfig = this.getThemeConfig(theme);

    try {
      for (let i = 0; i < slides.length; i++) {
        const slideData = slides[i];
        const slide = pptx.addSlide();
        slide.background = { color: themeConfig.background };

        // Generar imagen si es necesario
        let imgBuf: Buffer | null = null;
        if (slideData.imagePrompt && Math.random() > 0.3) { // 70% de probabilidad de imagen
          try {
            const url = await this.generateImageWithDALLE(slideData.imagePrompt);
            imgBuf = await this.downloadImage(url);
          } catch (err) {
            console.warn(`⚠️ Imagen omitida para slide ${i + 1}:`, err.message);
          }
        }

        // Crear slide según tipo
        switch (slideData.slideType) {
          case 'title':
            this.createTitleSlide(slide, slideData, themeConfig, imgBuf);
            break;
          case 'content':
            this.createContentSlide(slide, slideData, themeConfig, imgBuf);
            break;
          case 'bullets':
            this.createBulletSlide(slide, slideData, themeConfig, imgBuf);
            break;
          case 'comparison':
            this.createComparisonSlide(slide, slideData, themeConfig, imgBuf);
            break;
          case 'timeline':
            this.createTimelineSlide(slide, slideData, themeConfig, imgBuf);
            break;
          case 'stats':
            this.createStatsSlide(slide, slideData, themeConfig, imgBuf);
            break;
          case 'conclusion':
            this.createConclusionSlide(slide, slideData, themeConfig, imgBuf);
            break;
          default:
            this.createContentSlide(slide, slideData, themeConfig, imgBuf);
        }
      }

      const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' });
      const buffer = Buffer.from(new Uint8Array(arrayBuffer as ArrayBuffer));

      // Generar nombre de archivo más descriptivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `presentation-${projectId || 'general'}-${timestamp}.pptx`;
      
      await this.minioService.uploadFile(
        'presentations',
        fileName,
        buffer,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );

      const fileUrl = await this.minioService.getPresignedUrl('presentations', fileName, 86400);
      console.log(`✅ PPTX generado: ${fileName}`);

      // Actualizar proyecto en base de datos
      if (projectId) {
        try {
          await this.prisma.project.update({
            where: { id: projectId },
            data: { 
              pptxUrl: fileUrl,
              updatedAt: new Date()
            }
          });
          console.log(`✅ Proyecto ${projectId} actualizado`);
        } catch (dbError) {
          console.error(`❌ Error actualizando proyecto:`, dbError);
        }
      }

      // Registrar exportación - solo campos que existen en el schema
      await this.prisma.exportLog.create({
        data: { 
          userId,
          createdAt: new Date()
        }
      });

      return fileUrl;

    } catch (error) {
      console.error('Error generando PPTX:', error);
      throw new Error(`Error al generar la presentación: ${error.message}`);
    }
  }

  private getThemeConfig(theme: string) {
    const themes = {
      professional: { 
        background: 'FFFFFF', 
        accent: '2E86AB', 
        titleColor: '2E86AB', 
        textColor: '333333', 
        bulletColor: '2E86AB',
        highlightColor: 'E3F2FD'
      },
      modern: { 
        background: 'F8F9FA', 
        accent: '6C5CE7', 
        titleColor: '2D3436', 
        textColor: '636E72', 
        bulletColor: '6C5CE7',
        highlightColor: 'F3F0FF'
      },
      corporate: { 
        background: 'FFFFFF', 
        accent: '0984E3', 
        titleColor: '2D3436', 
        textColor: '636E72', 
        bulletColor: '0984E3',
        highlightColor: 'E3F2FD'
      },
      creative: { 
        background: 'FFEAA7', 
        accent: 'FD79A8', 
        titleColor: '2D3436', 
        textColor: '636E72', 
        bulletColor: 'FD79A8',
        highlightColor: 'FFE0E6'
      },
      dark: { 
        background: '2D3436', 
        accent: '00CEC9', 
        titleColor: 'FFFFFF', 
        textColor: 'DDDDDD', 
        bulletColor: '00CEC9',
        highlightColor: '636E72'
      }
    };
    return themes[theme] || themes.professional;
  }

  // Métodos mejorados para crear slides

  private createTitleSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
    // Fondo con imagen si existe
    if (imageBuffer) {
      slide.addImage({
        data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        x: 0, y: 0, w: 10, h: 5.625,
        transparency: 25
      });
    }

    // Rectángulo con overlay para legibilidad
    slide.addShape('rect', {
      x: 1, y: 1.5, w: 8, h: 3.5,
      fill: { color: theme.background, transparency: 15 },
      line: { color: theme.accent, width: 2 }
    });

    // Título principal
    slide.addText(slideData.title, {
      x: 1.5, y: 2, w: 7, h: 1.5,
      fontSize: 44, bold: true, color: theme.titleColor,
      align: 'center', valign: 'middle',
      shadow: { type: 'outer', blur: 3, offset: 2, angle: 45, color: '000000', transparency: 20 }
    });

    // Subtítulo/contenido
    if (slideData.content) {
      slide.addText(slideData.content, {
        x: 1.5, y: 3.5, w: 7, h: 1,
        fontSize: 20, color: theme.textColor,
        align: 'center', valign: 'middle'
      });
    }

    // Fecha
    slide.addText(new Date().toLocaleDateString(), {
      x: 8, y: 5, w: 1.5, h: 0.3,
      fontSize: 12, color: theme.textColor,
      align: 'right'
    });
  }

  private createContentSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
    // Título con fondo destacado
    slide.addShape('rect', {
      x: 0, y: 0, w: 10, h: 1,
      fill: { color: theme.accent }
    });

    slide.addText(slideData.title, {
      x: 0.5, y: 0.2, w: 9, h: 0.6,
      fontSize: 28, bold: true, color: 'FFFFFF'
    });

    const hasImage = imageBuffer !== null;
    const contentWidth = hasImage ? 5 : 9;
    const imageX = hasImage ? 5.5 : 0;

    // Imagen si existe
    if (imageBuffer) {
      slide.addImage({
        data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        x: imageX, y: 1.5, w: 4, h: 3,
        rounding: true
      });
    }

    // Contenido principal
    if (slideData.content) {
      slide.addText(slideData.content, {
        x: 0.5, y: 1.5, w: contentWidth, h: 2,
        fontSize: 18, color: theme.textColor,
        lineSpacing: 24, valign: 'top'
      });
    }

    // Bullet points si existen
    if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
      slideData.bulletPoints.forEach((bullet, index) => {
        // Viñeta decorativa
        slide.addShape('ellipse', {
          x: 0.5, y: 3.7 + (index * 0.6), w: 0.15, h: 0.15,
          fill: { color: theme.accent }
        });

        slide.addText(bullet, {
          x: 0.8, y: 3.6 + (index * 0.6), w: contentWidth - 0.3, h: 0.5,
          fontSize: 16, color: theme.textColor
        });
      });
    }
  }

  private createBulletSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
    // Título
    slide.addText(slideData.title, {
      x: 0.5, y: 0.3, w: 9, h: 0.8,
      fontSize: 32, bold: true, color: theme.titleColor
    });

    // Línea decorativa
    slide.addShape('rect', {
      x: 0.5, y: 1.1, w: 9, h: 0.08,
      fill: { color: theme.accent }
    });

    const hasImage = imageBuffer !== null;
    
    if (hasImage) {
      slide.addImage({
        data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        x: 6, y: 1.5, w: 3.5, h: 2.5,
        rounding: true
      });
    }

    // Bullet points mejorados
    if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
      slideData.bulletPoints.forEach((bullet, index) => {
        const yPos = 2 + (index * 0.8);
        
        // Número de punto
        slide.addShape('ellipse', {
          x: 0.5, y: yPos, w: 0.4, h: 0.4,
          fill: { color: theme.accent }
        });

        slide.addText((index + 1).toString(), {
          x: 0.5, y: yPos, w: 0.4, h: 0.4,
          fontSize: 14, bold: true, color: 'FFFFFF',
          align: 'center', valign: 'middle'
        });

        // Texto del punto
        slide.addText(bullet, {
          x: 1.2, y: yPos, w: hasImage ? 4.5 : 8, h: 0.6,
          fontSize: 18, color: theme.textColor,
          valign: 'middle'
        });
      });
    }
  }

  private createComparisonSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
    // Título
    slide.addText(slideData.title, {
      x: 0.5, y: 0.3, w: 9, h: 0.8,
      fontSize: 28, bold: true, color: theme.titleColor
    });

    // Dos columnas de comparación
    const leftItems = slideData.bulletPoints?.slice(0, Math.ceil(slideData.bulletPoints.length / 2)) || [];
    const rightItems = slideData.bulletPoints?.slice(Math.ceil(slideData.bulletPoints.length / 2)) || [];

    // Columna izquierda
    slide.addShape('rect', {
      x: 0.5, y: 1.5, w: 4, h: 3.5,
      fill: { color: theme.highlightColor },
      line: { color: theme.accent, width: 2 }
    });

    leftItems.forEach((item, index) => {
      slide.addText(`✓ ${item}`, {
        x: 0.8, y: 2 + (index * 0.5), w: 3.5, h: 0.4,
        fontSize: 14, color: theme.textColor
      });
    });

    // Columna derecha
    slide.addShape('rect', {
      x: 5.5, y: 1.5, w: 4, h: 3.5,
      fill: { color: theme.highlightColor },
      line: { color: theme.accent, width: 2 }
    });

    rightItems.forEach((item, index) => {
      slide.addText(`✓ ${item}`, {
        x: 5.8, y: 2 + (index * 0.5), w: 3.5, h: 0.4,
        fontSize: 14, color: theme.textColor
      });
    });
  }

  private createTimelineSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
    // Título
    slide.addText(slideData.title, {
      x: 0.5, y: 0.3, w: 9, h: 0.8,
      fontSize: 28, bold: true, color: theme.titleColor
    });

    // Línea de tiempo horizontal
    slide.addShape('rect', {
      x: 1, y: 3, w: 8, h: 0.1,
      fill: { color: theme.accent }
    });

    if (slideData.bulletPoints) {
      const stepWidth = 8 / slideData.bulletPoints.length;
      
      slideData.bulletPoints.forEach((item, index) => {
        const xPos = 1 + (index * stepWidth) + (stepWidth / 2);
        
        // Punto en la línea
        slide.addShape('ellipse', {
          x: xPos - 0.15, y: 2.85, w: 0.3, h: 0.3,
          fill: { color: theme.accent }
        });

        // Texto del paso
        slide.addText(item, {
          x: xPos - 0.75, y: 2.2, w: 1.5, h: 0.5,
          fontSize: 12, color: theme.textColor,
          align: 'center'
        });

        // Número del paso
        slide.addText((index + 1).toString(), {
          x: xPos - 0.15, y: 3.5, w: 0.3, h: 0.3,
          fontSize: 10, bold: true, color: theme.accent,
          align: 'center'
        });
      });
    }
  }

  private createStatsSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
    // Título
    slide.addText(slideData.title, {
      x: 0.5, y: 0.3, w: 9, h: 0.8,
      fontSize: 28, bold: true, color: theme.titleColor
    });

    // Simular estadísticas con los bullet points
    if (slideData.bulletPoints) {
      const statsPerRow = Math.min(3, slideData.bulletPoints.length);
      const statWidth = 8 / statsPerRow;

      slideData.bulletPoints.slice(0, 6).forEach((stat, index) => {
        const row = Math.floor(index / statsPerRow);
        const col = index % statsPerRow;
        const xPos = 1 + (col * statWidth);
        const yPos = 2 + (row * 1.5);

        // Caja de estadística
        slide.addShape('rect', {
          x: xPos, y: yPos, w: statWidth - 0.2, h: 1.2,
          fill: { color: theme.highlightColor },
          line: { color: theme.accent, width: 2 }
        });

        // Número grande (simulado)
        const fakeNumber = Math.floor(Math.random() * 100) + '%';
        slide.addText(fakeNumber, {
          x: xPos, y: yPos + 0.1, w: statWidth - 0.2, h: 0.6,
          fontSize: 36, bold: true, color: theme.accent,
          align: 'center'
        });

        // Descripción
        slide.addText(stat, {
          x: xPos, y: yPos + 0.7, w: statWidth - 0.2, h: 0.4,
          fontSize: 12, color: theme.textColor,
          align: 'center'
        });
      });
    }
  }

  private createConclusionSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
    // Fondo con imagen si existe
    if (imageBuffer) {
      slide.addImage({
        data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        x: 0, y: 0, w: 10, h: 5.625,
        transparency: 35
      });
    }

    // Marco principal
    slide.addShape('rect', {
      x: 1, y: 1, w: 8, h: 4,
      fill: { color: theme.background, transparency: 10 },
      line: { color: theme.accent, width: 4 }
    });

    // Título de conclusión
    slide.addText(slideData.title, {
      x: 1.5, y: 1.5, w: 7, h: 0.8,
      fontSize: 36, bold: true, color: theme.titleColor,
      align: 'center'
    });

    // Contenido principal
    if (slideData.content) {
      slide.addText(slideData.content, {
        x: 1.5, y: 2.5, w: 7, h: 1.5,
        fontSize: 18, color: theme.textColor,
        align: 'center', valign: 'middle'
      });
    }

    // Puntos de acción si existen
    if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
      slideData.bulletPoints.forEach((point, index) => {
        slide.addText(`→ ${point}`, {
          x: 2, y: 4.2 + (index * 0.3), w: 6, h: 0.25,
          fontSize: 14, color: theme.bulletColor,
          align: 'center'
        });
      });
    }

    // Llamada a la acción
    slide.addText('¡Gracias por su atención!', {
      x: 1.5, y: 5.2, w: 7, h: 0.4,
      fontSize: 16, bold: true, color: theme.accent,
      align: 'center'
    });
  }
}