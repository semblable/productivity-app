import { useState, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toast } from 'react-toastify';
import debounce from 'lodash.debounce';
import { Plus, Trash2, Edit2, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AIConvertButton } from './AIConvertButton';

// Helper to ensure content is always treated as a string
const getContentString = (content) => {
    if (typeof content === 'string') return content;
    // Fallback – stringify objects or unknown types safely
    try {
        return JSON.stringify(content, null, 2);
    } catch {
        return String(content);
    }
};

// Helper to extract a safe title for the note list
const getNoteTitle = (note) => {
    if (!note || !note.content) return 'New Note';
    const contentStr = getContentString(note.content);
    return (contentStr.split('\n')[0] || 'New Note').replace(/#/g, '').trim();
};

export const NotesView = () => {
    const notes = useLiveQuery(() => db.notes.orderBy('modifiedAt').reverse().toArray(), []);
    const [activeNote, setActiveNote] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState('view'); // 'edit' or 'view'

    const selectNote = (note) => {
        setActiveNote(note);
        setViewMode('view'); // Default to view mode on select
    };

    const createNewNote = async () => {
        const newNote = {
            content: '# New Note\n\nStart writing here...',
            createdAt: new Date(),
            modifiedAt: new Date(),
        };
        const id = await db.notes.add(newNote);
        setActiveNote({ ...newNote, id });
        setViewMode('edit'); // Switch to edit mode for new note
    };

    const updateNoteInDb = (id, content) => {
        if (id) {
            db.notes.update(id, { content, modifiedAt: new Date() }).then(() => {
                setIsSaving(false);
            });
        }
    };
    
    // useRef to hold the debounced function
    const debouncedUpdate = useRef(debounce(updateNoteInDb, 1000)).current;

    const handleContentChange = useCallback((e) => {
        if (!activeNote) return;

        const newContent = e.target.value;
        const updatedNote = { ...activeNote, content: newContent };
        setActiveNote(updatedNote);
        
        setIsSaving(true);
        debouncedUpdate(updatedNote.id, newContent);
    }, [activeNote, debouncedUpdate]);

    const deleteNote = async (id) => {
        await db.notes.delete(id);
        toast.success("Note deleted.");
        if (activeNote && activeNote.id === id) {
            setActiveNote(null);
        }
    };

    return (
        <div className="flex h-[calc(100vh-12rem)] bg-card rounded-lg border border-border shadow-sm">
            {/* Notes List */}
            <div className="w-1/3 border-r border-border overflow-y-auto">
                <div className="p-4">
                    <button onClick={createNewNote} className="w-full bg-primary hover:opacity-90 text-primary-foreground p-2 rounded-md mb-4 flex items-center justify-center gap-2">
                        <Plus size={16} /> New Note
                    </button>
                    {notes?.map(note => (
                        <div key={note.id} onClick={() => selectNote(note)} className={`p-3 rounded-lg cursor-pointer mb-2 group relative ${activeNote?.id === note.id ? 'bg-secondary' : 'hover:bg-secondary'}`}>
                            <h3 className="font-bold truncate text-foreground">{getNoteTitle(note)}</h3>
                            <p className="text-sm text-muted-foreground">Last modified: {new Date(note.modifiedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', hour12: false })}</p>
                            <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="absolute top-2 right-2 text-xs text-destructive opacity-0 group-hover:opacity-100 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Note Editor/Viewer */}
            <div className="w-2/3 p-4 flex flex-col">
                {activeNote ? (
                    <>
                        <div className="flex justify-between items-center mb-2">
                            {/* View/Edit Toggle */}
                            <div className="flex gap-1 bg-secondary p-1 rounded-md">
                                <button onClick={() => setViewMode('view')} className={`px-2 py-1 rounded-md text-sm flex items-center gap-1 ${viewMode === 'view' ? 'bg-background shadow-sm' : ''}`}><Eye size={14} /> View</button>
                                <button onClick={() => setViewMode('edit')} className={`px-2 py-1 rounded-md text-sm flex items-center gap-1 ${viewMode === 'edit' ? 'bg-background shadow-sm' : ''}`}><Edit2 size={14} /> Edit</button>
                            </div>
                            <div className="flex items-center gap-3">
                                <AIConvertButton note={activeNote} />
                                <span className="text-sm text-muted-foreground">{isSaving ? 'Saving...' : 'Saved'}</span>
                            </div>
                        </div>
                        {viewMode === 'view' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none w-full h-full bg-transparent p-4 rounded-lg overflow-y-auto">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {getContentString(activeNote.content)}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <textarea
                                key={activeNote.id}
                                value={getContentString(activeNote.content)}
                                onChange={handleContentChange}
                                className="w-full h-full bg-background text-foreground font-mono p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                placeholder="Start writing your note with Markdown..."
                            />
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Select a note to view or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    );
}; 