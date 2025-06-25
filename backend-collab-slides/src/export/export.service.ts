import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import axios from 'axios';
const PptxGenJS = require('pptxgenjs');
import { MinioService } from '../minio/minio.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as FormData from 'form-data';
import { Prisma } from '@prisma/client';


export interface SlideData {
  title: string;
  content?: string;
  bulletPoints?: string[];
  slideType: string;
  imagePrompt?: string;
  imageUrl?: string;
  data?: any;
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

 
  private normalizeSlides(slides: SlideData[]): SlideData[] {
    return slides.map((s, i, arr) => {
      // ✅ Preservar TODO el contenido existente
      const normalized = {
        ...s, // Mantener TODO tal como está

        // ✅ Solo completar campos faltantes (no sobreescribir existentes)
        title: s.title || `Slide ${i + 1}`,
        content: s.content !== undefined ? s.content : '',
        bulletPoints: Array.isArray(s.bulletPoints) ? s.bulletPoints : [],
        slideType: s.slideType || (i === 0 ? 'title' : (i === arr.length - 1 ? 'conclusion' : 'content')),
        imagePrompt: s.imagePrompt || undefined, // ✅ No generar nuevo prompt si no existe
        imageUrl: s.imageUrl || undefined,       // ✅ Preservar URL existente
        data: s.data || {},
      };

      console.log(`📋 Slide ${i + 1} normalizado:`, {
        title: normalized.title,
        type: normalized.slideType,
        hasImage: !!normalized.imageUrl,
        bulletCount: normalized.bulletPoints?.length || 0
      });

      return normalized;
    });
  }

