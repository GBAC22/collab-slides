import { useState } from 'react';
import { projectService } from '../api/projectsService';

export default function InviteForm({ projectId }: { projectId: string }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    try {
      setLoading(true);
      await projectService.inviteUser(projectId, { userId, role });
      alert('Usuario invitado correctamente');
      setUserId('');
    } catch {
      alert('Error invitando usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border p-2 rounded">
      <h3 className="font-semibold mb-1">Invitar usuario</h3>
      <input
        value={userId}
        onChange={e => setUserId(e.target.value)}
        placeholder="User ID"
        className="border p-1 mb-1 w-full"
      />
      <select value={role} onChange={e => setRole(e.target.value as 'editor' | 'viewer')} className="border p-1 mb-1 w-full">
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
      <button onClick={handleInvite} disabled={loading} className="bg-green-600 text-white px-2 py-1 rounded w-full">
        {loading ? 'Invitando...' : 'Invitar'}
      </button>
    </div>
  );
}
