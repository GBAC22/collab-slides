// Página de prueba temporal para verificar que Tailwind funciona

// Extender la interfaz Window para TypeScript
interface WindowWithTailwind extends Window {
  tailwind?: unknown;
}

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Test de Tailwind</h1>
        <p className="text-gray-600 mb-4">Si ves esto con colores y estilos, Tailwind está funcionando.</p>
        
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 w-full">
          Botón de prueba
        </button>
        
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          ✅ Tailwind CSS está funcionando correctamente
        </div>

        {/* Test de más estilos */}
        <div className="mt-4 space-y-2">
          <div className="flex space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
          </div>
          
          <div className="text-sm text-gray-500">
            Colores y espaciado funcionando ✨
          </div>
          
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-xs">Si ves este contenido con estilos bonitos, entonces Tailwind está cargando correctamente desde el CDN.</p>
          </div>
        </div>

        {/* Información de debug mejorada */}
        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold text-blue-800 text-sm">Debug Info:</h3>
          <div className="text-xs text-blue-600 mt-1">
            <p>URL actual: {window.location.href}</p>
            <p>Tailwind global: {(window as WindowWithTailwind).tailwind ? '✅ Disponible' : '❌ No disponible'}</p>
            <p>Script CDN: {document.querySelector('script[src*="tailwindcss"]') ? '✅ Script encontrado' : '❌ Script no encontrado'}</p>
            <p>Hora: {new Date().toLocaleTimeString()}</p>
          </div>
          
          <button 
            onClick={() => {
              console.log('🔍 Estado de Tailwind:', {
                tailwindGlobal: (window as WindowWithTailwind).tailwind,
                scriptElement: document.querySelector('script[src*="tailwindcss"]'),
                allScripts: Array.from(document.querySelectorAll('script')).map(s => s.src),
              });
              alert('Ver consola para detalles de Tailwind');
            }}
            className="mt-2 bg-blue-500 text-white px-2 py-1 rounded text-xs"
          >
            Debug en Consola
          </button>
        </div>
      </div>
    </div>
  );
}