  async generatePptxFromExistingSlides(
    slides: SlideData[],
    theme: string,
    userId: string,
    projectId?: string
  ): Promise<string> {
    if (!userId) throw new Error('El ID del usuario es requerido');
    if (!slides || slides.length === 0) throw new Error('No hay slides para procesar');

    console.log('📊 Generando PPTX desde slides existentes (SIN regenerar con IA)...');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = slides[0]?.title || 'Presentación';
    pptx.subject = 'Presentación generada automáticamente';

    const themeConfig = this.getThemeConfig(theme);

    try {
      // ✅ Normalizar slides pero SIN regenerar contenido
      const normalizedSlides = this.normalizeSlides(slides);

      for (let i = 0; i < normalizedSlides.length; i++) {
        const slideData = normalizedSlides[i];
        const slide = pptx.addSlide();
        slide.background = { color: themeConfig.background };

        let imgBuf: Buffer | null = null;

        // ✅ SOLO descargar imagen si ya existe imageUrl (no generar nueva)
        if (slideData.imageUrl) {
          try {
            console.log(`🖼️ Descargando imagen existente para slide ${i + 1}...`);
            imgBuf = await this.downloadImage(slideData.imageUrl);
          } catch (err) {
            console.warn(`⚠️ No se pudo descargar imagen existente para slide ${i + 1}:`, err.message);
          }
        }

        // ✅ Crear slide según su tipo (misma lógica que antes)
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

      // ✅ Generar y subir archivo final
      const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' });
      const buffer = Buffer.from(new Uint8Array(arrayBuffer as ArrayBuffer));

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `presentation-${projectId || 'edited'}-${timestamp}.pptx`;

      await this.minioService.uploadFile(
        'presentations',
        fileName,
        buffer,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );

      const fileUrl = await this.minioService.getPresignedUrl('presentations', fileName, 86400);
      console.log(`✅ PPTX generado desde slides existentes: ${fileName}`);

      // ✅ Actualizar proyecto si existe
      if (projectId) {
        await this.prisma.project.update({
          where: { id: projectId },
          data: {
            pptxUrl: fileUrl,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ URL del PPTX actualizada en proyecto ${projectId}`);
      }

      // ✅ Log de exportación
      await this.prisma.exportLog.create({
        data: {
          userId,
          createdAt: new Date()
        }
      });

      return fileUrl;

    } catch (error) {
      console.error('❌ Error generando PPTX desde slides existentes:', error);
      throw new Error(`Error al generar la presentación: ${error.message}`);
    }
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

    const prompt = transcript.trim();
    let numSlides: number | null = null;
    let theme = 'professional';

    // 🎯 Detectar número de slides dicho explícitamente
    const matchSlides = prompt.match(/(?:de|para)?\s*(\d{1,2})\s*(diapositivas|slides|láminas)/i);
    if (matchSlides) {
      numSlides = parseInt(matchSlides[1], 10);
      console.log(`🎯 Número de slides detectado en el texto: ${numSlides}`);
    }

    // 🤖 Analizar con GPT si falta info
    console.log('🤖 Analizando transcripción con GPT para tema y número de slides...');
    const gptResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente experto en presentaciones. Analiza el texto y responde con un JSON como: { "theme": "business", "numSlides": 5 }'
        },
        {
          role: 'user',
          content: `Texto transcrito: "${prompt}"`
        }
      ],
      temperature: 0.5,
      max_tokens: 100
    });

    const gptContent = gptResponse.choices[0]?.message?.content?.trim() || '';
    console.log('✅ Respuesta GPT análisis:', gptContent);

    // Limpiar el ```json y ``` si vinieran
    const cleanContent = gptContent.replace(/```json\s*/i, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(cleanContent);
      theme = parsed.theme || theme;

      if (numSlides == null && parsed.numSlides) {
        numSlides = parsed.numSlides;
      } else if (numSlides != null) {
        console.log(`🔒 Respetando número de slides detectado: ${numSlides}`);
      }
    } catch (err) {
      console.warn('⚠️ No se pudo parsear JSON de GPT, usando valores por defecto.');
      if (numSlides == null) {
        numSlides = 5;
      }
    }

    if (numSlides == null) {
      numSlides = 5;
    }

    console.log(`📌 Tema detectado: ${theme}, numSlides final: ${numSlides}`);

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
        content: `Eres un experto en crear presentaciones excepcionales sobre CUALQUIER tema. Tu versatilidad te permite adaptar el tono, estilo y contenido según el contexto: desde presentaciones educativas para niños hasta propuestas ejecutivas, desde tutoriales técnicos hasta charlas motivacionales.

PRINCIPIOS UNIVERSALES DE CONTENIDO EXCEPCIONAL:
1. **Relevancia**: Adapta el contenido al tema y audiencia probable
2. **Profundidad Apropiada**: Información detallada sin ser abrumador
3. **Engagement**: Usa datos interesantes, ejemplos, historias o analogías según el tema
4. **Claridad**: Explica conceptos de forma accesible
5. **Valor**: Cada slide debe enseñar, informar, inspirar o entretener

ADAPTACIÓN POR CONTEXTO:
- **Temas Empresariales**: Datos, métricas, ROI, estrategias
- **Temas Educativos**: Conceptos claros, ejemplos, ejercicios
- **Temas Técnicos**: Especificaciones, código, diagramas, tutoriales
- **Temas Creativos**: Inspiración, ejemplos visuales, proceso creativo
- **Temas Personales**: Historias, emociones, conexión humana
- **Temas Científicos**: Datos, investigaciones, explicaciones, descubrimientos
- **Temas Culturales**: Historia, contexto, impacto social
- **Temas de Entretenimiento**: Diversión, curiosidades, elementos interactivos

ESTRUCTURA FLEXIBLE POR TIPO:
- **title**: Gancho principal + contexto que genere interés
- **content**: Información sustancial con el tono apropiado al tema
- **bullets**: Puntos clave con ejemplos, datos o tips prácticos
- **comparison**: Contrastes relevantes (antes/después, opciones, etc.)
- **timeline**: Evolución, pasos, historia o proceso
- **stats**: Números que importen para ese tema específico
- **conclusion**: Cierre memorable con siguiente paso o reflexión`
      }, {
        role: 'user',
        content: `Analiza el siguiente tema y crea una presentación perfectamente adaptada: "${prompt}".

ANÁLISIS CONTEXTUAL:
Primero, identifica:
1. ¿Qué tipo de tema es? (educativo, empresarial, personal, técnico, creativo, etc.)
2. ¿Quién sería la audiencia más probable?
3. ¿Cuál es el objetivo principal? (informar, educar, persuadir, entretener, inspirar)
4. ¿Qué tono sería más apropiado? (formal, casual, técnico, motivacional, divertido)

Genera EXACTAMENTE ${numSlides} slides con esta estructura JSON:
[
  {
    "title": "Título que capture la esencia del tema",
    "content": "Contenido adaptado al contexto (extensión y profundidad según el tema)",
    "bulletPoints": ["Puntos relevantes para este tema específico"],
    "slideType": "title|content|bullets|conclusion|comparison|timeline|stats",
    "imagePrompt": "Descripción visual que complemente perfectamente este contenido",
    "data": {
      "metrics": { "example": "value" }, 
      "facts": ["dato1", "dato2"]
    }
  }
]

GUÍAS DE CONTENIDO POR TIPO DE TEMA:

**Si es EDUCATIVO/TUTORIAL**:
- Explica conceptos de simple a complejo
- Incluye ejemplos prácticos y ejercicios
- Usa analogías para conceptos difíciles
- Añade "¿Sabías que...?" o datos curiosos

**Si es EMPRESARIAL/PROFESIONAL**:
- Incluye métricas y datos de mercado
- Proporciona análisis y recomendaciones
- Muestra ROI y beneficios tangibles
- Sugiere acciones concretas

**Si es TÉCNICO/TECNOLÓGICO**:
- Especificaciones y características detalladas
- Comparaciones técnicas objetivas
- Mejores prácticas y casos de uso
- Código o configuraciones si aplica

**Si es CREATIVO/ARTÍSTICO**:
- Inspiración y ejemplos visuales
- Proceso creativo paso a paso
- Técnicas y herramientas
- Showcase de trabajos o resultados

**Si es PERSONAL/MOTIVACIONAL**:
- Historias y anécdotas relevantes
- Consejos prácticos y aplicables
- Reflexiones y preguntas poderosas
- Elementos de conexión emocional

**Si es CIENTÍFICO/ACADÉMICO**:
- Datos de investigaciones recientes
- Explicaciones de fenómenos
- Aplicaciones prácticas
- Avances y descubrimientos

**Si es CULTURAL/SOCIAL**:
- Contexto histórico y evolución
- Impacto en la sociedad
- Diferentes perspectivas
- Ejemplos contemporáneos

**Si es ENTRETENIMIENTO/HOBBY**:
- Datos divertidos y curiosidades
- Rankings y comparaciones entretenidas
- Comunidad y cultura alrededor del tema
- Tips para principiantes y expertos

EJEMPLOS DE ADAPTACIÓN:

Para "Cómo hacer pizza napolitana":
- Slide 2: Historia y origen (con datos como "La pizza Margherita fue creada en 1889 para la Reina Margherita de Saboya")
- Slide 3: Ingredientes esenciales (con especificaciones como "Harina tipo 00, hidratación 65-70%")
- Slide 4: Proceso paso a paso con tiempos
- Slide 5: Errores comunes y cómo evitarlos

Para "Inteligencia Artificial en 2025":
- Slide 2: Estado actual del mercado (valorado en $184.5B, CAGR 38%)
- Slide 3: Aplicaciones revolucionarias por industria
- Slide 4: Comparación de modelos líderes (GPT vs Claude vs Gemini)
- Slide 5: Implicaciones éticas y regulatorias

Para "Mi viaje a Japón":
- Slide 2: Itinerario día por día con highlights
- Slide 3: Experiencias culturales únicas
- Slide 4: Gastronomía: platos probados y favoritos
- Slide 5: Consejos para futuros viajeros

IMPORTANTE: 
- NO asumas que todo es empresarial
- ADAPTA el lenguaje al tema (técnico para temas técnicos, simple para temas generales)
- INCLUYE elementos que hagan el contenido memorable
- PERSONALIZA según el contexto detectado

Responde SOLO con el JSON, sin explicaciones.`
      }],
      temperature: 0.8,
      max_tokens: 6000,
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

    // Validar y enriquecer cada slide
    slides = slides.map((slide, index) => {
      if (!slide.title || !slide.slideType) {
        throw new Error(`Slide ${index + 1} tiene estructura inválida`);
      }

      // Asegurar tipos correctos para primer y último slide
      if (index === 0) slide.slideType = 'title';
      if (index === slides.length - 1) slide.slideType = 'conclusion';

      // Enriquecer contenido basado en el tema detectado
      slide = this.enhanceSlideByContext(slide, prompt);

      return slide;
    });

    console.log('✅ Slides generados y validados correctamente');
    return slides;

  } catch (error) {
    console.error('Error generando slides:', error);
    // Fallback inteligente que detecta el tipo de tema
    return this.generateSmartFallbackSlides(prompt, numSlides);
  }
}

// Método para enriquecer slides según contexto
private enhanceSlideByContext(slide: SlideData, mainTopic: string): SlideData {
  // Detectar el tipo de tema mediante palabras clave
  const topicType = this.detectTopicType(mainTopic);
  
  // Mejorar image prompt según el tipo de tema
  if (slide.imagePrompt) {
    slide.imagePrompt = this.enhanceImagePromptByTopic(slide.imagePrompt, slide.slideType, topicType);
  }
  
  // Asegurar que bullet points tengan contenido apropiado
  if (slide.bulletPoints && slide.bulletPoints.length < 3) {
    slide.bulletPoints = this.addContextualBullets(slide.bulletPoints, topicType, slide.title);
  }
  
  return slide;
}

// Detectar tipo de tema
private detectTopicType(topic: string): string {
  const lowercaseTopic = topic.toLowerCase();
  
  const patterns = {
    business: /estrategia|mercado|ventas|marketing|empresa|negocio|roi|kpi|revenue|profit/i,
    technical: /código|programación|software|api|base de datos|algoritmo|framework|deploy|git/i,
    educational: /aprender|curso|tutorial|cómo|enseñar|estudiante|lección|explicar/i,
    creative: /diseño|arte|creatividad|música|fotografía|video|ilustración|estilo/i,
    scientific: /ciencia|investigación|estudio|experimento|teoría|hipótesis|análisis/i,
    personal: /vida|experiencia|viaje|historia personal|familia|motivación|superación/i,
    entertainment: /juego|película|serie|hobby|diversión|entretenimiento|deporte/i,
    food: /cocina|receta|comida|gastronomía|ingrediente|plato|restaurante/i,
    health: /salud|ejercicio|nutrición|bienestar|medicina|fitness|mental|físico/i
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(lowercaseTopic)) {
      return type;
    }
  }
  
  return 'general';
}

// Mejorar image prompts según el tipo de tema
private enhanceImagePromptByTopic(originalPrompt: string, slideType: string, topicType: string): string {
  const topicStyles = {
    business: 'Professional corporate photography, modern office environment, clean minimalist design',
    technical: 'Tech-inspired visualization, code snippets, terminal windows, circuit patterns, dark theme',
    educational: 'Bright educational illustrations, friendly icons, chalkboard elements, learning materials',
    creative: 'Artistic composition, vibrant colors, creative tools, inspiring workspace, artistic elements',
    scientific: 'Laboratory equipment, scientific diagrams, molecular structures, research environment',
    personal: 'Warm personal photography, emotional moments, journey metaphors, authentic human connections',
    entertainment: 'Fun and dynamic visuals, bright colors, action shots, entertainment venues',
    food: 'Delicious food photography, ingredients showcase, cooking process, restaurant ambiance',
    health: 'Wellness imagery, active lifestyle, healthy choices, medical illustrations when appropriate',
    general: 'Versatile modern design, balanced composition, appropriate metaphorical imagery'
  };
  
  const style = topicStyles[topicType] || topicStyles['general'];
  
  return `${originalPrompt}. Style: ${style}, high quality, no text overlays, appropriate for ${slideType} slide`;
}

// Añadir bullets contextuales según el tipo
private addContextualBullets(existing: string[], topicType: string, slideTitle: string): string[] {
  const bullets = [...existing];
  const needed = 3 - bullets.length;
  
  const contextualBullets = {
    business: [
      'Análisis de mercado indica crecimiento sostenido del 15% anual',
      'Implementación reduce costos operativos en 30%',
      'ROI proyectado supera expectativas del sector'
    ],
    technical: [
      'Compatible con las últimas versiones y estándares',
      'Performance optimizado con tiempo de respuesta < 100ms',
      'Documentación completa y comunidad activa de soporte'
    ],
    educational: [
      'Método probado con 95% de satisfacción estudiantil',
      'Ejercicios prácticos para reforzar el aprendizaje',
      'Recursos adicionales disponibles para profundizar'
    ],
    creative: [
      'Técnica que potencia la expresión personal única',
      'Inspirado en tendencias contemporáneas y clásicas',
      'Portfolio de ejemplos para diferentes estilos'
    ],
    scientific: [
      'Respaldado por estudios peer-reviewed recientes',
      'Metodología replicable y resultados consistentes',
      'Aplicaciones prácticas en múltiples campos'
    ],
    personal: [
      'Lecciones aprendidas que transforman perspectivas',
      'Momentos clave que definen el journey personal',
      'Consejos prácticos basados en experiencia real'
    ],
    food: [
      'Ingredientes frescos marcan la diferencia en sabor',
      'Tiempo de preparación: 30 minutos activos',
      'Variaciones para diferentes preferencias dietéticas'
    ],
    general: [
      'Punto clave que añade valor significativo',
      'Aspecto importante a considerar en la implementación',
      'Beneficio comprobado por múltiples fuentes'
    ]
  };
  
  const bulletsToAdd = contextualBullets[topicType] || contextualBullets['general'];
  
  for (let i = 0; i < needed && i < bulletsToAdd.length; i++) {
    bullets.push(bulletsToAdd[i]);
  }
  
  return bullets;
}

// Fallback inteligente que se adapta al tema
private generateSmartFallbackSlides(prompt: string, numSlides: number): SlideData[] {
  console.log('🔄 Generando slides de fallback adaptados al tema...');
  const slides: SlideData[] = [];
  const topicType = this.detectTopicType(prompt);
  
  // Slide título adaptado
  slides.push({
    title: prompt,
    content: this.getAdaptiveIntroContent(prompt, topicType),
    slideType: 'title',
    imagePrompt: this.getAdaptiveTitleImage(prompt, topicType)
  });

  // Generar slides intermedios según el tipo de tema
  const templates = this.getTemplatesByTopicType(topicType, prompt);
  
  for (let i = 1; i < numSlides - 1; i++) {
    const template = templates[Math.min(i - 1, templates.length - 1)];
    slides.push(this.createSlideFromTemplate(template, prompt, i));
  }

  // Slide conclusión adaptado
  slides.push({
    title: this.getAdaptiveConclusionTitle(topicType),
    content: this.getAdaptiveConclusionContent(prompt, topicType),
    bulletPoints: this.getAdaptiveConclusionBullets(topicType),
    slideType: 'conclusion',
    imagePrompt: this.getAdaptiveConclusionImage(prompt, topicType)
  });

  return slides;
}

// Métodos auxiliares para generar contenido adaptativo
private getAdaptiveIntroContent(topic: string, topicType: string): string {
  const intros = {
    business: `Una exploración estratégica sobre ${topic}, analizando oportunidades de mercado, mejores prácticas de la industria, y caminos hacia el crecimiento sostenible. Descubra insights accionables y estrategias probadas para maximizar resultados.`,
    technical: `Guía completa sobre ${topic}, cubriendo conceptos fundamentales, implementación práctica, y mejores prácticas de la industria. Desde los básicos hasta técnicas avanzadas para dominar esta tecnología.`,
    educational: `Aprenda todo sobre ${topic} de manera clara y estructurada. Este contenido está diseñado para facilitar la comprensión, con ejemplos prácticos y explicaciones paso a paso que harán el aprendizaje efectivo y entretenido.`,
    creative: `Explore el fascinante mundo de ${topic}, donde la creatividad no tiene límites. Descubra técnicas, inspiración y herramientas para desarrollar su potencial creativo y crear obras únicas y memorables.`,
    scientific: `Investigación y análisis profundo sobre ${topic}, basado en evidencia científica actual y descubrimientos recientes. Comprenda los principios fundamentales y sus aplicaciones prácticas en el mundo real.`,
    personal: `Un viaje personal a través de ${topic}, compartiendo experiencias, aprendizajes y momentos que marcan la diferencia. Historias reales que inspiran y enseñan lecciones valiosas para la vida.`,
    food: `Descubra los secretos de ${topic}, desde técnicas profesionales hasta tips caseros. Una guía completa para dominar sabores, texturas y presentaciones que deleitarán a todos.`,
    general: `Todo lo que necesita saber sobre ${topic}, presentado de forma clara y accesible. Información completa, ejemplos prácticos y recursos útiles para dominar este tema.`
  };
  
  return intros[topicType] || intros['general'];
}

private getTemplatesByTopicType(topicType: string, topic: string): any[] {
  const templateSets = {
    business: [
      {
        title: 'Análisis de Mercado y Oportunidades',
        type: 'content',
        bullets: [
          'Mercado valorado en $XX billones con crecimiento anual del 15%',
          'Principales players capturan solo el 40% del mercado total',
          'Oportunidad de diferenciación en nichos específicos'
        ]
      },
      {
        title: 'Estrategia de Implementación',
        type: 'bullets',
        bullets: [
          'Fase 1: Análisis y planificación (30 días)',
          'Fase 2: Piloto con métricas definidas (60 días)',
          'Fase 3: Rollout y optimización continua'
        ]
      },
      {
        title: 'ROI y Métricas de Éxito',
        type: 'stats',
        bullets: [
          'ROI esperado: 250% en 18 meses',
          'Reducción de costos: 35%',
          'Incremento en satisfacción: +40 puntos NPS'
        ]
      }
    ],
    technical: [
      {
        title: 'Arquitectura y Componentes',
        type: 'content',
        bullets: [
          'Arquitectura modular y escalable',
          'APIs RESTful con documentación OpenAPI',
          'Compatibilidad con principales frameworks'
        ]
      },
      {
        title: 'Implementación Paso a Paso',
        type: 'timeline',
        bullets: [
          'Setup inicial y configuración del entorno',
          'Desarrollo de funcionalidades core',
          'Testing y optimización de performance',
          'Deployment y monitoreo'
        ]
      },
      {
        title: 'Best Practices y Optimización',
        type: 'bullets',
        bullets: [
          'Utilizar patrones de diseño apropiados',
          'Implementar tests con cobertura > 80%',
          'Monitoreo continuo de performance'
        ]
      }
    ],
    educational: [
      {
        title: 'Conceptos Fundamentales',
        type: 'content',
        bullets: [
          'Definición clara y ejemplos prácticos',
          'Aplicaciones en la vida real',
          'Ejercicios para practicar'
        ]
      },
      {
        title: 'Proceso de Aprendizaje',
        type: 'timeline',
        bullets: [
          'Comprensión de conceptos básicos',
          'Práctica con ejercicios guiados',
          'Aplicación en proyectos reales',
          'Evaluación y mejora continua'
        ]
      },
      {
        title: 'Recursos y Herramientas',
        type: 'bullets',
        bullets: [
          'Material de lectura recomendado',
          'Videos tutoriales complementarios',
          'Comunidad de aprendizaje activa'
        ]
      }
    ],
    creative: [
      {
        title: 'Inspiración y Referencias',
        type: 'content',
        bullets: [
          'Grandes maestros y sus técnicas',
          'Tendencias actuales y emergentes',
          'Fuentes de inspiración diaria'
        ]
      },
      {
        title: 'Proceso Creativo',
        type: 'timeline',
        bullets: [
          'Brainstorming y conceptualización',
          'Bocetos y experimentación',
          'Desarrollo y refinamiento',
          'Presentación final'
        ]
      },
      {
        title: 'Herramientas y Técnicas',
        type: 'bullets',
        bullets: [
          'Software y aplicaciones recomendadas',
          'Técnicas tradicionales vs digitales',
          'Tips de profesionales'
        ]
      }
    ],
    default: [
      {
        title: `Aspectos Clave de ${topic}`,
        type: 'content',
        bullets: [
          'Punto fundamental #1',
          'Punto fundamental #2',
          'Punto fundamental #3'
        ]
      },
      {
        title: 'Desarrollo y Evolución',
        type: 'timeline',
        bullets: [
          'Origen y contexto inicial',
          'Desarrollo y crecimiento',
          'Estado actual',
          'Futuro y tendencias'
        ]
      },
      {
        title: 'Aplicaciones Prácticas',
        type: 'bullets',
        bullets: [
          'Uso en contexto profesional',
          'Aplicaciones personales',
          'Beneficios comprobados'
        ]
      }
    ]
  };
  
  return templateSets[topicType] || templateSets['default'];
}

private createSlideFromTemplate(template: any, topic: string, index: number): SlideData {
  return {
    title: template.title,
    content: `Información detallada sobre ${template.title.toLowerCase()} en el contexto de ${topic}. ${
      template.type === 'content' 
        ? 'Este aspecto es fundamental para comprender completamente el tema y sus implicaciones.'
        : ''
    }`,
    bulletPoints: template.bullets,
    slideType: template.type,
    imagePrompt: `Visual representation of ${template.title} for ${topic}, professional and engaging`,
    data: template.data || {}
  };
}

private getAdaptiveConclusionTitle(topicType: string): string {
  const titles = {
    business: 'Próximos Pasos y Plan de Acción',
    technical: 'Conclusiones y Recomendaciones Técnicas',
    educational: 'Resumen y Recursos para Continuar Aprendiendo',
    creative: 'Inspiración Final y Call to Action Creativo',
    scientific: 'Conclusiones y Futuras Investigaciones',
    personal: 'Reflexiones Finales y Mensaje Principal',
    food: 'Tips Finales y Variaciones a Explorar',
    general: 'Conclusiones y Puntos Clave'
  };
  
  return titles[topicType] || titles['general'];
}

private getAdaptiveConclusionContent(topic: string, topicType: string): string {
  const contents = {
    business: `La oportunidad en ${topic} es clara y el momento de actuar es ahora. Con la estrategia correcta y ejecución disciplinada, los resultados superarán las expectativas.`,
    technical: `Dominar ${topic} requiere práctica constante y actualización continua. Los conceptos presentados sientan las bases para un desarrollo profesional sólido.`,
    educational: `El viaje de aprendizaje en ${topic} continúa más allá de esta presentación. Con los fundamentos claros, el siguiente paso es la aplicación práctica.`,
    creative: `${topic} ofrece infinitas posibilidades creativas. Lo importante es comenzar, experimentar y encontrar tu voz única en este medio.`,
    scientific: `La investigación en ${topic} continúa evolucionando. Los principios presentados proporcionan una base sólida para exploración futura.`,
    personal: `Las experiencias compartidas sobre ${topic} son solo el comienzo. Cada persona puede encontrar su propio camino y crear su historia única.`,
    food: `Con estos conocimientos sobre ${topic}, está listo para experimentar y crear sus propias versiones. ¡Que disfrute el proceso!`,
    general: `${topic} ofrece numerosas oportunidades de aplicación y desarrollo. Los conceptos clave presentados son el punto de partida para mayor exploración.`
  };
  
  return contents[topicType] || contents['general'];
}

private getAdaptiveConclusionBullets(topicType: string): string[] {
  const bullets = {
    business: [
      'Definir KPIs y métricas de seguimiento',
      'Asignar recursos y responsables',
      'Iniciar fase piloto en 30 días',
      'Revisar y ajustar estrategia trimestralmente'
    ],
    technical: [
      'Practicar con proyectos personales',
      'Contribuir a proyectos open source',
      'Mantenerse actualizado con la documentación',
      'Unirse a comunidades técnicas'
    ],
    educational: [
      'Repasar conceptos clave regularmente',
      'Aplicar lo aprendido en situaciones reales',
      'Buscar recursos adicionales de aprendizaje',
      'Compartir conocimiento con otros'
    ],
    creative: [
      'Crear un proyecto personal esta semana',
      'Experimentar con diferentes estilos',
      'Buscar feedback constructivo',
      'Construir un portfolio'
    ],
    general: [
      'Aplicar los conceptos aprendidos',
      'Profundizar en áreas de interés',
      'Compartir y discutir con otros',
      'Evaluar resultados y mejorar'
    ]
  };
  
  return bullets[topicType] || bullets['general'];
}

private getAdaptiveTitleImage(topic: string, topicType: string): string {
  const images = {
    business: `Modern business environment with professionals collaborating, data visualizations, growth charts, representing ${topic}`,
    technical: `High-tech workspace with multiple monitors showing code, diagrams, and technical interfaces related to ${topic}`,
    educational: `Bright educational setting with learning materials, books, digital devices, and engaged students exploring ${topic}`,
    creative: `Artistic workspace with creative tools, color palettes, inspirational mood boards related to ${topic}`,
    scientific: `Modern laboratory or research facility with scientific equipment and data visualizations for ${topic}`,
    personal: `Warm, authentic photography capturing human moments and emotions related to ${topic}`,
    food: `Beautiful culinary presentation showcasing ingredients, cooking process, or final dishes for ${topic}`,
    general: `Professional, versatile imagery that captures the essence of ${topic} in an engaging way`
  };
  
  return images[topicType] || images['general'];
}

private getAdaptiveConclusionImage(topic: string, topicType: string): string {
  const images = {
    business: `Successful team celebrating achievements, growth graphs, future vision board for ${topic}`,
    technical: `Deployed successful project, clean code on screens, satisfied development team for ${topic}`,
    educational: `Students successfully applying knowledge, graduation celebration, bright future ahead in ${topic}`,
    creative: `Gallery showcase, finished creative works, artist with their portfolio related to ${topic}`,
    scientific: `Research breakthrough visualization, scientists collaborating, future implications of ${topic}`,
    personal: `Inspiring sunrise/sunset, person achieving goals, transformation journey related to ${topic}`,
    food: `Beautifully plated final dish, satisfied diners, chef's pride in ${topic} creation`,
    general: `Inspiring imagery of success, completion, and future possibilities related to ${topic}`
  };
  
  return images[topicType] || images['general'];
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

      let imgBuf: Buffer | null = null;
      if (slideData.imagePrompt && Math.random() > 0.3) {
        try {
          const url = await this.generateImageWithDALLE(slideData.imagePrompt);
          slideData.imageUrl = url;

          imgBuf = await this.downloadImage(url);

          const imageFileName = `images/slide-${i + 1}-${Date.now()}.png`;
          await this.minioService.uploadFile(
            'presentations',
            imageFileName,
            imgBuf,
            'image/png'
          );
          const presignedImageUrl = await this.minioService.getPresignedUrl('presentations', imageFileName, 86400);
          slideData.imageUrl = presignedImageUrl;

        } catch (err) {
          console.warn(`⚠️ Imagen omitida para slide ${i + 1}:`, err.message);
        }
      }

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

    if (projectId) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          pptxUrl: fileUrl,
          updatedAt: new Date(),
        },
      });

      await this.prisma.slide.createMany({
        data: slides.map((slideData) => ({
          projectId,
          title: slideData.title,
          content: slideData.content || '',
          bulletPoints: slideData.bulletPoints && slideData.bulletPoints.length > 0 
            ? slideData.bulletPoints 
            : undefined,
          slideType: slideData.slideType,
          imagePrompt: slideData.imagePrompt || undefined,
          imageUrl: slideData.imageUrl || undefined,
          data: slideData.data && Object.keys(slideData.data).length > 0 
            ? slideData.data 
            : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      });

      console.log(`✅ Slides guardados en DB para proyecto ${projectId}`);
    }

    await this.prisma.exportLog.create({
      data: {
        userId,
        createdAt: new Date()
      }
    });

    return fileUrl;

  } catch (error) {
    console.error('❌ Error generando PPTX:', error);
    throw new Error(`Error al generar la presentación: ${error.message}`);
  }
}

