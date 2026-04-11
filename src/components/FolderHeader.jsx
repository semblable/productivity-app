import { useState } from 'react';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { normalizeNullableId } from '../db/id-utils';
import { createFolder } from '../db/folder-utils';
import { deleteFolder } from '../db/folder-utils';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from '../hooks/useAppData';

/**
 * Collapsible header representing a folder of tasks.
 * Children (task list) will be rendered underneath when expanded.
 */
export const FolderHeader = ({ folder, children, className = '', style = {} }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);

  const { data: tasksForFolder = [] } = useTasks({ folderId: normalizeNullableId(folder.id) });
  const total = tasksForFolder?.length || 0;
  const completed = tasksForFolder?.filter(t => t.completed).length || 0;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const handleDelete = () => {
    toast((t) => (
      <div className="flex flex-col gap-3" style={{ minWidth: '260px' }}>
        <p className="font-semibold">Delete &quot;{folder.name}&quot;?</p>
        <p className="text-sm text-gray-500">What should happen to the {total} task{total !== 1 ? 's' : ''} inside?</p>
        <div className="flex flex-col gap-2">
          <button
            className="bg-red-600 hover:bg-red-700 text-white p-2 px-3 rounded text-sm text-left"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteFolder(folder.id, { cascade: true });
                await queryClient.invalidateQueries();
                toast.success(`Folder "${folder.name}" and its tasks deleted.`);
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete folder.');
              }
            }}
          >
            🗑 Delete folder &amp; all tasks
          </button>
          <button
            className="bg-orange-500 hover:bg-orange-600 text-white p-2 px-3 rounded text-sm text-left"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteFolder(folder.id, { cascade: false });
                await queryClient.invalidateQueries();
                toast.success(`Folder "${folder.name}" deleted. Tasks moved to Ungrouped.`);
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete folder.');
              }
            }}
          >
            📂 Delete folder, keep tasks (move to Ungrouped)
          </button>
          <button
            className="bg-gray-500 hover:bg-gray-600 text-white p-2 px-3 rounded text-sm text-left"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const progressBarColor = percent < 50 ? 'bg-red-500' : percent < 80 ? 'bg-yellow-500' : 'bg-green-500';

  const { isOver, setNodeRef } = useDroppable({ id: `folder-${folder.id}` });

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border border-border bg-card shadow-sm ${isOver ? 'ring-2 ring-primary' : ''} ${className}`}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsOpen(prev => !prev); } }}
        className="w-full flex items-center justify-between p-3 text-left cursor-pointer"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          <span className="font-semibold" style={{ color: folder.color || undefined }}>{folder.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            title="Add sub-folder"
            aria-label="Add sub-folder"
            onClick={async (e) => {
              e.stopPropagation();
              const name = window.prompt('New sub-folder name:');
              if (name && name.trim()) {
                try {
                  await createFolder({ name: name.trim(), projectId: folder.projectId, parentId: folder.id });
                  await queryClient.invalidateQueries();
                  toast.success(`Sub-folder "${name.trim()}" created`);
                } catch (err) {
                  console.error('Failed to create sub-folder:', err);
                  toast.error('Failed to create sub-folder');
                }
              }
            }}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
          >
            <Plus size={16} />
          </button>
          <span className="text-sm text-muted-foreground">{completed}/{total}</span>
          <button aria-label="Delete folder" onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1 w-full bg-secondary">
          <div className={`h-1 ${progressBarColor}`} style={{ width: `${percent}%` }}></div>
        </div>
      )}
      {isOpen && <div className="p-2 space-y-3">{children}</div>}
    </div>
  );
};
