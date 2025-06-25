import { API_CONFIG, createApiUrl } from './config';

// Tipos para las respuestas de autenticación
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
}

// Función helper para hacer peticiones HTTP
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = createApiUrl(endpoint);
  const token = localStorage.getItem('access_token');

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      } catch {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error de conexión con el servidor');
  }
};

// Servicio de autenticación
export const authService = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const token = response.access_token;
    localStorage.setItem('access_token', token);

    // Decodificar el JWT y guardar user
    const payload = JSON.parse(atob(token.split('.')[1]));
    localStorage.setItem('user', JSON.stringify({
      id: payload.sub,
      email: payload.email,
      planId: payload.planId
    }));

    return response;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const token = response.access_token;
    localStorage.setItem('access_token', token);

    // Decodificar el JWT y guardar user
    const payload = JSON.parse(atob(token.split('.')[1]));
    localStorage.setItem('user', JSON.stringify({
      id: payload.sub,
      email: payload.email,
      planId: payload.planId
    }));

    return response;
  },

  checkHealth: async (): Promise<string> => {
    try {
      const response = await fetch(API_CONFIG.baseURL);
      if (!response.ok) {
        throw new Error(`Backend respondió con error: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Backend no disponible');
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('access_token');
    return !!token;
  },

  getToken: (): string | null => {
    return localStorage.getItem('access_token');
  },

  getUser: (): { id?: string; email?: string; planId?: string } | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // 🚀 Nueva función para pedir el userId al backend
  getUserIdFromServer: async (): Promise<string> => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('No hay token disponible');
    }

    const response = await fetch(createApiUrl('/auth/get-user-id'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Error al obtener el userId desde el servidor');
    }

    const data = await response.json();
    return data.userId;
  }
};