private getThemeConfig(theme: string) {
  // ✅ Colores exactos que coinciden con SlidePreview.tsx
  const themes = {
    professional: { 
      background: 'FFFFFF', 
      accent: '3B82F6',        // blue-600 del CSS
      titleColor: '1E40AF',    // blue-800 del CSS  
      textColor: '374151',     // gray-700 del CSS
      bulletColor: '3B82F6',   // blue-600 del CSS
      highlightColor: 'F3F4F6', // gray-100 del CSS
      // ✅ Nuevos colores para gradientes
      gradientStart: 'DBEAFE', // blue-50
      gradientEnd: 'BFDBFE',   // blue-100
      borderColor: '3B82F6'    // blue-600
    },
    // ... otros temas iguales
  };
  return themes[theme] || themes.professional;
}

// ✅ SLIDE TÍTULO - SIN SUPERPOSICIONES
private createTitleSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
  // ✅ Fondo gradiente
  slide.addShape('rect', {
    x: 0, y: 0, w: 10, h: 5.625,
    fill: { 
      type: 'gradient',
      angle: 135,
      stops: [
        { position: 0, color: 'DBEAFE' }, // blue-50
        { position: 100, color: 'BFDBFE' }  // blue-100
      ]
    }
  });

  // ✅ Imagen de fondo si existe
  if (imageBuffer) {
    slide.addImage({
      data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
      x: 0, y: 0, w: 10, h: 5.625,
      transparency: 80
    });
  }
  
  // ✅ Contenedor principal
  slide.addShape('rect', {
    x: 1, y: 1.2, w: 8, h: 3.2,
    fill: { color: 'FFFFFF', transparency: 10 },
    line: { color: 'E5E7EB', width: 1 },
    rounding: 12
  });

  // ✅ SOLO EL TÍTULO - Sin superposiciones
  slide.addText(slideData.title, {
    x: 1.5, y: 1.8, w: 7, h: 1.2,
    fontSize: 44,
    bold: true, 
    color: '1E40AF',
    align: 'center', 
    valign: 'middle',
    fontFace: 'Arial'
  });

  // ✅ SOLO EL CONTENIDO - Posición separada
  if (slideData.content) {
    slide.addText(slideData.content, {
      x: 1.5, y: 3.1, w: 7, h: 1,
      fontSize: 18,
      color: '374151',
      align: 'center', 
      valign: 'middle',
      fontFace: 'Arial'
    });
  }

  // ✅ SOLO LA FECHA - Posición inferior
  slide.addText(new Date().toLocaleDateString(), {
    x: 7, y: 5, w: 2.5, h: 0.3,
    fontSize: 12,
    color: '6B7280',
    align: 'right',
    fontFace: 'Arial'
  });
}

