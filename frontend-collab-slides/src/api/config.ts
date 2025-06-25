// Configuración centralizada de la API
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
};

// Helper function para crear URLs completas
export const createApiUrl = (endpoint: string): string => {
  // Asegurar que el endpoint empiece con /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_CONFIG.baseURL}${cleanEndpoint}`;
};

// Verificar si estamos en desarrollo
export const isDevelopment = import.meta.env.DEV;

console.log('API Config:', {
  baseURL: API_CONFIG.baseURL,
  isDevelopment,
});