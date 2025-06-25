import { createApiUrl } from './config';

// Tipos para proyectos
export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  slides?: Slide[];
  collaborators?: ProjectCollaborator[];
  pptxUrl?: string;  // 💡 Lo agregamos como opcional
}


export interface Slide {
  id: string;
  projectId: string;
  order: number;
  title: string;
  content: string;
  bulletPoints: string[];
  slideType: string;
  imagePrompt: string;
  imageUrl: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}


export interface ProjectCollaborator {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateProjectRequest {
  name: string;
}

export interface InviteUserRequest {
  userId: string;
  role: 'editor' | 'viewer';
}

export interface GenerateProjectResponse {
  success: boolean;
  fileUrl?: string;
  message?: string;
}

export interface GenerateProjectRequest {
  prompt: string;
  numSlides: number;
  theme?: string;
  projectId?: string;
}

// Función helper para hacer peticiones HTTP con autenticación
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

// Servicios de proyectos
export const projectService = {
  // Crear proyecto
  createProject: async (data: CreateProjectRequest): Promise<Project> => {
    return apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  exportPptx: async (projectId: string): Promise<{ url: string }> => {
      return apiRequest(`/projects/${projectId}/export`, {
        method: 'POST'
      });
    },


  // Listar proyectos del usuario (propios e invitados)
  getProjects: async (): Promise<Project[]> => {
    return apiRequest('/projects');
  },

  // Obtener proyecto específico con slides
  getProject: async (id: string): Promise<Project> => {
    return apiRequest(`/projects/${id}`);
  },

  // Actualizar proyecto
  updateProject: async (id: string, data: Partial<CreateProjectRequest>): Promise<Project> => {
    return apiRequest(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Eliminar proyecto
  deleteProject: async (id: string): Promise<void> => {
    return apiRequest(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // Invitar usuario al proyecto
  inviteUser: async (projectId: string, data: InviteUserRequest): Promise<void> => {
    return apiRequest(`/projects/${projectId}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Generar proyecto con IA por texto
  generateProject: async (data: GenerateProjectRequest): Promise<GenerateProjectResponse> => {
    return apiRequest('/export/generate-pptx', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Generar proyecto con IA por voz
  generateFromVoice: async (audioFile: File, numSlides: number, theme?: string): Promise<GenerateProjectResponse> => {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('numSlides', numSlides.toString());
    if (theme) formData.append('theme', theme);

    const token = localStorage.getItem('access_token');
    const response = await fetch(createApiUrl('/export/generate-pptx-from-voice'), {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Error al generar proyecto desde audio');
    }

    return response.json();
  },

  // Obtener temas disponibles
  getAvailableThemes: async (): Promise<string[]> => {
    return apiRequest('/export/available-themes', {
      method: 'POST',
    });
  },

  // Descargar archivo generado
  downloadFile: async (fileName: string): Promise<void> => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(createApiUrl(`/export/download/${fileName}`), {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Error al descargar archivo');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};