// ✅ SLIDE CONTENIDO - SIN SUPERPOSICIONES  
private createContentSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
  // ✅ Header azul
  slide.addShape('rect', {
    x: 0, y: 0, w: 10, h: 1,
    fill: { color: '2563EB' }
  });

  // ✅ SOLO EL TÍTULO en header
  slide.addText(slideData.title, {
    x: 0.5, y: 0.2, w: 9, h: 0.6,
    fontSize: 28,
    bold: true, 
    color: 'FFFFFF',
    valign: 'middle',
    fontFace: 'Arial'
  });

  const hasImage = imageBuffer !== null;
  const contentWidth = hasImage ? 5 : 9;
  
  // ✅ SOLO LA IMAGEN si existe
  if (hasImage) {
    slide.addImage({
      data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
      x: 5.5, y: 1.2, w: 4, h: 2.5,
      rounding: 8
    });
  }

  let currentY = 1.2;

  // ✅ SOLO EL CONTENIDO - Si existe
  if (slideData.content) {
    slide.addText(slideData.content, {
      x: 0.5, y: currentY, w: contentWidth, h: 1.2,
      fontSize: 16,
      color: '374151',
      lineSpacing: 20,
      valign: 'top',
      fontFace: 'Arial'
    });
    currentY += 1.4; // Incrementar posición Y
  }

  // ✅ SOLO LOS BULLET POINTS - Si existen y posición separada
  if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
    slideData.bulletPoints.forEach((bullet, index) => {
      const yPos = currentY + (index * 0.4);
      
      // Punto circular
      slide.addShape('ellipse', {
        x: 0.5, y: yPos + 0.1, w: 0.15, h: 0.15,
        fill: { color: '2563EB' }
      });

      // Texto del bullet
      slide.addText(bullet, {
        x: 0.8, y: yPos, w: contentWidth - 0.3, h: 0.35,
        fontSize: 14,
        color: '374151',
        valign: 'middle',
        fontFace: 'Arial'
      });
    });
  }
}

