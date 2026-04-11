import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { GenerateTasksModal } from './GenerateTasksModal';

export const AIConvertButton = ({ note }) => {
  const [open, setOpen] = useState(false);

  const contentStr = typeof note?.content === 'string' ? note.content : '';
  if (!note || !contentStr.trim()) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-primary hover:opacity-90 text-primary-foreground p-2 rounded-md flex items-center gap-1 text-sm"
      >
        <Sparkles size={14} /> ⚡ Generate Tasks
      </button>
      {open && (
        <GenerateTasksModal
          isOpen={open}
          onClose={() => setOpen(false)}
          note={note}
        />
      )}
    </>
  );
}; 