import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { projectService } from '../api/projectsService';
import { authService } from '../api/authService';
import type { Project } from '../api/projectsService';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [serverUserId, setServerUserId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    loadUserIdFromServer();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🔄 Cargando proyectos desde el backend...');
      const data = await projectService.getProjects();
      console.log('✅ Proyectos cargados:', data);
      setProjects(data);
    } catch (error) {
      console.error('❌ Error cargando proyectos:', error);
      setError(`Error: ${error instanceof Error ? error.message : 'Error al cargar proyectos'}`);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserIdFromServer = async () => {
    try {
      console.log('📡 Obteniendo userId desde el servidor...');
      const id = await authService.getUserIdFromServer();
      console.log('✅ userId del servidor:', id);
      setServerUserId(id);
    } catch (err) {
      console.error('❌ Error al obtener userId del servidor:', err);
      setServerUserId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (window.confirm(`¿Estás seguro de que quieres eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`)) {
      setDeleteLoading(projectId);
      try {
        console.log('🗑️ Eliminando proyecto:', projectId);
        await projectService.deleteProject(projectId);
        setProjects(projects.filter(p => p.id !== projectId));
        console.log('✅ Proyecto eliminado:', projectId);
      } catch (error) {
        console.error('❌ Error eliminando proyecto:', error);
        alert(`Error al eliminar proyecto: ${error instanceof Error ? error.message : error}`);
      } finally {
        setDeleteLoading(null);
      }
    }
  };

  const handleDownloadPptx = (pptxUrl: string, projectName: string) => {
    console.log('📥 Descargando PPTX:', pptxUrl);
    const link = document.createElement('a');
    link.href = pptxUrl;
    link.download = `${projectName}.pptx`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Gestiona tus presentaciones colaborativas</p>
        </div>

        {serverUserId && (
          <div className="mb-4 text-sm text-gray-500">
            ID de usuario autenticado: <span className="font-medium text-gray-700">{serverUserId}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
            <p className="text-yellow-800">⚠️ {error}</p>
            <button
              onClick={loadProjects}
              className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="mb-8">
          <Link
            to="/create-project"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Nuevo Proyecto
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aún no tienes proyectos</h3>
            <p className="text-gray-500 mb-4">Crea tu primera presentación colaborativa</p>
            <Link
              to="/create-project"
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-200"
            >
              Crear Proyecto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={handleDeleteProject}
                onDownload={handleDownloadPptx}
                isDeleting={deleteLoading === project.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
  onDownload: (pptxUrl: string, projectName: string) => void;
  isDeleting: boolean;
}

function ProjectCard({ project, onDelete, onDownload, isDeleting }: ProjectCardProps) {
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition duration-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <span>{project.userId}</span>
          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
        </div>

        {project.pptxUrl && (
          <span className="text-xs text-green-600">PPTX listo</span>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <Link
            to={`/project/${project.id}`}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm font-medium transition duration-200"
          >
            Abrir
          </Link>

          {project.pptxUrl && (
            <button
              onClick={() => onDownload(project.pptxUrl!, project.name)}
              className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-md text-sm font-medium transition duration-200"
            >
              Descargar
            </button>
          )}

          <button
            onClick={() => onDelete(project.id)}
            disabled={isDeleting}
            className={`px-3 py-1 rounded-md text-sm font-medium transition duration-200 ${
              isDeleting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-100 hover:bg-red-200 text-red-700'
            }`}
          >
            {isDeleting ? 'Eliminando...' : 'Borrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