// ✅ SLIDE BULLETS - Coincide con BulletSlideContent
private createBulletSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
  // ✅ Título (text-4xl font-bold text-gray-800)
  slide.addText(slideData.title, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 36, // text-4xl
    bold: true, 
    color: '1F2937', // text-gray-800
    fontFace: 'Arial'
  });

  // ✅ Línea decorativa azul (w-full h-1 bg-blue-600)
  slide.addShape('rect', {
    x: 0.5, y: 1, w: 9, h: 0.08,
    fill: { color: '2563EB' } // bg-blue-600
  });

  const hasImage = imageBuffer !== null;
  
  // ✅ Imagen (w-2/5)
  if (hasImage) {
    slide.addImage({
      data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
      x: 6, y: 1.5, w: 3.5, h: 2.5,
      rounding: 8 // rounded-lg
    });
  }

  // ✅ Bullet points con números (space-y-6)
  if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
    slideData.bulletPoints.forEach((bullet, index) => {
      const yPos = 1.8 + (index * 0.8); // space-y-6 simulado
      
      // ✅ Círculo con número (w-8 h-8 bg-blue-600 text-white rounded-full)
      slide.addShape('ellipse', {
        x: 0.5, y: yPos, w: 0.5, h: 0.5,
        fill: { color: '2563EB' } // bg-blue-600
      });

      // ✅ Número en círculo (font-bold text-white)
      slide.addText((index + 1).toString(), {
        x: 0.5, y: yPos, w: 0.5, h: 0.5,
        fontSize: 16,
        bold: true, 
        color: 'FFFFFF',
        align: 'center', 
        valign: 'middle',
        fontFace: 'Arial'
      });

      // ✅ Texto del punto (text-xl text-gray-700)
      slide.addText(bullet, {
        x: 1.2, y: yPos + 0.05, w: hasImage ? 4.5 : 8, h: 0.6,
        fontSize: 20, // text-xl
        color: '374151', // text-gray-700
        valign: 'middle',
        fontFace: 'Arial'
      });
    });
  }
}

