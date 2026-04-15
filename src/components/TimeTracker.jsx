import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { durationToSeconds, formatDuration } from '../utils/duration';
import { getDefaultProject } from '../db/db';
import toast from 'react-hot-toast';
import { normalizeId } from '../db/id-utils';
import { api } from '../api/apiClient';
import { useProjects, useGoals } from '../hooks/useAppData';
import { postServiceWorkerCommand } from '../utils/serviceWorkerClient';

export const TimeTracker = forwardRef(({ activeTimer, setActiveTimer, activeGoalId, clearActiveGoalId, initialEvent, onEventConsumed }, ref) => {
    const queryClient = useQueryClient();
    const { data: projects = [] } = useProjects();
    const { data: goals = [] } = useGoals();
    const [description, setDescription] = useState('');
    const [projectId, setProjectId] = useState('');
    const [goalId, setGoalId] = useState('');
    const [duration, setDuration] = useState(0);
    const [manualStartTime, setManualStartTime] = useState('');
    const [manualEndTime, setManualEndTime] = useState('');
    const [manualDurationInput, setManualDurationInput] = useState('01:00:00');
    const [trackedEventId, setTrackedEventId] = useState(null);
    const intervalRef = useRef(null);
    const stopInFlightRef = useRef(false);
    const goalStartInFlightRef = useRef(null);

    const getPomodoroDuration = useCallback((timer) => {
        const accumulatedSeconds = Number(timer?.accumulatedSeconds) || 0;
        const segmentStart = timer?.segmentStart ? Number(timer.segmentStart) : null;
        if (!segmentStart) {
            return accumulatedSeconds;
        }
        return accumulatedSeconds + Math.max(0, Math.floor((Date.now() - segmentStart) / 1000));
    }, []);

    const getTimerDuration = useCallback((timer) => {
        if (!timer) return 0;
        if (timer.origin === 'pomodoro') {
            return getPomodoroDuration(timer);
        }

        const hasTrackedSegments =
            timer.segmentStart !== undefined ||
            timer.accumulatedSeconds !== undefined ||
            timer.status !== undefined;

        if (!hasTrackedSegments) {
            return Math.max(0, Math.floor((Date.now() - timer.startTime) / 1000));
        }

        const accumulatedSeconds = Number(timer.accumulatedSeconds) || 0;
        const segmentStart = timer?.segmentStart ? Number(timer.segmentStart) : null;
        if (!segmentStart) {
            return accumulatedSeconds;
        }

        return accumulatedSeconds + Math.max(0, Math.floor((Date.now() - segmentStart) / 1000));
    }, [getPomodoroDuration]);

    const isPaused = !!activeTimer && activeTimer.status === 'paused';

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
        
        // Store the last used project in localStorage
        if (pId) {
            localStorage.setItem('lastUsedProjectId', pId.toString());
        }
        
        const startedAt = Date.now();
        const resolvedGoalId = timerData?.goalId ?? activeGoalId ?? (goalId && goalId !== 'none' ? goalId : null);
        const newTimer = {
            description: desc.trim(),
            projectId: normalizeId(pId),
            startTime: startedAt,
            goalId: resolvedGoalId,
            eventId: timerData?.eventId ?? trackedEventId ?? null,
            origin: timerData?.origin || 'manual',
            status: 'running',
            accumulatedSeconds: 0,
            segmentStart: startedAt,
            // Generate a best-effort session key without requiring DB schema changes
            sessionId: (() => {
                try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch {}
                return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            })(),
        };
        setActiveTimer(newTimer);
        if (resolvedGoalId && typeof clearActiveGoalId === 'function') {
            clearActiveGoalId();
        }
        toast.success("Timer started!");
        // If this timer started from an event, clear the pending event so it doesn't auto-trigger again
        if ((timerData?.eventId ?? trackedEventId) && typeof onEventConsumed === 'function') {
            onEventConsumed();
        }

        // Sync browser timer to Firebase so Discord bot knows a timer is active
        const project = projects?.find(p => String(p.id) === String(pId));
        const goal = resolvedGoalId ? goals?.find(g => String(g.id) === String(resolvedGoalId)) : null;
        api.discordTimer.start({
            description: newTimer.description,
            projectId: newTimer.projectId,
            projectName: project?.name || null,
            goalId: resolvedGoalId || null,
            goalName: goal?.description || null,
            startTime: startedAt,
            sessionId: newTimer.sessionId,
        }).catch(() => {}); // Fire-and-forget; server may be offline
    }, [description, projectId, goalId, projects, goals, activeGoalId, setActiveTimer, trackedEventId, onEventConsumed, clearActiveGoalId]);

    // Expose handleStartTimer to parent component via ref
    useImperativeHandle(ref, () => ({
        handleStartTimer
    }), [handleStartTimer]);

    useEffect(() => {
        if (initialEvent) {
            const desc = initialEvent.title || 'From Calendar Event';
            const projId = initialEvent.projectId;

            setDescription(desc);
            if (projId) setProjectId(projId);
            setTrackedEventId(initialEvent.id);

            // Automatically start the timer only if no active timer is running
            if (!activeTimer) {
                handleStartTimer({ description: desc, projectId: projId, eventId: initialEvent.id });
            } else {
                toast.error('Stop the current timer first');
            }
        }
    }, [initialEvent, handleStartTimer, activeTimer]);

    useEffect(() => {
        if (projects && projects.length > 0 && !projectId) {
            // Try to use last used project from localStorage
            const lastUsedProjectId = localStorage.getItem('lastUsedProjectId');
            if (lastUsedProjectId) {
                const lastUsedProject = projects.find(p => String(p.id) === String(lastUsedProjectId));
                if (lastUsedProject) {
                    setProjectId(lastUsedProject.id);
                    return;
                }
            }
            // Fallback to first project
            setProjectId(projects[0].id);
        }
    }, [projects, projectId]);

    useEffect(() => {
        if (activeGoalId && projects && !activeTimer) {
            if (goalStartInFlightRef.current === activeGoalId) {
                return;
            }

            goalStartInFlightRef.current = activeGoalId;
            let cancelled = false;

            const initGoalTimer = async () => {
                const goal = await api.goals.get(activeGoalId);
                if (cancelled) return;

                if (goal) {
                    setDescription(goal.description);
                    setGoalId(String(goal.id));
                    if (goal.projectId) {
                        setProjectId(goal.projectId);
                    } else {
                        const defaultProj = await getDefaultProject();
                        if (cancelled) return;
                        setProjectId(defaultProj.id);
                    }
                    await handleStartTimer({
                        description: goal.description,
                        projectId: goal.projectId,
                        goalId: goal.id,
                    });
                }
            };

            initGoalTimer().finally(() => {
                if (goalStartInFlightRef.current === activeGoalId) {
                    goalStartInFlightRef.current = null;
                }
            });

            return () => {
                cancelled = true;
            };
        }
    }, [activeGoalId, projects, activeTimer, handleStartTimer]);

    useEffect(() => {
        if (activeTimer) {
            setDescription(activeTimer.description);
            setProjectId(activeTimer.projectId || '');
            setTrackedEventId(activeTimer.eventId || null);
            clearInterval(intervalRef.current);

            if (
                activeTimer.origin === 'pomodoro' ||
                activeTimer.segmentStart !== undefined ||
                activeTimer.accumulatedSeconds !== undefined ||
                activeTimer.status !== undefined
            ) {
                setDuration(getTimerDuration(activeTimer));
                if (activeTimer.segmentStart) {
                    intervalRef.current = setInterval(() => {
                        setDuration(getTimerDuration(activeTimer));
                    }, 1000);
                }
            } else {
                setDuration(Math.max(0, Math.floor((Date.now() - activeTimer.startTime) / 1000)));
                intervalRef.current = setInterval(() => {
                    setDuration(d => d + 1);
                }, 1000);
            }
        } else {
            clearInterval(intervalRef.current);
            setDuration(0);
            setDescription('');
            setTrackedEventId(null);
        }
        return () => clearInterval(intervalRef.current);
    }, [activeTimer, getTimerDuration]);

    useEffect(() => {
        if (!activeTimer) {
            stopInFlightRef.current = false;
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



    const handleDurationBlur = () => {
        const parsed = durationToSeconds(manualDurationInput.trim());

        if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
            // Reset to safe default (1 hour) and keep start/end consistent
            const fallbackSeconds = 3600;
            setManualDurationInput(formatDuration(fallbackSeconds));

            const startDate = manualStartTime ? new Date(manualStartTime) : new Date();
            const validStart = !isNaN(startDate.getTime()) ? startDate : new Date();
            const endDate = new Date(validStart.getTime() + fallbackSeconds * 1000);

            setManualStartTime(formatForInput(validStart));
            setManualEndTime(formatForInput(endDate));
            return;
        }

        // Format back to HH:MM:SS
        setManualDurationInput(formatDuration(parsed));

        // Update start/end times so they stay in sync with duration
        const startDate = manualStartTime ? new Date(manualStartTime) : new Date();
        const validStart = !isNaN(startDate.getTime()) ? startDate : new Date();
        const endDate = new Date(validStart.getTime() + parsed * 1000);

        setManualStartTime(formatForInput(validStart));
        setManualEndTime(formatForInput(endDate));
    };

    const handlePauseResumeTimer = async () => {
        if (!activeTimer) return;

        if (activeTimer.origin === 'pomodoro') {
            await postServiceWorkerCommand(
                isPaused ? 'start' : 'pause'
            );
            return;
        }

        if (isPaused) {
            const resumedAt = Date.now();
            setActiveTimer({
                ...activeTimer,
                status: 'running',
                segmentStart: resumedAt,
            });
            return;
        }

        setActiveTimer({
            ...activeTimer,
            status: 'paused',
            accumulatedSeconds: getTimerDuration(activeTimer),
            segmentStart: null,
        });
    };

    const handleStopTimer = async () => {
        if (!activeTimer || stopInFlightRef.current) return;
        stopInFlightRef.current = true;

        if (activeTimer.origin === 'pomodoro') {
            await postServiceWorkerCommand('reset', { mode: 'pomodoro' });
            return;
        }

        if (activeTimer.origin === 'discord') {
            try {
                await api.discordTimer.stop();
                await queryClient.invalidateQueries();
                toast.success("Discord timer stopped!");
                setActiveTimer(null);
            } catch (error) {
                console.error("Failed to stop Discord timer:", error);
                toast.error("Failed to stop Discord timer.");
            } finally {
                stopInFlightRef.current = false;
            }
            return;
        }

        try {
            const endTime = Date.now();
            const finalDuration = getTimerDuration(activeTimer);

            // Build the time entry object that will be persisted regardless of whether this
            // timer is linked to a goal or not. Linking the goalId allows us to keep an
            // audit trail of the work that contributed to the goal while still showing up
            // in the generic time-entry list.
            const entry = {
                description: activeTimer.description,
                projectId: activeTimer.projectId,
                goalId: activeTimer.goalId || null,
                startTime: new Date(activeTimer.startTime),
                endTime: new Date(endTime),
                duration: finalDuration,
                eventId: trackedEventId,
                // sessionId is kept on the timer for dedupe against Pomodoro auto-log via localStorage guard
                sessionId: activeTimer.sessionId || null,
            };

            // Idempotency without schema changes: prefer a localStorage guard using sessionId.
            let shouldInsert = true;
            if (entry.sessionId) {
                const guardKey = `timeEntryLogged:${entry.sessionId}`;
                try {
                    if (localStorage.getItem(guardKey) === '1') shouldInsert = false;
                } catch {}
            }
            if (shouldInsert) {
                // Additional soft dedupe: look for a same-start same-duration same-context entry
                const entriesAtStart = await api.timeEntries.list({ startTime: entry.startTime.toISOString() });
                const candidate = entriesAtStart.find((e) => {
                    const sameDur = Number(e.duration) === Number(entry.duration);
                    const sameDesc = String(e.description || '') === String(entry.description || '');
                    const sameProj = String(e.projectId || '') === String(entry.projectId || '');
                    const sameGoal = String(e.goalId || '') === String(entry.goalId || '');
                    const sameEvt = String(e.eventId || '') === String(entry.eventId || '');
                    return sameDur && sameDesc && sameProj && sameGoal && sameEvt;
                });
                if (candidate) {
                    shouldInsert = false;
                }
            }
            if (shouldInsert) {
                await api.timeEntries.create(entry);
                await queryClient.invalidateQueries();
            }

            if (shouldInsert) {
                if (activeTimer.goalId) {
                    toast.success("Time logged!");
                } else {
                    toast.success("Time entry saved!");
                }
                if (entry.sessionId) {
                    try { localStorage.setItem(`timeEntryLogged:${entry.sessionId}`, '1'); } catch {}
                }
            } else {
                toast('Session already logged', { icon: 'ℹ️' });
            }

            setActiveTimer(null);

            // Clear Firebase timer state so Discord bot sees no active timer
            api.discordTimer.clear().catch(() => {});
        } catch (error) {
            console.error("Failed to save time entry:", error);
            toast.error("Failed to save time entry.");
        } finally {
            stopInFlightRef.current = false;
        }
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
        
        const resolvedGoalId = goalId && goalId !== 'none' ? normalizeId(goalId) : null;
        try {
            await api.timeEntries.create({
                description: description.trim(),
                projectId: normalizeId(finalProjectId),
                goalId: resolvedGoalId,
                startTime: start,
                endTime: end,
                duration: durationSeconds,
            });
            await queryClient.invalidateQueries();
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
            <select 
                value={projectId || ''} 
                onChange={e => {
                    const newProjectId = e.target.value;
                    setProjectId(newProjectId);
                    setGoalId(''); // Reset goal when project changes
                    // Store the last used project
                    if (newProjectId) {
                        localStorage.setItem('lastUsedProjectId', newProjectId.toString());
                    }
                }} 
                className="p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none" 
                disabled={!!activeTimer}
            >
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
                value={goalId || 'none'}
                onChange={e => setGoalId(e.target.value)}
                className="p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none min-w-[180px]"
                disabled={!!activeTimer}
                title="Link to goal (for progress tracking)"
            >
                <option value="none">No goal</option>
                {(goals || [])
                    .filter(g => !projectId || String(g.projectId || '') === String(projectId))
                    .map(g => (
                        <option key={g.id} value={g.id}>{g.description}</option>
                    ))}
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
                    <div className="flex items-center gap-2">
                        {activeTimer.origin !== 'discord' && (
                            <button
                                onClick={handlePauseResumeTimer}
                                className="bg-secondary hover:bg-border text-foreground p-2 px-4 rounded-md"
                            >
                                {isPaused ? 'Resume' : 'Pause'}
                            </button>
                        )}
                        <button onClick={handleStopTimer} className="bg-destructive hover:opacity-90 text-destructive-foreground p-2 px-6 rounded-md">
                            Stop
                        </button>
                    </div>
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
});