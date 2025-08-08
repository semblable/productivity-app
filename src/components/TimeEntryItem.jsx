import { useState, useEffect } from 'react';
import { db } from '../db/db';
import { normalizeNullableId } from '../db/id-utils';
import { durationToSeconds, formatDuration } from '../utils/duration';
import toast from 'react-hot-toast';

export const TimeEntryItem = ({ entry, project, projects, onStartTimer, activeTimer }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDescription, setEditDescription] = useState(entry.description);
    const [editProjectId, setEditProjectId] = useState(entry.projectId);

    /* --------------------------------------------------------------------- */
    /* Helpers                                                               */
    /* --------------------------------------------------------------------- */


    const formatDateForInput = (date) => {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return '';
        }
    };

    const formatTimeForInput = (date) => {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch {
            return '';
        }
    };

    const combineDateTime = (dateStr, timeStr) => {
        // Combine without timezone shift – both inputs are local values.
        return new Date(`${dateStr}T${timeStr}`);
    };

    /* --------------------------------------------------------------------- */
    /* Local state derived from entry                                         */
    /* --------------------------------------------------------------------- */
    const [startDate, setStartDate] = useState(formatDateForInput(entry.startTime));
    const [startTimeStr, setStartTimeStr] = useState(formatTimeForInput(entry.startTime));
    const [durationInput, setDurationInput] = useState(formatDuration(entry.duration));
    const [endTime, setEndTime] = useState(entry.endTime);

    // Keep end time in sync when the user changes start date/time or duration
    useEffect(() => {
        const start = combineDateTime(startDate, startTimeStr);
        if (isNaN(start.getTime())) {
            setEndTime(null);
            return;
        }
        const durationSecs = durationToSeconds(durationInput);
        if (!Number.isFinite(durationSecs) || Number.isNaN(durationSecs) || durationSecs <= 0) {
            setEndTime(null);
            return;
        }
        const newEnd = new Date(start.getTime() + durationSecs * 1000);
        setEndTime(newEnd);
    }, [startDate, startTimeStr, durationInput]);

    /* --------------------------------------------------------------------- */
    /* Saving / Deleting                                                     */
    /* --------------------------------------------------------------------- */
    const handleSave = async () => {
        try {
            const start = combineDateTime(startDate, startTimeStr);
            if (isNaN(start.getTime())) {
                toast.error('Invalid start date/time');
                return;
            }

            const durationSeconds = durationToSeconds(durationInput.trim());
            if (!Number.isFinite(durationSeconds) || Number.isNaN(durationSeconds) || durationSeconds <= 0) {
                toast.error('Duration must be greater than 0');
                return;
            }

            const end = new Date(start.getTime() + durationSeconds * 1000);

            await db.timeEntries.update(entry.id, {
                description: editDescription,
                projectId: normalizeNullableId(editProjectId),
                startTime: start,
                endTime: end,
                duration: durationSeconds,
            });
            toast.success('Entry updated');
            setIsEditing(false);
        } catch (e) {
            console.error(e);
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

    /* --------------------------------------------------------------------- */
    /* Display helpers                                                       */
    /* --------------------------------------------------------------------- */
    const formatTimeDisplay = (date) => {
        try {
            const d = new Date(date);
            return isNaN(d.getTime())
                ? 'Invalid Date'
                : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Invalid Date';
        }
    };

    /* --------------------------------------------------------------------- */
    /* Render                                                                */
    /* --------------------------------------------------------------------- */
    return (
        <div className="bg-card p-3 rounded-lg flex flex-col gap-4 shadow-sm border border-border">
            {isEditing ? (
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="p-2 rounded bg-secondary text-foreground"
                        placeholder="Description"
                    />

                    {/* Project Selector */}
                    {projects && projects.length > 0 && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">Project</label>
                            <select
                                value={editProjectId || ''}
                                onChange={(e) => setEditProjectId(e.target.value ? e.target.value : null)}
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            >
                                <option value="">No Project</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        {/* Start Date */}
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                        {/* Start Time */}
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">Start Time</label>
                            <input
                                type="time"
                                value={startTimeStr}
                                onChange={(e) => setStartTimeStr(e.target.value)}
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                        {/* Duration */}
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">Duration (hh:mm:ss)</label>
                            <input
                                type="text"
                                value={durationInput}
                                onChange={(e) => setDurationInput(e.target.value)}
                                placeholder="01:00:00"
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                    </div>

                    {/* Computed End Time Preview */}
                    {endTime && (
                        <div className="text-xs text-muted-foreground">
                            Ends at: {new Date(endTime).toLocaleString()}
                        </div>
                    )}

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
                            <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: project?.color || '#64748b' }}
                            ></span>
                            <span className="font-semibold">{project?.name || 'No Project'}</span>
                        </div>
                        <div className="text-muted-foreground">
                            {formatTimeDisplay(entry.startTime)} - {formatTimeDisplay(entry.endTime)}
                        </div>
                        <div className="font-mono text-lg text-foreground w-28 text-center">
                            {formatDuration(entry.duration)}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (activeTimer) {
                                        toast.error("Stop the current timer first");
                                        return;
                                    }
                                    onStartTimer && onStartTimer({
                                        description: entry.description,
                                        projectId: entry.projectId
                                    });
                                }}
                                className={`p-1 ${activeTimer ? 'text-gray-400 cursor-not-allowed' : 'text-primary hover:text-primary/80'}`}
                                title={activeTimer ? "Stop current timer first" : "Start timer with same settings"}
                                disabled={!onStartTimer}
                            >
                                <svg 
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 24 24" 
                                    fill="currentColor"
                                    className="w-4 h-4"
                                >
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                            </button>
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