// ✅ SLIDE COMPARACIÓN - Coincide con ComparisonSlideContent
private createComparisonSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
  // ✅ Título centrado (text-3xl font-bold text-gray-800)
  slide.addText(slideData.title, {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 30, // text-3xl
    bold: true, 
    color: '1F2937', // text-gray-800
    align: 'center',
    fontFace: 'Arial'
  });

  const bullets = slideData.bulletPoints || [];
  const leftItems = bullets.slice(0, Math.ceil(bullets.length / 2));
  const rightItems = bullets.slice(Math.ceil(bullets.length / 2));

  // ✅ Columna izquierda (w-1/2 bg-blue-50 border-2 border-blue-600 rounded-lg)
  slide.addShape('rect', {
    x: 0.5, y: 1.5, w: 4, h: 3.5,
    fill: { color: 'EFF6FF' }, // bg-blue-50
    line: { color: '2563EB', width: 2 }, // border-2 border-blue-600
    rounding: 8 // rounded-lg
  });

  leftItems.forEach((item, index) => {
    // ✅ Checkmark verde (text-green-600)
    slide.addText('✓', {
      x: 0.8, y: 2 + (index * 0.4), w: 0.3, h: 0.3,
      fontSize: 18,
      color: '059669', // text-green-600
      fontFace: 'Arial'
    });

    // ✅ Texto (text-gray-700)
    slide.addText(item, {
      x: 1.1, y: 2 + (index * 0.4), w: 3.2, h: 0.3,
      fontSize: 14,
      color: '374151', // text-gray-700
      valign: 'middle',
      fontFace: 'Arial'
    });
  });

  // ✅ Columna derecha (igual que izquierda)
  slide.addShape('rect', {
    x: 5.5, y: 1.5, w: 4, h: 3.5,
    fill: { color: 'EFF6FF' }, // bg-blue-50
    line: { color: '2563EB', width: 2 }, // border-2 border-blue-600
    rounding: 8 // rounded-lg
  });

  rightItems.forEach((item, index) => {
    slide.addText('✓', {
      x: 5.8, y: 2 + (index * 0.4), w: 0.3, h: 0.3,
      fontSize: 18,
      color: '059669', // text-green-600
      fontFace: 'Arial'
    });

    slide.addText(item, {
      x: 6.1, y: 2 + (index * 0.4), w: 3.2, h: 0.3,
      fontSize: 14,
      color: '374151', // text-gray-700
      valign: 'middle',
      fontFace: 'Arial'
    });
  });
}

