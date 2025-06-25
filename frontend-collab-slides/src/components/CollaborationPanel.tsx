import { useState } from 'react';
import type { Project } from '../api/projectsService';

interface CollaborationPanelProps {
  project: Project;
  onInviteUser: (userId: string, role: 'editor' | 'viewer') => Promise<void>;
  onClose: () => void;
}

export default function CollaborationPanel({ project, onInviteUser, onClose }: CollaborationPanelProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUserId.trim()) return;

    try {
      setInviting(true);
      await onInviteUser(inviteUserId, inviteRole);
      setInviteUserId('');
      setShowInviteForm(false);
    } catch (error) {
      console.error('Error invitando usuario:', error);
    } finally {
      setInviting(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return '👑';
      case 'editor':
        return '✏️';
      case 'viewer':
        return '👀';
      default:
        return '👤';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'text-yellow-600 bg-yellow-50';
      case 'editor':
        return 'text-blue-600 bg-blue-50';
      case 'viewer':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-lg">Colaboradores</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Botón para invitar */}
        <div className="mb-6">
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <span>➕</span>
            Invitar Colaborador
          </button>
        </div>

        {/* Formulario de invitación */}
        {showInviteForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  ID del usuario
                </label>
                <input
                  type="text"
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="user-123-abc-456"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">
                  Ingresa el ID único del usuario a invitar
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Rol
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="editor">Editor (puede editar)</option>
                  <option value="viewer">Viewer (solo ver)</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm disabled:opacity-50 hover:bg-green-700"
                >
                  {inviting ? 'Invitando...' : 'Enviar Invitación'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de colaboradores */}
        <div>
          <h4 className="font-medium mb-3 text-gray-700">
            Miembros del proyecto ({(project.collaborators?.length || 0) + 1})
          </h4>
          
          <div className="space-y-2">
            {/* Mostrar owner del proyecto */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-medium">
                  {/* Aquí podrías mostrar la inicial del owner */}
                  O
                </div>
                <div>
                  <div className="font-medium text-sm">Propietario</div>
                  <div className="text-xs text-gray-600">ID: {project.userId}</div>
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor('owner')}`}>
                {getRoleIcon('owner')} Owner
              </div>
            </div>

            {/* Mostrar colaboradores */}
            {project.collaborators?.map((collaborator) => (
              <div
                key={collaborator.id}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                    {collaborator.user?.name?.charAt(0).toUpperCase() || 
                     collaborator.user?.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {collaborator.user?.name || 'Usuario'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {collaborator.user?.email || `ID: ${collaborator.userId}`}
                    </div>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(collaborator.role)}`}>
                  {getRoleIcon(collaborator.role)} {collaborator.role}
                </div>
              </div>
            ))}

            {/* Mensaje si no hay colaboradores */}
            {(!project.collaborators || project.collaborators.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">👥</div>
                <div className="text-sm">No hay colaboradores aún</div>
                <div className="text-xs">Invita a alguien para empezar a colaborar</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer con información */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600 space-y-1">
          <div><strong>Editor:</strong> Puede ver y editar slides</div>
          <div><strong>Viewer:</strong> Solo puede ver la presentación</div>
          <div><strong>Owner:</strong> Control total del proyecto</div>
        </div>
      </div>
    </div>
  );
}