import { createApiUrl } from './config';

export interface SlideData {
  title?: string;
  content?: string;
  notes?: string;           // Si lo usas, aunque no aparece en tu modelo Prisma
  imageUrl?: string;
  bulletPoints?: string[];  // 💡 Nuevo: compatible con tu backend (JSON en DB)
  slideType?: string;       // 💡 Nuevo: "title", "content", etc.
  imagePrompt?: string;     // 💡 Nuevo: prompt de la imagen generada
  data?: Record<string, unknown>;  // Reemplaza `any` por esto
}

export const slideService = {
  // Crear slide
  createSlide: async (data: SlideData & { projectId: string }) => {
    const url = createApiUrl('/slides');
    const token = localStorage.getItem('access_token');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Error al crear el slide');
    }

    return response.json();
  },

  // Obtener slides de un proyecto
  getSlidesByProject: async (projectId: string) => {
    const url = createApiUrl(`/slides/project/${projectId}`);
    const token = localStorage.getItem('access_token');

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener los slides');
    }

    return response.json();
  },

  // Obtener un slide por ID
  getSlide: async (id: string) => {
    const url = createApiUrl(`/slides/${id}`);
    const token = localStorage.getItem('access_token');

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener el slide');
    }

    return response.json();
  },

  // Actualizar un slide
  updateSlide: async (id: string, data: SlideData) => {
    const url = createApiUrl(`/slides/${id}`);
    const token = localStorage.getItem('access_token');

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Error al actualizar el slide');
    }

    return response.json();
  },

  // Eliminar un slide
  deleteSlide: async (id: string) => {
    const url = createApiUrl(`/slides/${id}`);
    const token = localStorage.getItem('access_token');

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Error al eliminar el slide');
    }

    return response.json();
  }
};