// ✅ SLIDE TIMELINE - Coincide con TimelineSlideContent
private createTimelineSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
  // ✅ Título centrado (text-3xl font-bold text-gray-800)
  slide.addText(slideData.title, {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 30, // text-3xl
    bold: true, 
    color: '1F2937', // text-gray-800
    align: 'center',
    fontFace: 'Arial'
  });

  if (!slideData.bulletPoints || slideData.bulletPoints.length === 0) return;

  const bullets = slideData.bulletPoints;
  const stepWidth = 8 / bullets.length;

  // ✅ Línea horizontal azul (w-full h-1 bg-blue-600)
  slide.addShape('rect', {
    x: 1, y: 3, w: 8, h: 0.08,
    fill: { color: '2563EB' } // bg-blue-600
  });

  bullets.forEach((item, index) => {
    const xPos = 1 + (index * stepWidth) + (stepWidth / 2);
    
    // ✅ Punto en la línea (w-6 h-6 bg-blue-600 rounded-full)
    slide.addShape('ellipse', {
      x: xPos - 0.15, y: 2.85, w: 0.3, h: 0.3,
      fill: { color: '2563EB' } // bg-blue-600
    });

    // ✅ Texto del paso arriba (text-sm text-gray-700)
    slide.addText(item, {
      x: xPos - 0.75, y: 2.2, w: 1.5, h: 0.5,
      fontSize: 12, // text-sm
      color: '374151', // text-gray-700
      align: 'center',
      fontFace: 'Arial'
    });

    // ✅ Número del paso abajo (text-xs font-bold text-blue-600)
    slide.addText(`Paso ${index + 1}`, {
      x: xPos - 0.5, y: 3.5, w: 1, h: 0.3,
      fontSize: 10, // text-xs
      bold: true, 
      color: '2563EB', // text-blue-600
      align: 'center',
      fontFace: 'Arial'
    });
  });
}

