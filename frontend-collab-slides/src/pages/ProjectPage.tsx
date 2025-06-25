import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import SlidePreview from '../components/SlidePreview';
import CollaborationPanel from '../components/CollaborationPanel';
import { projectService } from '../api/projectsService';
import { slideService } from '../api/slideService';
import { connectSocket, getSocket, disconnectSocket } from '../api/socket';
import type { Project, Slide, ProjectCollaborator } from '../api/projectsService';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const currentSlide = slides[currentSlideIndex];
  
  // ✅ Refs para valores que cambian frecuentemente
  const isEditingRef = useRef(isEditing);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const currentSlideRef = useRef(currentSlide);
  const currentSlideIndexRef = useRef(currentSlideIndex);
  
  // ✅ Mantener refs actualizadas
  useEffect(() => {
    isEditingRef.current = isEditing;
    hasUnsavedChangesRef.current = hasUnsavedChanges;
    currentSlideRef.current = currentSlide;
    currentSlideIndexRef.current = currentSlideIndex;
  });

  // ✅ Función loadProject como useCallback FUERA del useEffect
  const loadProject = useCallback(async (preserveCurrentSlide = false) => {
    if (!id) return;
    
    try {
      setLoading(true);
      const projectData = await projectService.getProject(id);
      setProject(projectData);
      
      // ✅ Solo ordenar en la carga inicial, NO en actualizaciones
      const slidesFromServer = projectData.slides || [];
      
      // ✅ Si estamos preservando el slide actual, NO reordenar
      if (preserveCurrentSlide) {
        setSlides(slidesFromServer); // Mantener orden del servidor
        return;
      }
      
      // ✅ Solo ordenar en carga inicial
      const sortedSlides = slidesFromServer.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      setSlides(sortedSlides);
    } catch (err) {
      console.error('Error cargando proyecto:', err);
      setError('Error al cargar el proyecto');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadProject();
      setupSocketConnection(id);
      
      // ✅ Auto-actualización cada 5 segundos
      const autoRefreshInterval = setInterval(() => {
        if (id && !isEditingRef.current && !hasUnsavedChangesRef.current) {
          console.log('🔄 Auto-actualizando proyecto...');
          loadProject(true);
          setLastUpdate(new Date());
        } else if (isEditingRef.current || hasUnsavedChangesRef.current) {
          console.log('⏸️ Auto-actualización pausada (editando o cambios sin guardar)');
        }
      }, 5000);

      return () => {
        clearInterval(autoRefreshInterval);
        disconnectSocket();
      };
    }

    return () => {
      disconnectSocket();
    };
  }, [id, loadProject]);

  const setupSocketConnection = (projectId: string) => {
    try {
      const socket = connectSocket();
      
      socket.on('connect', () => {
        console.log('🔗 Conectado a WebSocket');
        setIsConnected(true);
        socket.emit('join-project', projectId);
      });

      socket.on('disconnect', () => {
        console.log('❌ Desconectado de WebSocket');
        setIsConnected(false);
      });

      // ✅ Eventos de colaboración
      socket.on('user-joined', (users: string[]) => {
        console.log('👥 Usuarios en línea:', users);
        setOnlineUsers(users);
      });

      socket.on('user-left', (users: string[]) => {
        console.log('👋 Usuario salió, usuarios restantes:', users);
        setOnlineUsers(users);
      });

      // ✅ Eventos de slides SIN reordenar
      socket.on('slide-updated', (updatedSlide: Slide) => {
        console.log('📝 Slide actualizado por otro usuario:', updatedSlide);
        setSlides(prevSlides => 
          prevSlides.map(slide => 
            slide.id === updatedSlide.id ? updatedSlide : slide
          )
        ); // ✅ NO reordenar, solo actualizar contenido
      });

      socket.on('slides-reordered', (newSlides: Slide[]) => {
        console.log('🔄 Slides reordenados por otro usuario');
        setSlides(newSlides); // ✅ Usar orden exacto del servidor
      });

      socket.on('project-updated', (updatedProject: Project) => {
        console.log('📋 Proyecto actualizado por otro usuario');
        setProject(updatedProject);
      });

      // ✅ Eventos de invitaciones
      socket.on('member-added', (member: ProjectCollaborator) => {
        console.log('👤 Nuevo miembro agregado:', member);
        setProject(prev => prev ? {
          ...prev,
          collaborators: [...(prev.collaborators || []), member]
        } : null);
      });

    } catch (error) {
      console.error('Error configurando socket:', error);
    }
  };

  const handleSlideChange = (index: number) => {
    if (slides[index]) {
      setCurrentSlideIndex(index);
      setIsEditing(false);
      setHasUnsavedChanges(false); // ✅ Limpiar flag de cambios sin guardar
      
      // ✅ Notificar que el usuario está viendo este slide
      if (isConnected) {
        const socket = getSocket();
        socket.emit('user-viewing-slide', {
          projectId: id,
          slideIndex: index,
          slideId: slides[index].id
        });
      }
    }
  };

  const handleInputChange = (
    field: keyof Slide,
    value: string | string[] | Record<string, unknown> | null
  ) => {
    setSlides((prev) =>
      prev.map((s, idx) =>
        idx === currentSlideIndex ? { ...s, [field]: value } : s
      )
    );
    
    // ✅ Marcar que hay cambios sin guardar
    setHasUnsavedChanges(true);
  };

  const handleSaveSlide = async () => {
    if (!currentSlide) return;
    try {
      const updatedSlide = await slideService.updateSlide(currentSlide.id, {
        title: currentSlide.title,
        content: currentSlide.content,
        bulletPoints: currentSlide.bulletPoints,
        slideType: currentSlide.slideType,
        imagePrompt: currentSlide.imagePrompt,
        imageUrl: currentSlide.imageUrl,
        data: currentSlide.data,
      });
      
      // ✅ Actualizar slide SIN reordenar
      setSlides(prevSlides => 
        prevSlides.map((slide, idx) => 
          idx === currentSlideIndex ? updatedSlide : slide
        )
      ); // ✅ NO reordenar después de guardar
      
      setIsEditing(false);

      // ✅ Notificar cambios via WebSocket
      if (isConnected) {
        const socket = getSocket();
        socket.emit('slide-update', {
          projectId: id,
          slide: updatedSlide
        });
      }
    } catch (err) {
      console.error('Error guardando slide:', err);
      alert('Error al guardar el slide');
    }
  };
