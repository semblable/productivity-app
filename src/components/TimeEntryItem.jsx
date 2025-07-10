import { useState } from 'react';
import { db } from '../db/db';
import toast from 'react-hot-toast';

export const TimeEntryItem = ({ entry, project }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDescription, setEditDescription] = useState(entry.description);
    const [startTime, setStartTime] = useState(entry.startTime);
    const [endTime, setEndTime] = useState(entry.endTime);
    
    const formatDuration = (d) => {
        if (d === undefined || d === null) return '00:00:00';
        const h = Math.floor(d / 3600).toString().padStart(2, '0');
        const m = Math.floor((d % 3600) / 60).toString().padStart(2, '0');
        const s = (d % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const formatTime = (date) => {
        try {
            const d = new Date(date);
            return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch {
            return 'Invalid Date';
        }
    };

    const formatForInput = (date) => {
        try {
            const d = new Date(date);
            return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
        } catch {
            return '';
        }
    };

    const handleSave = async () => {
        try {
            const start = new Date(startTime);
            const end = new Date(endTime);
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                toast.error('Invalid date values');
                return;
            }
            
            if (end <= start) {
                toast.error('End time must be after start time');
                return;
            }
            
            const durationSeconds = Math.floor((end - start) / 1000);
            
            await db.timeEntries.update(entry.id, {
                description: editDescription,
                startTime: start,
                endTime: end,
                duration: durationSeconds
            });
            toast.success('Entry updated');
            setIsEditing(false);
        } catch (e) {
            toast.error('Failed to update');
        }
    };

    const deleteEntry = async () => {
        if (window.confirm('Are you sure you want to delete this time entry?')) {
            try {
                await db.timeEntries.delete(entry.id);
                toast.success('Entry deleted');
            } catch (err) {
                toast.error('Failed to delete entry.');
                console.error(err);
            }
        }
    };

    return (
        <div className="bg-card p-3 rounded-lg flex flex-col gap-4 shadow-sm border border-border">
            {isEditing ? (
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="p-2 rounded bg-secondary text-foreground"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">Start Time</label>
                            <input
                                type="datetime-local"
                                value={formatForInput(startTime)}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">End Time</label>
                            <input
                                type="datetime-local"
                                value={formatForInput(endTime)}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button 
                            onClick={() => setIsEditing(false)} 
                            className="bg-muted hover:bg-border text-foreground p-1 px-3 rounded text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="bg-primary hover:opacity-90 text-primary-foreground p-1 px-3 rounded text-sm"
                        >
                            Save
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-grow font-medium text-foreground">{entry.description}</div>
                    <div className="flex items-center gap-4 text-sm">
                         <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="w-3 h-3 rounded-full" style={{backgroundColor: project?.color || '#64748b' }}></span>
                            <span className="font-semibold">{project?.name || 'No Project'}</span>
                        </div>
                        <div className="text-muted-foreground">
                            {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                        </div>
                        <div className="font-mono text-lg text-foreground w-28 text-center">{formatDuration(entry.duration)}</div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsEditing(true)} 
                                className="text-ring hover:text-foreground"
                            >
                                Edit
                            </button>
                            <button 
                                onClick={deleteEntry} 
                                className="text-destructive hover:opacity-80"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};