// ✅ SLIDE STATS - Coincide con StatsSlideContent
private createStatsSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
  // ✅ Título centrado (text-3xl font-bold text-gray-800)
  slide.addText(slideData.title, {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 30, // text-3xl
    bold: true, 
    color: '1F2937', // text-gray-800
    align: 'center',
    fontFace: 'Arial'
  });

  if (!slideData.bulletPoints || slideData.bulletPoints.length === 0) return;

  const bullets = slideData.bulletPoints.slice(0, 6); // máximo 6
  const cols = Math.min(3, bullets.length);
  const statWidth = 8 / cols;

  bullets.forEach((stat, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const xPos = 1 + (col * statWidth);
    const yPos = 2 + (row * 1.8);

    // ✅ Caja de estadística (bg-purple-50 border-2 border-purple-600 rounded-lg)
    slide.addShape('rect', {
      x: xPos, y: yPos, w: statWidth - 0.2, h: 1.5,
      fill: { color: 'FAF5FF' }, // bg-purple-50
      line: { color: '9333EA', width: 2 }, // border-2 border-purple-600
      rounding: 8 // rounded-lg
    });

    // ✅ Número grande (text-4xl font-bold text-purple-600)
    const fakeNumber = Math.floor(Math.random() * 100) + '%';
    slide.addText(fakeNumber, {
      x: xPos, y: yPos + 0.2, w: statWidth - 0.2, h: 0.8,
      fontSize: 36, // text-4xl
      bold: true, 
      color: '9333EA', // text-purple-600
      align: 'center',
      valign: 'middle',
      fontFace: 'Arial'
    });

    // ✅ Descripción (text-sm text-gray-700)
    slide.addText(stat, {
      x: xPos, y: yPos + 1, w: statWidth - 0.2, h: 0.4,
      fontSize: 12, // text-sm
      color: '374151', // text-gray-700
      align: 'center',
      valign: 'middle',
      fontFace: 'Arial'
    });
  });
}

// ✅ SLIDE CONCLUSIÓN - SIN SUPERPOSICIONES
private createConclusionSlide(slide: any, slideData: SlideData, theme: any, imageBuffer: Buffer | null) {
  // ✅ Fondo gradiente verde
  slide.addShape('rect', {
    x: 0, y: 0, w: 10, h: 5.625,
    fill: { 
      type: 'gradient',
      angle: 135,
      stops: [
        { position: 0, color: 'F0FDF4' }, // green-50
        { position: 100, color: 'DCFCE7' }  // green-100
      ]
    }
  });

  // ✅ Imagen de fondo si existe
  if (imageBuffer) {
    slide.addImage({
      data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
      x: 0, y: 0, w: 10, h: 5.625,
      transparency: 75
    });
  }
  
  // ✅ Contenedor principal - MÁS GRANDE
  slide.addShape('rect', {
    x: 0.5, y: 0.5, w: 9, h: 4.5,
    fill: { color: 'FFFFFF', transparency: 5 },
    line: { color: '059669', width: 4 },
    rounding: 12
  });

  // ✅ SOLO EL TÍTULO - Posición fija
  slide.addText(slideData.title, {
    x: 1, y: 0.8, w: 8, h: 0.8,
    fontSize: 32,
    bold: true, 
    color: '166534',
    align: 'center',
    valign: 'middle',
    fontFace: 'Arial'
  });

  // ✅ SOLO EL CONTENIDO - Separado del título
  if (slideData.content) {
    slide.addText(slideData.content, {
      x: 1, y: 1.8, w: 8, h: 1.2,
      fontSize: 16,
      color: '374151',
      align: 'center', 
      valign: 'top',
      fontFace: 'Arial'
    });
  }

  // ✅ SOLO LOS BULLET POINTS - Posición separada
  if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
    slideData.bulletPoints.forEach((point, index) => {
      slide.addText(`→ ${point}`, {
        x: 1.5, y: 3.2 + (index * 0.3), w: 7, h: 0.25,
        fontSize: 14,
        color: '15803D',
        align: 'center',
        fontFace: 'Arial'
      });
    });
  }

  // ✅ SOLO LA LLAMADA A LA ACCIÓN - Posición final
  slide.addText('¡Gracias por su atención!', {
    x: 1, y: 4.6, w: 8, h: 0.3,
    fontSize: 16,
    bold: true, 
    color: '059669',
    align: 'center',
    fontFace: 'Arial'
  });
}
}