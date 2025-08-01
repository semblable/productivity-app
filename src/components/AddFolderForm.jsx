import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createFolder } from '../db/folder-utils';
import { toast } from 'react-toastify';
import { Plus } from 'lucide-react';

/**
 * Form to create a folder. If no projectId prop is supplied, the user can pick a project.
 */
export const AddFolderForm = ({ projectId: initialProjectId }) => {
  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [name, setName] = useState('');

  useEffect(() => {
    setProjectId(initialProjectId || '');
  }, [initialProjectId]);


  if (!projects) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Folder name required');
    if (!projectId) return toast.error('Select a project');
    try {
      await createFolder({ name: name.trim(), projectId: Number(projectId) });
      toast.success('Folder created');
      setName('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create folder');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 bg-card p-3 rounded-lg border border-border shadow-sm">
      { !initialProjectId && (
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="p-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none">
          <option value="">Project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <input
        type="text"
        placeholder="New folder name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-grow min-w-[120px] p-2 rounded-md bg-secondary border border-border text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
      />
      <button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-3 rounded-md flex items-center gap-1 disabled:opacity-50" disabled={!projectId}>
        <Plus size={16}/> Add Folder
      </button>
    </form>
  );
};