// ✅ NUEVA FUNCIÓN: Crear nueva slide
const handleCreateSlide = async () => {
  if (!project) return;
  
  try {
    const newSlideData = {
      projectId: project.id,
      title: `Nueva Slide ${slides.length + 1}`,
      content: '',
      bulletPoints: [],
      slideType: 'content',
      imagePrompt: '',
      imageUrl: '',
      data: {}
    };

    const newSlide = await slideService.createSlide(newSlideData);
    
    // ✅ Agregar nueva slide al final y navegar a ella
    setSlides(prevSlides => [...prevSlides, newSlide]);
    setCurrentSlideIndex(slides.length); // Ir a la nueva slide
    setIsEditing(true); // Abrir automáticamente para editar
    setHasUnsavedChanges(false);

    // ✅ Notificar via WebSocket
    if (isConnected) {
      const socket = getSocket();
      socket.emit('slide-created', {
        projectId: id,
        slide: newSlide
      });
    }
  } catch (err) {
    console.error('Error creando slide:', err);
    alert('Error al crear nueva slide');
  }
};

// ✅ NUEVA FUNCIÓN: Eliminar slide actual
const handleDeleteSlide = async () => {
  if (!currentSlide || slides.length <= 1) {
    alert('No puedes eliminar la única slide del proyecto');
    return;
  }

  const confirmDelete = window.confirm(
    `¿Estás seguro de que quieres eliminar "${currentSlide.title}"?\n\nEsta acción no se puede deshacer.`
  );

  if (!confirmDelete) return;

  try {
    await slideService.deleteSlide(currentSlide.id);
    
    // ✅ Remover slide y ajustar navegación
    const newSlides = slides.filter(slide => slide.id !== currentSlide.id);
    setSlides(newSlides);
    
    // ✅ Ajustar índice actual
    if (currentSlideIndex >= newSlides.length) {
      setCurrentSlideIndex(newSlides.length - 1); // Ir a la última
    } else if (currentSlideIndex > 0 && currentSlideIndex === newSlides.length) {
      setCurrentSlideIndex(currentSlideIndex - 1); // Ir a la anterior
    }
    
    setIsEditing(false);
    setHasUnsavedChanges(false);

    // ✅ Notificar via WebSocket
    if (isConnected) {
      const socket = getSocket();
      socket.emit('slide-deleted', {
        projectId: id,
        slideId: currentSlide.id
      });
    }
  } catch (err) {
    console.error('Error eliminando slide:', err);
    alert('Error al eliminar slide');
  }
};
  const handleExport = async () => {
    if (!project) return;
    try {
      setExporting(true);
      const res = await projectService.exportPptx(project.id);
      if (res.url) {
        window.open(res.url, '_blank');
      }
    } catch (err) {
      console.error('Error exportando PPTX:', err);
      alert('Error al exportar presentación');
    } finally {
      setExporting(false);
    }
  };

  const handleInviteUser = async (userId: string, role: 'editor' | 'viewer') => {
    if (!project) return;
    try {
      await projectService.inviteUser(project.id, {
        userId,
        role
      });
      
      // Recargar proyecto para actualizar colaboradores
      const updatedProject = await projectService.getProject(project.id);
      setProject(updatedProject);
      
      alert('Usuario invitado exitosamente');
    } catch (err) {
      console.error('Error invitando usuario:', err);
      alert('Error al invitar usuario. Verifica que el ID sea correcto.');
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;
  if (error || !project)
    return <div className="p-6 text-red-600">Error: {error || 'No encontrado'}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex h-screen pt-16">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          {/* Header del proyecto */}
          <div className="mb-4">
            <h2 className="font-semibold text-lg mb-2">{project.name}</h2>
            
            {/* Indicador de conexión y última actualización */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-600">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            
            <div className="text-xs text-gray-500 mb-3">
              Última actualización: {lastUpdate.toLocaleTimeString()}
              {(isEditing || hasUnsavedChanges) && (
                <span className="text-orange-600 block">
                  ⏸️ Auto-actualización pausada
                </span>
              )}
            </div>

            {/* Usuarios en línea */}
            {onlineUsers.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-1">En línea: {onlineUsers.length}</div>
                <div className="flex -space-x-1">
                  {onlineUsers.slice(0, 3).map((user, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white border-2 border-white"
                      title={user}
                    >
                      {user.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {onlineUsers.length > 3 && (
                    <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-xs text-white border-2 border-white">
                      +{onlineUsers.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lista de slides */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Slides ({slides.length})</h3>
              <button
                onClick={handleCreateSlide}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                title="Crear nueva slide"
              >
                ➕ Nueva
              </button>
            </div>
            
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className={`p-2 rounded cursor-pointer text-sm ${
                  currentSlideIndex === i ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
                } ${currentSlideIndex === i && hasUnsavedChanges ? 'border-orange-400 bg-orange-50' : ''}`}
              >
                <div onClick={() => handleSlideChange(i)}>
                  <div className="font-medium truncate">
                    {slide.title || `Slide ${i + 1}`}
                    {currentSlideIndex === i && hasUnsavedChanges && (
                      <span className="text-orange-600 ml-1">●</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {slide.slideType}
                  </div>
                </div>
                
                {/* Botón eliminar (solo visible en hover) */}
                {currentSlideIndex === i && slides.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSlide();
                    }}
                    className="mt-1 text-red-600 hover:text-red-800 text-xs"
                    title="Eliminar slide"
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Botones de acción */}
          <div className="space-y-2">
            <button
              onClick={() => setShowCollabPanel(!showCollabPanel)}
              className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
            >
              {showCollabPanel ? 'Ocultar' : 'Mostrar'} Colaboradores
            </button>
            
            <button
              onClick={handleExport}
              className="w-full bg-green-600 text-white py-2 px-3 rounded text-sm disabled:opacity-50 hover:bg-green-700"
              disabled={exporting}
            >
              {exporting ? 'Exportando...' : 'Exportar a PPTX'}
            </button>
          </div>
        </div>

        {/* Panel de colaboración */}
        {showCollabPanel && (
          <div className="w-80 bg-white border-r border-gray-200">
            <CollaborationPanel
              project={project}
              onInviteUser={handleInviteUser}
              onClose={() => setShowCollabPanel(false)}
            />
          </div>
        )}

        {/* Editor principal */}
        <div className="flex-1 p-8 overflow-y-auto">
          {currentSlide && (
            <div>
              {isEditing ? (
                <div className="space-y-4 max-w-4xl">
                  <h3 className="text-xl font-semibold mb-4">Editando Slide {currentSlideIndex + 1}</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Título</label>
                    <input
                      value={currentSlide.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Título del slide"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Contenido</label>
                    <textarea
                      value={currentSlide.content || ''}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      className="w-full border rounded px-3 py-2 h-24"
                      placeholder="Contenido del slide"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de Slide</label>
                    <select
                      value={currentSlide.slideType}
                      onChange={(e) => handleInputChange('slideType', e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="title">Título</option>
                      <option value="content">Contenido</option>
                      <option value="bullets">Lista de puntos</option>
                      <option value="comparison">Comparación</option>
                      <option value="timeline">Línea de tiempo</option>
                      <option value="stats">Estadísticas</option>
                      <option value="conclusion">Conclusión</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">URL de Imagen</label>
                    <input
                      value={currentSlide.imageUrl || ''}
                      onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Puntos Clave (uno por línea)</label>
                    <textarea
                      value={
                        Array.isArray(currentSlide.bulletPoints)
                          ? currentSlide.bulletPoints.join('\n')
                          : ''
                      }
                      onChange={(e) =>
                        handleInputChange('bulletPoints', e.target.value.split('\n').filter(line => line.trim()))
                      }
                      className="w-full border rounded px-3 py-2 h-32"
                      placeholder="Punto 1&#10;Punto 2&#10;Punto 3"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveSlide}
                      className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                    >
                      Guardar Cambios
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">
                      Slide {currentSlideIndex + 1} de {slides.length}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                      >
                        Editar Slide
                      </button>
                      {slides.length > 1 && (
                        <button
                          onClick={handleDeleteSlide}
                          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                          title="Eliminar slide actual"
                        >
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <SlidePreview slide={currentSlide} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}