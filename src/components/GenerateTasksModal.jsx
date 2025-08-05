import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGeminiTaskify } from '../hooks/useGeminiTaskify';
import { bulkAddTasks } from '../db/bulkAddTasks';
import { db } from '../db/db';
import { toast } from 'react-toastify';
import { prepareFoldersForDisplay } from '../utils/folderDisplay';

export const GenerateTasksModal = ({ isOpen, onClose, note }) => {
  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const defaultProjectId = projects?.[0]?.id;

  const [projectId, setProjectId] = useState(defaultProjectId);
  const [folderId, setFolderId] = useState('');
  const [enhance, setEnhance] = useState(false);

  const folders = useLiveQuery(() => projectId ? db.folders.where({ projectId: Number(projectId) }).toArray() : [], [projectId]);

  // Create project map and prepare folders with hierarchy display
  const projectMap = useMemo(() => {
    return projects?.reduce((map, proj) => {
      map[proj.id] = proj;
      return map;
    }, {}) || {};
  }, [projects]);

  const displayFolders = useMemo(() => {
    return folders ? prepareFoldersForDisplay(folders, projectMap) : [];
  }, [folders, projectMap]);

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultProjectId]);

  // Reset folder selection when project changes
  useEffect(() => {
    setFolderId('');
  }, [projectId]);

  const { tasksTree, isLoading, error, run, reset } = useGeminiTaskify();

  if (!isOpen) return null;

  const handleGenerate = () => {
    reset();
    run(note.content, { enhance });
  };

  const handleImport = async () => {
    try {
      await bulkAddTasks(tasksTree, Number(projectId), folderId ? Number(folderId) : null);
      toast.success('Tasks imported successfully');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to import tasks');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-card border border-border p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Generate Tasks from Note</h2>

        {/* Parameters */}
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="enhance" checked={enhance} onChange={e => setEnhance(e.target.checked)} />
            <label htmlFor="enhance" className="text-sm">Enhance (split into granular subtasks)</label>
          </div>
          {projects && projects.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Project</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="p-2 rounded-md bg-secondary border border-border"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {projectId && displayFolders && displayFolders.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Folder</span>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="p-2 rounded-md bg-secondary border border-border"
              >
                <option value="">No Folder</option>
                {displayFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.displayPath}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Preview / Note */}
        <div className="grid grid-cols-2 gap-4">
          <div className="prose prose-sm dark:prose-invert bg-secondary p-3 rounded max-h-64 overflow-y-auto">
            <h3 className="text-sm font-bold mb-2">Note Preview</h3>
            <pre className="whitespace-pre-wrap">{typeof note.content === 'string' ? note.content : JSON.stringify(note.content, null, 2)}</pre>
          </div>
          <div className="bg-secondary p-3 rounded max-h-64 overflow-y-auto">
            <h3 className="text-sm font-bold mb-2">Generated Tasks</h3>
            {isLoading && <p>Generating…</p>}
            {error && <p className="text-destructive">{error}</p>}
            {!isLoading && tasksTree && (
              <ul className="list-disc list-inside text-sm">
                {tasksTree.map((t, idx) => (
                  <TaskNode key={idx} node={t} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white p-2 px-4 rounded"
          >
            Cancel
          </button>
          {!tasksTree && (
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-4 rounded"
            >
              {isLoading ? 'Generating…' : 'Generate'}
            </button>
          )}
          {tasksTree && (
            <button
              onClick={handleImport}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 px-4 rounded"
            >
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskNode = ({ node }) => {
  return (
    <li>
      {node.text}
      {node.children && node.children.length > 0 && (
        <ul className="list-disc list-inside ml-4">
          {node.children.map((child, idx) => (
            <TaskNode key={idx} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}; 