import type { Slide } from '../api/projectsService';

interface SlidePreviewProps {
  slide: Slide;
}

export default function SlidePreview({ slide }: SlidePreviewProps) {
  // ✅ Función para obtener estilos según el tipo de slide
  const getSlideStyles = (slideType: string) => {
    const baseStyles = "bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden";
    
    switch (slideType) {
      case 'title':
        return `${baseStyles} bg-gradient-to-br from-blue-50 to-blue-100`;
      case 'conclusion':
        return `${baseStyles} bg-gradient-to-br from-green-50 to-green-100`;
      case 'stats':
        return `${baseStyles} bg-gradient-to-br from-purple-50 to-purple-100`;
      case 'timeline':
        return `${baseStyles} bg-gradient-to-br from-orange-50 to-orange-100`;
      case 'comparison':
        return `${baseStyles} bg-gradient-to-br from-yellow-50 to-yellow-100`;
      default:
        return baseStyles;
    }
  };

  // ✅ Renderizar según el tipo de slide (como en el backend)
  const renderSlideContent = () => {
    switch (slide.slideType) {
      case 'title':
        return <TitleSlideContent slide={slide} />;
      case 'bullets':
        return <BulletSlideContent slide={slide} />;
      case 'comparison':
        return <ComparisonSlideContent slide={slide} />;
      case 'timeline':
        return <TimelineSlideContent slide={slide} />;
      case 'stats':
        return <StatsSlideContent slide={slide} />;
      case 'conclusion':
        return <ConclusionSlideContent slide={slide} />;
      case 'content':
      default:
        return <ContentSlideContent slide={slide} />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Slide container que simula formato 16:9 */}
      <div 
        className={`${getSlideStyles(slide.slideType)} relative`}
        style={{ aspectRatio: '16/9', minHeight: '600px' }}
      >
        {renderSlideContent()}
        
        {/* Footer con info del slide */}
        <div className="absolute bottom-2 left-4 right-4 flex justify-between text-xs text-gray-500">
          <span className="capitalize bg-white/80 px-2 py-1 rounded">
            Tipo: {slide.slideType}
          </span>
          {slide.imagePrompt && (
            <span className="italic bg-white/80 px-2 py-1 rounded max-w-xs truncate">
              {slide.imagePrompt}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ✅ Componente para slide tipo título
function TitleSlideContent({ slide }: { slide: Slide }) {
  return (
    <div className="h-full flex flex-col justify-center items-center p-12 text-center relative">
      {/* Imagen de fondo si existe */}
      {slide.imageUrl && (
        <div className="absolute inset-0 opacity-20">
          <img
            src={slide.imageUrl}
            alt="Background"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      {/* Contenido principal */}
      <div className="relative z-10 bg-white/90 p-8 rounded-xl shadow-lg max-w-4xl">
        <h1 className="text-5xl font-bold text-blue-800 mb-6 leading-tight">
          {slide.title}
        </h1>
        {slide.content && (
          <p className="text-xl text-gray-700 leading-relaxed">
            {slide.content}
          </p>
        )}
        <div className="mt-6 text-sm text-gray-500">
          {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

// ✅ Componente para slide de contenido
function ContentSlideContent({ slide }: { slide: Slide }) {
  const hasImage = slide.imageUrl;
  
  return (
    <div className="h-full flex flex-col">
      {/* Header con título */}
      <div className="bg-blue-600 text-white p-6">
        <h2 className="text-3xl font-bold">{slide.title}</h2>
      </div>
      
      {/* Contenido principal */}
      <div className="flex-1 p-8 flex">
        <div className={`${hasImage ? 'w-1/2 pr-4' : 'w-full'}`}>
          {slide.content && (
            <div className="mb-6">
              <p className="text-lg text-gray-700 leading-relaxed">
                {slide.content}
              </p>
            </div>
          )}
          
          {/* Bullet points si existen */}
          {slide.bulletPoints && slide.bulletPoints.length > 0 && (
            <ul className="space-y-3">
              {slide.bulletPoints.map((bullet, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-3 h-3 bg-blue-600 rounded-full mt-2 mr-4 flex-shrink-0"></div>
                  <span className="text-gray-700 text-lg">{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Imagen si existe */}
        {hasImage && (
          <div className="w-1/2 pl-4">
            <img
              src={slide.imageUrl}
              alt="Visual del slide"
              className="w-full h-full object-cover rounded-lg shadow-md"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Componente para slide de bullets
function BulletSlideContent({ slide }: { slide: Slide }) {
  const hasImage = slide.imageUrl;
  
  return (
    <div className="h-full flex flex-col p-8">
      <h2 className="text-4xl font-bold text-gray-800 mb-2">{slide.title}</h2>
      <div className="w-full h-1 bg-blue-600 mb-8"></div>
      
      <div className="flex-1 flex">
        <div className={`${hasImage ? 'w-3/5 pr-8' : 'w-full'}`}>
          {slide.bulletPoints && slide.bulletPoints.length > 0 && (
            <div className="space-y-6">
              {slide.bulletPoints.map((bullet, index) => (
                <div key={index} className="flex items-start">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-xl text-gray-700 leading-relaxed pt-1">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {hasImage && (
          <div className="w-2/5">
            <img
              src={slide.imageUrl}
              alt="Visual del slide"
              className="w-full h-64 object-cover rounded-lg shadow-md"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Componente para slide de comparación
function ComparisonSlideContent({ slide }: { slide: Slide }) {
  const bullets = slide.bulletPoints || [];
  const leftItems = bullets.slice(0, Math.ceil(bullets.length / 2));
  const rightItems = bullets.slice(Math.ceil(bullets.length / 2));
  
  return (
    <div className="h-full flex flex-col p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">{slide.title}</h2>
      
      <div className="flex-1 flex gap-8">
        {/* Columna izquierda */}
        <div className="w-1/2 bg-blue-50 border-2 border-blue-600 rounded-lg p-6">
          <div className="space-y-4">
            {leftItems.map((item, index) => (
              <div key={index} className="flex items-start">
                <span className="text-green-600 mr-2 text-xl">✓</span>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Columna derecha */}
        <div className="w-1/2 bg-blue-50 border-2 border-blue-600 rounded-lg p-6">
          <div className="space-y-4">
            {rightItems.map((item, index) => (
              <div key={index} className="flex items-start">
                <span className="text-green-600 mr-2 text-xl">✓</span>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Componente para slide de timeline
function TimelineSlideContent({ slide }: { slide: Slide }) {
  const bullets = slide.bulletPoints || [];
  
  return (
    <div className="h-full flex flex-col p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-12 text-center">{slide.title}</h2>
      
      <div className="flex-1 flex flex-col justify-center">
        {/* Línea de tiempo horizontal */}
        <div className="relative">
          <div className="w-full h-1 bg-blue-600 mb-8"></div>
          
          <div className="flex justify-between">
            {bullets.map((item, index) => (
              <div key={index} className="flex flex-col items-center" style={{width: `${100/bullets.length}%`}}>
                {/* Punto en la línea */}
                <div className="w-6 h-6 bg-blue-600 rounded-full -mt-3 mb-4"></div>
                
                {/* Texto del paso */}
                <div className="text-center px-2">
                  <p className="text-sm text-gray-700 mb-2">{item}</p>
                  <div className="text-xs font-bold text-blue-600">
                    Paso {index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Componente para slide de estadísticas
function StatsSlideContent({ slide }: { slide: Slide }) {
  const bullets = slide.bulletPoints || [];
  
  return (
    <div className="h-full flex flex-col p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">{slide.title}</h2>
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bullets.slice(0, 6).map((stat, index) => {
            const fakeNumber = Math.floor(Math.random() * 100) + '%';
            return (
              <div key={index} className="bg-purple-50 border-2 border-purple-600 rounded-lg p-6 text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {fakeNumber}
                </div>
                <div className="text-sm text-gray-700">
                  {stat}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ✅ Componente para slide de conclusión
function ConclusionSlideContent({ slide }: { slide: Slide }) {
  return (
    <div className="h-full flex flex-col justify-center items-center p-12 text-center relative">
      {/* Imagen de fondo si existe */}
      {slide.imageUrl && (
        <div className="absolute inset-0 opacity-25">
          <img
            src={slide.imageUrl}
            alt="Background"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      {/* Contenido principal */}
      <div className="relative z-10 bg-white/95 p-8 rounded-xl shadow-lg max-w-4xl border-4 border-green-600">
        <h2 className="text-4xl font-bold text-green-800 mb-6">{slide.title}</h2>
        
        {slide.content && (
          <p className="text-xl text-gray-700 mb-8 leading-relaxed">
            {slide.content}
          </p>
        )}
        
        {/* Puntos de acción */}
        {slide.bulletPoints && slide.bulletPoints.length > 0 && (
          <div className="space-y-3 mb-8">
            {slide.bulletPoints.map((point, index) => (
              <p key={index} className="text-lg text-green-700 font-medium">
                → {point}
              </p>
            ))}
          </div>
        )}
        
        {/* Llamada a la acción */}
        <div className="text-lg font-bold text-green-600">
          ¡Gracias por su atención!
        </div>
      </div>
    </div>
  );
}