import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../api/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpiar error cuando el usuario empiece a escribir
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    console.log('Intentando login con:', { email: formData.email });
    console.log('URL de API:', import.meta.env.VITE_API_URL);

    try {
      const response = await authService.login(formData);
      
      console.log('Respuesta del login:', response);
      
      // Guardar token (el backend solo devuelve access_token)
      localStorage.setItem('access_token', response.access_token);
      
      // Crear información básica del usuario para el frontend
      const userInfo = {
        email: formData.email,
        name: formData.email.split('@')[0], // Extraer nombre del email
        loginTime: new Date().toISOString()
      };
      localStorage.setItem('user', JSON.stringify(userInfo));
      
      console.log('Login exitoso, redirigiendo al dashboard...');
      
      // Redireccionar al dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error en login:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Error al iniciar sesión. Verifica tus credenciales.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Iniciar Sesión
          </h1>
          <p className="text-gray-600">
            Ingresa a tu cuenta para continuar
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              placeholder="tu@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              placeholder="Tu contraseña"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition duration-300 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Iniciando sesión...
              </div>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {/* Links */}
        <div className="mt-8 text-center space-y-4">
          <div className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link 
              to="/register" 
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
            >
              Regístrate aquí
            </Link>
          </div>
          
          <div className="text-sm">
            <Link 
              to="/" 
              className="text-gray-500 hover:text-gray-700 hover:underline"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>

        {/* Demo credentials actualizadas */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center mb-2">
            <strong>Credenciales de prueba:</strong>
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Email: abac2000@gmail.com</p>
            <p>Contraseña: password</p>
          </div>
          
          {/* Botón para probar conexión */}
          <button
            type="button"
            onClick={async () => {
              try {
                console.log('Probando conexión al backend...');
                const result = await authService.checkHealth();
                console.log('Conexión exitosa:', result);
                alert('✅ Backend conectado correctamente');
              } catch (error) {
                console.error('Error de conexión:', error);
                alert('❌ No se puede conectar al backend');
              }
            }}
            className="mt-2 w-full text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-2 px-3 rounded transition duration-200"
          >
            🔧 Probar conexión al backend
          </button>
          
          {/* Botón para probar endpoint de login */}
          <button
            type="button"
            onClick={async () => {
              console.log('=== INICIANDO PRUEBA DE LOGIN ===');
              
              try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                const loginUrl = `${apiUrl}/auth/login`;
                
                console.log('1. URL de API:', apiUrl);
                console.log('2. URL completa de login:', loginUrl);
                console.log('3. Datos a enviar:', { email: 'abac2000@gmail.com', password: 'password' });
                
                const response = await fetch(loginUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email: 'abac2000@gmail.com',
                    password: 'password'
                  })
                });
                
                console.log('4. Response status:', response.status);
                console.log('5. Response ok:', response.ok);
                
                const responseText = await response.text();
                console.log('6. Response text:', responseText);
                
                if (response.ok) {
                  const data = JSON.parse(responseText);
                  console.log('7. Datos parseados:', data);
                  alert(`✅ Login exitoso! Token: ${data.access_token?.substring(0, 20)}...`);
                } else {
                  console.log('7. Error en respuesta');
                  alert(`❌ Error ${response.status}: ${responseText}`);
                }
                
              } catch (error) {
                console.error('ERROR COMPLETO:', error);
                console.error('Tipo de error:', typeof error);
                console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
                alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
              }
              
              console.log('=== FIN DE PRUEBA ===');
            }}
            className="mt-1 w-full text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 py-2 px-3 rounded transition duration-200"
          >
            🧪 Probar login con credenciales reales
          </button>
        </div>
      </div>
    </div>
  );
}