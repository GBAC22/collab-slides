import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Theme {
  name: string;
  description: string;
  colors: {
    primary: string;
    background: string;
  };
}

interface ProjectData {
  name: string;
  method: string;
  description?: string;
}

interface ProjectResponse {
  id: string | number;
  name: string;
  method: string;
  description?: string;
}

interface PptxResponse {
  success: boolean;
  fileUrl: string;
}

const projectService = {
  createProject: async (data: ProjectData): Promise<ProjectResponse> => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Error al crear proyecto');
    return response.json();
  },

  generatePptxFromText: async (
    projectId: string | number,
    prompt: string,
    numSlides: number,
    theme: string
  ): Promise<PptxResponse> => {
    const response = await fetch(`${API_BASE_URL}/export/generate-pptx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify({ prompt, numSlides, theme, projectId })
    });
    if (!response.ok) throw new Error('Error al generar presentación');
    return response.json();
  },

  generatePptxFromVoice: async (
    projectId: string | number,
    audioFile: File
  ): Promise<PptxResponse> => {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('projectId', projectId.toString());

    const response = await fetch(`${API_BASE_URL}/export/generate-pptx-from-voice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: formData
    });
    if (!response.ok) throw new Error('Error al generar presentación desde audio');
    return response.json();
  }
};

export default function CreateProjectPage() {
  const [method, setMethod] = useState<'manual' | 'ai-text' | 'ai-voice'>('manual');
  const [projectName, setProjectName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [numSlides, setNumSlides] = useState(5);
  const [selectedTheme, setSelectedTheme] = useState('professional');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/export/available-themes`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
      });
      const data = await res.json();
      setThemes(data.themes || []);
      setSelectedTheme((data.themes && data.themes[0].name) || 'professional');
    } catch {
      setThemes([
        { name: 'professional', description: 'Tema profesional', colors: { primary: '#2E86AB', background: '#FFFFFF' } },
        { name: 'modern', description: 'Diseño moderno', colors: { primary: '#6C5CE7', background: '#F8F9FA' } }
      ]);
      setSelectedTheme('professional');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([blob], 'recording.wav', { type: 'audio/wav' });
        setAudioFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      console.error(err);
      setError('No se pudo acceder al micrófono.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const validateForm = (): boolean => {
    if (!projectName.trim()) {
      setError('El nombre del proyecto es requerido');
      return false;
    }
    if (method === 'ai-text' && !prompt.trim()) {
      setError('La descripción es requerida');
      return false;
    }
    if (method === 'ai-voice' && !audioFile) {
      setError('Debes grabar el audio antes de continuar');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setLoadingStep('Creando proyecto...');
    try {
      const project = await projectService.createProject({
        name: projectName,
        method,
        description: method === 'ai-text' ? prompt : 'Proyecto generado'
      });

      if (method === 'ai-text') {
        setLoadingStep('Generando presentación...');
        await projectService.generatePptxFromText(project.id, prompt, numSlides, selectedTheme);
      }

      if (method === 'ai-voice') {
        setLoadingStep('Enviando audio y generando presentación...');
        await projectService.generatePptxFromVoice(project.id, audioFile as File);
      }

      alert('Proyecto creado exitosamente');
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
      setError('Error durante la creación del proyecto');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto p-6 bg-white rounded shadow mt-10">
        <h1 className="text-2xl font-bold mb-4">Crear Proyecto</h1>
        {error && <div className="p-2 bg-red-100 text-red-700 rounded mb-4">{error}</div>}

        <div className="mb-4">
          <label className="block mb-1 font-medium">Nombre del Proyecto</label>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium">Método</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as 'manual' | 'ai-text' | 'ai-voice')} className="w-full border rounded p-2">
            <option value="manual">Manual</option>
            <option value="ai-text">IA por texto</option>
            <option value="ai-voice">IA por voz</option>
          </select>
        </div>

        {method === 'ai-text' && (
          <>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Descripción</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Número de slides</label>
              <select value={numSlides} onChange={(e) => setNumSlides(Number(e.target.value))} className="w-full border rounded p-2">
                {[3, 5, 7, 10, 15, 20].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Tema</label>
              <select value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value)} className="w-full border rounded p-2">
                {themes.map(theme => (
                  <option key={theme.name} value={theme.name}>{theme.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {method === 'ai-voice' && (
          <div className="mb-4">
            <div className="flex space-x-2">
              {!isRecording ? (
                <button onClick={startRecording} className="bg-purple-600 text-white px-4 py-2 rounded">
                  Grabar Audio
                </button>
              ) : (
                <button onClick={stopRecording} className="bg-red-600 text-white px-4 py-2 rounded">
                  Detener Grabación
                </button>
              )}
              {audioFile && <span className="text-green-600">✅ Audio listo</span>}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? loadingStep || 'Procesando...' : 'Crear Proyecto'}
        </button>
      </div>
    </div>
  );
}
