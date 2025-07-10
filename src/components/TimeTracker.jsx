import { useState, useEffect, useRef, useCallback } from 'react';
import { db, getDefaultProject } from '../db/db';
import toast from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { logTimeToProjectGoals } from '../db/time-entry-utils';

export const TimeTracker = ({ activeTimer, setActiveTimer, activeGoalId, onStopTimer, initialEvent, onEventConsumed }) => {
    const projects = useLiveQuery(() => db.projects.toArray(), []);
    const [description, setDescription] = useState('');
    const [projectId, setProjectId] = useState('');
    const [duration, setDuration] = useState(0);
    const [manualStartTime, setManualStartTime] = useState('');
    const [manualEndTime, setManualEndTime] = useState('');
    const [manualDurationInput, setManualDurationInput] = useState('01:00:00');
    const [trackedEventId, setTrackedEventId] = useState(null);
    const intervalRef = useRef(null);

    // Handler to start a timer, defined early to avoid temporal dead zone issues when referenced below
    const handleStartTimer = useCallback(async (timerData) => {
        const desc = timerData?.description || description;
        if (!desc.trim()) {
            toast.error("Please enter a description.");
            return;
        }

        let pId = timerData?.projectId || projectId;
        if (!pId && projects && projects.length > 0) {
            const defaultProj = await getDefaultProject();
            pId = defaultProj.id;
            setProjectId(pId);
        }
        
        const newTimer = {
            description: desc.trim(),
            projectId: Number(pId),
            startTime: Date.now(),
            goalId: activeGoalId || null,
            eventId: timerData?.eventId || null,
        };
        setActiveTimer(newTimer);
        toast.success("Timer started!");
    }, [description, projectId, projects, activeGoalId, setActiveTimer]);

    useEffect(() => {
        if (initialEvent) {
            const desc = initialEvent.title || 'From Calendar Event';
            const projId = initialEvent.projectId;

            setDescription(desc);
            if (projId) setProjectId(projId);
            setTrackedEventId(initialEvent.id);

            // Automatically start the timer
            handleStartTimer({ description: desc, projectId: projId, eventId: initialEvent.id });

            // Inform parent that event has been consumed
            if (typeof onEventConsumed === 'function') {
                onEventConsumed();
            }
        }
    }, [initialEvent, handleStartTimer, onEventConsumed]);

    useEffect(() => {
        if (projects && projects.length > 0 && !projectId) {
            setProjectId(projects[0].id);
        }
    }, [projects, projectId]);

    useEffect(() => {
        if (activeGoalId && projects && !activeTimer) {
            const initGoalTimer = async () => {
                const goal = await db.timeGoals.get(activeGoalId);
                if (goal) {
                    setDescription(goal.description);
                    if (goal.projectId) {
                        setProjectId(goal.projectId);
                    } else {
                        const defaultProj = await getDefaultProject();
                        setProjectId(defaultProj.id);
                    }
                    handleStartTimer({ description: goal.description, projectId: goal.projectId });
                }
            };
            initGoalTimer();
        }
    }, [activeGoalId, projects, activeTimer, handleStartTimer]);

    useEffect(() => {
        if (activeTimer) {
            setDescription(activeTimer.description);
            setProjectId(activeTimer.projectId || '');
            setTrackedEventId(activeTimer.eventId || null);
            setDuration(Math.floor((Date.now() - activeTimer.startTime) / 1000));
            intervalRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
            setDuration(0);
            setDescription('');
            setTrackedEventId(null);
        }
        return () => clearInterval(intervalRef.current);
    }, [activeTimer]);

    useEffect(() => {
        if (!activeTimer) {
            const start = new Date(manualStartTime || Date.now() - 3600000);
            const end = new Date(manualEndTime || Date.now());

            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                const diffSeconds = Math.floor((end - start) / 1000);
                setManualDurationInput(formatDuration(diffSeconds));
            }
        }
    }, [manualStartTime, manualEndTime, activeTimer]);

    // Only update the raw string while typing; actual parsing/calculation happens on blur
    const handleDurationChange = (e) => {
        setManualDurationInput(e.target.value);
    };

    // Helper to convert a duration string (e.g., "2", "2:30", "1:15:45") into seconds
    const durationToSeconds = (input) => {
        if (!input) return 0;
        const parts = input.split(':').map(Number);
        if (parts.some(isNaN)) return 0;

        if (parts.length === 3) {
            // hh:mm:ss
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            // hh:mm (treat first part as hours)
            return parts[0] * 3600 + parts[1] * 60;
        } else if (parts.length === 1) {
            // hours only
            return parts[0] * 3600;
        }
        return 0;
    };

    const handleDurationBlur = () => {
        const totalSeconds = durationToSeconds(manualDurationInput.trim());

        if (totalSeconds <= 0) {
            // Reset to default if invalid
            setManualDurationInput('01:00:00');
            return;
        }

        // Format back to HH:MM:SS
        setManualDurationInput(formatDuration(totalSeconds));

        // Update start/end times so they stay in sync with duration
        const startDate = manualStartTime ? new Date(manualStartTime) : new Date();
        const validStart = !isNaN(startDate.getTime()) ? startDate : new Date();
        const endDate = new Date(validStart.getTime() + totalSeconds * 1000);

        setManualStartTime(formatForInput(validStart));
        setManualEndTime(formatForInput(endDate));
    };

    const handleStopTimer = async () => {
        const endTime = Date.now();
        const finalDuration = Math.floor((endTime - activeTimer.startTime) / 1000);

        if (activeTimer.goalId) {
            onStopTimer(finalDuration);
            toast.success("Time logged to your goal!");
        } else {
            try {
                await db.timeEntries.add({
                    description: activeTimer.description,
                    projectId: activeTimer.projectId,
                    startTime: new Date(activeTimer.startTime),
                    endTime: new Date(endTime),
                    duration: finalDuration,
                    eventId: trackedEventId,
                });
                if (activeTimer.projectId) {
                    await logTimeToProjectGoals(activeTimer.projectId, finalDuration);
                }
                toast.success("Time entry saved!");
            } catch (error) {
                console.error("Failed to save time entry:", error);
                toast.error("Failed to save time entry.");
            }
        }
        setActiveTimer(null);
    };
    
    const formatDuration = (d) => {
        const h = Math.floor(d / 3600).toString().padStart(2, '0');
        const m = Math.floor((d % 3600) / 60).toString().padStart(2, '0');
        const s = (d % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };
    
    // Format a Date object as "YYYY-MM-DDTHH:MM" in LOCAL time so it works correctly with
    // the HTML datetime-local input without timezone shifts.
    const formatForInput = (date) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const pad = (n) => n.toString().padStart(2, '0');
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleManualAdd = async () => {
        if (!description.trim()) return toast.error("Please enter a description.");
                               
        const start = manualStartTime ? new Date(manualStartTime) : new Date(Date.now() - 3600000);
        const end = manualEndTime ? new Date(manualEndTime) : new Date();
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return toast.error("Invalid date in start or end time");
        }
        
        if (end <= start) {
            return toast.error("End time must be after start time");
        }
        
        const durationSeconds = Math.floor((end - start) / 1000);
        
        let finalProjectId = projectId;
        if (!finalProjectId) {
            const defaultProj = await getDefaultProject();
            finalProjectId = defaultProj.id;
            setProjectId(finalProjectId);
        }
        
        try {
            await db.timeEntries.add({
                description: description.trim(),
                projectId: Number(finalProjectId),
                startTime: start,
                endTime: end,
                duration: durationSeconds,
            });
            if (finalProjectId) {
                await logTimeToProjectGoals(finalProjectId, durationSeconds);
            }
            setDescription('');
            setManualStartTime('');
            setManualEndTime('');
            setManualDurationInput('01:00:00');
            toast.success("Time entry logged!");
        } catch (error) {
            console.error("Failed to log time entry:", error);
            toast.error("Failed to log entry.");
        }
    };

    return (
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4 mb-6">
            <input
                type="text"
                placeholder="What are you working on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex-grow min-w-[250px] p-2 rounded-md bg-secondary text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                disabled={!!activeTimer}
            />
            <select value={projectId || ''} onChange={e => setProjectId(Number(e.target.value))} className="p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none" disabled={!!activeTimer}>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!activeTimer && (
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Start</label>
                            <input
                                type="datetime-local"
                                value={manualStartTime || formatForInput(new Date(Date.now() - 3600000))}
                                onChange={(e) => setManualStartTime(e.target.value)}
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">End</label>
                            <input
                                type="datetime-local"
                                value={manualEndTime || formatForInput(new Date())}
                                onChange={(e) => setManualEndTime(e.target.value)}
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Duration</label>
                            <input
                                type="text"
                                value={manualDurationInput}
                                onChange={handleDurationChange}
                                onBlur={handleDurationBlur}
                                placeholder="hh:mm:ss"
                                className="w-full p-2 rounded bg-secondary text-foreground"
                            />
                        </div>
                    </div>
                </div>
            )}
            <div className="flex items-center gap-4">
                <div className="text-2xl font-mono text-foreground w-28 text-center bg-muted p-2 rounded">
                    {formatDuration(duration)}
                </div>
                {activeTimer ? (
                    <button onClick={handleStopTimer} className="bg-destructive hover:opacity-90 text-destructive-foreground p-2 px-6 rounded-md">
                        Stop
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleStartTimer()} className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-6 rounded-md">
                            Start
                        </button>
                        <button
                           onClick={handleManualAdd}
                           className="bg-secondary hover:bg-border text-foreground p-2 px-4 rounded-md"
                        >
                           Log
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};