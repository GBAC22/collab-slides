import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../api/authService';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = authService.getUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/welcome'); // ✅ Redirige a /welcome al cerrar sesión
  };

  const isActive = (path: string) => location.pathname === path;

  console.log('👤 Usuario cargado en Navbar:', user); // Para depuración

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo y nombre */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-bold text-gray-800">Collab Slides</span>
            </Link>
          </div>

          {/* Navegación central */}
          <div className="hidden md:flex space-x-8">
            <Link
              to="/dashboard"
              className={`px-3 py-2 rounded-md text-sm font-medium transition duration-200 ${
                isActive('/dashboard')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/create-project"
              className={`px-3 py-2 rounded-md text-sm font-medium transition duration-200 ${
                isActive('/create-project')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Crear Proyecto
            </Link>
          </div>

          {/* Usuario y logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-start">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-sm font-medium">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-gray-700 font-medium">
                  {user?.email || 'Usuario'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-md text-sm font-medium transition duration-200"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
