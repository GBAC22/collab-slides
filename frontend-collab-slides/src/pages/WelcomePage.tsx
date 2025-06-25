import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authService } from '../api/authService';

export default function WelcomePage() {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'connected', 'disconnected'
  const [backendMessage, setBackendMessage] = useState('Verificando conexión...');

  useEffect(() => {
    console.log('WelcomePage cargada');
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    console.log('Verificando conexión al backend...');
    
    try {
      await authService.checkHealth();
      setBackendStatus('connected');
      setBackendMessage('✅ Conectado al backend correctamente');
      console.log('Backend conectado correctamente');
    } catch (error) {
      setBackendStatus('disconnected');
      setBackendMessage('❌ No se pudo conectar al backend');
      console.error('Error conectando al backend:', error);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center">
        {/* Estado de conexión del backend */}
        <div className={`mb-6 p-3 rounded-lg ${
          backendStatus === 'connected' 
            ? 'bg-green-100 border border-green-300' 
            : backendStatus === 'disconnected'
            ? 'bg-red-100 border border-red-300'
            : 'bg-yellow-100 border border-yellow-300'
        }`}>
          <p className={`text-sm font-medium ${
            backendStatus === 'connected' 
              ? 'text-green-800' 
              : backendStatus === 'disconnected'
              ? 'text-red-800'
              : 'text-yellow-800'
          }`}>
            {backendMessage}
          </p>
          {backendStatus === 'disconnected' && (
            <button
              onClick={checkBackendConnection}
              className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition duration-200"
            >
              Reintentar conexión
            </button>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Collab Slides
          </h1>
          <p className="text-gray-600 text-lg">
            Crea presentaciones colaborativas con IA
          </p>
          <div className="mt-4 text-sm text-gray-500 space-y-1">
            <p>✨ Genera slides automáticamente</p>
            <p>🤝 Colabora en tiempo real</p>
            <p>🎨 Múltiples temas disponibles</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <Link
            to="/login"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 block"
          >
            Iniciar Sesión
          </Link>
          
          <Link
            to="/register"
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 block border border-gray-300"
          >
            Registrarse
          </Link>
        </div>
        
        <div className="mt-8">
          <p className="text-sm text-gray-500">
            ¿Ya tienes una cuenta? 
            <Link to="/login" className="text-blue-600 hover:underline ml-1">
              Inicia sesión aquí
            </Link>
          </p>
          <div className="mt-4 text-xs text-gray-400">
            <p>🚀 Genera presentaciones con IA</p>
            <p>📊 Exporta a PowerPoint</p>
            <p>🎤 Crea desde audio</p>
          </div>
        </div>
      </div>
    </div>
  );
}