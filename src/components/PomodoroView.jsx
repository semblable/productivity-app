import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotifications } from '../hooks/useNotifications';
import { useGoals, useProjects, useTasks } from '../hooks/useAppData';
import { postServiceWorkerCommand } from '../utils/serviceWorkerClient';

const PomodoroView = () => {
    const [settings, setSettings] = useState(() => {
        const fallbackSettings = {
            pomodoro: 25,
            shortBreak: 5,
            longBreak: 15,
            longBreakInterval: 4,
        };
        try {
            const savedSettings = localStorage.getItem('pomodoroSettings');
            if (!savedSettings) {
                return fallbackSettings;
            }

            const parsed = JSON.parse(savedSettings);
            return {
                pomodoro: Number(parsed?.pomodoro) || fallbackSettings.pomodoro,
                shortBreak: Number(parsed?.shortBreak) || fallbackSettings.shortBreak,
                longBreak: Number(parsed?.longBreak) || fallbackSettings.longBreak,
                longBreakInterval: Number(parsed?.longBreakInterval) || fallbackSettings.longBreakInterval,
            };
        } catch (error) {
            console.error('Failed to parse pomodoroSettings from localStorage', error);
            localStorage.removeItem('pomodoroSettings');
            return fallbackSettings;
        }
    });

    // This state is now a mirror of the service worker's state.
    const [pomodoroState, setPomodoroState] = useState({
        mode: 'pomodoro',
        timeLeft: settings.pomodoro * 60,
        status: 'idle',
        pomodoros: 0,
    });

    const [selectedTarget, setSelectedTarget] = useState(() => {
        try {
            return localStorage.getItem('pomodoroSelectedTarget') || 'none';
        } catch {
            return 'none';
        }
    });
    const { requestNotificationPermission } = useNotifications();

    const { data: goals = [] } = useGoals();
    const { data: projects = [] } = useProjects();
    const { data: allTasks = [] } = useTasks({ _orderBy: 'createdAt DESC', _limit: 200 });
    const tasks = allTasks.filter((task) => !task.completed);

    const projectMap = projects?.reduce((acc, p) => { acc[String(p.id)] = p; return acc; }, {}) ?? {};
    const goalMap = goals?.reduce((acc, g) => { acc[String(g.id)] = g; return acc; }, {}) ?? {};

    const sendServiceWorkerCommand = useCallback(async (command, data) => {
        const posted = await postServiceWorkerCommand(command, data);
        if (!posted) {
            toast.error('Pomodoro timer is still initializing. Please try again.');
        }
        return posted;
    }, []);

    // Reset selectedTarget if the referenced entity has been deleted
    useEffect(() => {
        if (selectedTarget === 'none' || !goals || !projects || !tasks) return;
        const [kind, idStr] = selectedTarget.split(':');
        const id = String(idStr);
        let exists = false;
        if (kind === 'goal') exists = goals.some(g => String(g.id) === id);
        else if (kind === 'project') exists = projects.some(p => String(p.id) === id);
        else if (kind === 'task') exists = tasks.some(t => String(t.id) === id);
        if (!exists) {
            setSelectedTarget('none');
            try { localStorage.setItem('pomodoroSelectedTarget', 'none'); } catch { }
            toast.error('Pomodoro target was removed. Time logging disabled.');
        }
    }, [goals, projects, tasks, selectedTarget]);

    // On component mount, request notification permissions and send current settings to the service worker.
    useEffect(() => {
        requestNotificationPermission();
        void postServiceWorkerCommand('updateSettings', { settings });
    }, [requestNotificationPermission, settings]);

    // This effect sets up the communication channel with the service worker.
    useEffect(() => {
        if (!('serviceWorker' in navigator)) {
            console.error('Service Worker not supported');
            return;
        }

        const handleMessage = (event) => {
            const { type, ...newState } = event.data;
            if (type === 'status') {
                // console.log('[PomodoroView] status message', newState);
                setPomodoroState(currentState => ({
                    ...currentState,
                    status: newState.timerState, // Note the property name change
                    timeLeft: newState.timeLeft,
                    mode: newState.mode,
                    pomodoros: newState.pomodoros,
                }));
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        // Keep polling until a controller exists, then get one status update and stop polling.
        const statusInterval = setInterval(() => {
            void postServiceWorkerCommand('getStatus').then((posted) => {
                if (posted) {
                    clearInterval(statusInterval);
                }
            });
        }, 100);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            clearInterval(statusInterval);
        };
    }, []);

    const { mode, timeLeft, status } = pomodoroState;

    // Track productive seconds while a pomodoro is running
    const lastTimeRef = useRef(timeLeft);

    useEffect(() => {
        // Local tracking only; removed external reward integration
        lastTimeRef.current = timeLeft;
    }, [status, mode, timeLeft]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [tempSettings, setTempSettings] = useState(settings);

    const formatTime = useCallback((seconds) => {
        if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }, []);

    // Tell the service worker to switch modes.
    const switchMode = useCallback((newMode) => {
        void sendServiceWorkerCommand('reset', { mode: newMode });
    }, [sendServiceWorkerCommand]);

    // Immediately update local state when changing modes, so UI responds even if the service worker hasn't started yet.
    const changeMode = useCallback((newMode) => {
        // console.log('[PomodoroView] changeMode requested', newMode);
        setPomodoroState(prev => ({
            ...prev,
            mode: newMode,
            timeLeft: (settings[newMode] || 25) * 60,
            status: 'idle',
        }));

        switchMode(newMode);
    }, [settings, switchMode]);

    useEffect(() => {
        const appTitle = 'Momentum Planner';
        document.title = `${formatTime(timeLeft)} - ${mode} | ${appTitle}`;

        return () => {
            document.title = appTitle;
        };
    }, [timeLeft, mode, formatTime]);

    const handleSettingsChange = (e) => {
        const { name, value } = e.target;
        setTempSettings(prev => ({ ...prev, [name]: value }));
    };

    const openSettings = () => {
        setTempSettings(settings);
        setIsSettingsOpen(true);
    }

    const applySettings = (e) => {
        e.preventDefault();
        const newSettings = {
            pomodoro: parseInt(tempSettings.pomodoro, 10) || 25,
            shortBreak: parseInt(tempSettings.shortBreak, 10) || 5,
            longBreak: parseInt(tempSettings.longBreak, 10) || 15,
            longBreakInterval: parseInt(tempSettings.longBreakInterval, 10) || 4,
        };
        setSettings(newSettings);
        localStorage.setItem('pomodoroSettings', JSON.stringify(newSettings));

        // Send the new settings to the service worker.
        void sendServiceWorkerCommand('updateSettings', { settings: newSettings });

        setIsSettingsOpen(false);
        toast.success("Settings saved!");
    }

    const ModeButton = ({ modeName, children }) => (
        <button
            onClick={() => changeMode(modeName)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${mode === modeName ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-border'}`}
        >
            {children}
        </button>
    );

    const handleTargetChange = (e) => {
        const value = e.target.value;
        setSelectedTarget(value);
        try { localStorage.setItem('pomodoroSelectedTarget', value); } catch { }
    };

    // Tell the service worker to start or pause the timer.
    const toggleTimer = () => {
        const command = status === 'running' ? 'pause' : 'start';
        void sendServiceWorkerCommand(command);
    };

    // Tell the service worker to reset the timer for the current mode.
    const handleReset = useCallback(() => {
        void sendServiceWorkerCommand('reset', { mode });
    }, [mode, sendServiceWorkerCommand]);

    // Time tracking integration is handled globally in App; PomodoroView only manages UI and selection persistence.


    return (
        <div className="flex flex-col items-center justify-center p-4 bg-background text-foreground max-w-md mx-auto rounded-lg shadow-lg">
            <div className="w-full mb-4">
                <div className="flex justify-center space-x-2 relative z-10">
                    <ModeButton modeName="pomodoro">Pomodoro</ModeButton>
                    <ModeButton modeName="shortBreak">Short Break</ModeButton>
                    <ModeButton modeName="longBreak">Long Break</ModeButton>
                </div>
            </div>

            <div className="text-8xl font-bold my-8 tabular-nums">
                {formatTime(timeLeft)}
            </div>

            <div className="flex items-center space-x-4">
                <button
                    onClick={toggleTimer}
                    className="p-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-transform transform hover:scale-105"
                    aria-label={status === 'running' ? 'Pause timer' : 'Start timer'}
                >
                    {status === 'running' ? <Pause size={32} /> : <Play size={32} />}
                </button>
                <button
                    onClick={handleReset}
                    className="p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-border transition-transform transform hover:scale-105"
                    aria-label="Reset timer"
                >
                    <RotateCcw size={24} />
                </button>
                <button
                    onClick={openSettings}
                    className="p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-border transition-transform transform hover:scale-105"
                    aria-label="Settings"
                >
                    <Settings size={24} />
                </button>
            </div>

            <div className="mt-6 w-full">
                <label htmlFor="pomodoro-target" className="block text-sm font-medium text-muted-foreground mb-1">
                    Log this pomodoro to:
                </label>
                <select
                    id="pomodoro-target"
                    value={selectedTarget}
                    onChange={handleTargetChange}
                    className="w-full p-2 bg-input border border-border rounded-md"
                    disabled={status === 'running'}
                >
                    <option value="none">Don't log time</option>
                    <optgroup label="Goals">
                        {goals?.map(goal => {
                            const proj = goal.projectId ? projectMap[String(goal.projectId)] : null;
                            const label = proj ? `${goal.description} (${proj.name})` : goal.description;
                            return <option key={`goal-${goal.id}`} value={`goal:${goal.id}`}>{label}</option>;
                        })}
                    </optgroup>
                    <optgroup label="Projects">
                        {projects?.map(project => <option key={`project-${project.id}`} value={`project:${project.id}`}>{project.name}</option>)}
                    </optgroup>
                    <optgroup label="Tasks">
                        {tasks?.map(task => {
                            const proj = task.projectId ? projectMap[String(task.projectId)] : null;
                            const goal = task.goalId ? goalMap[String(task.goalId)] : null;
                            const context = [proj?.name, goal?.description].filter(Boolean).join(' · ');
                            const label = context ? `${task.text} (${context})` : task.text;
                            return <option key={`task-${task.id}`} value={`task:${task.id}`}>{label}</option>;
                        })}
                    </optgroup>
                </select>
            </div>

            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className="bg-card p-6 rounded-lg shadow-2xl w-full max-w-sm">
                        <h2 className="text-xl font-bold mb-4">Timer Settings</h2>
                        <form onSubmit={applySettings}>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="pomodoro" className="block text-sm">Pomodoro (min)</label>
                                    <input type="number" name="pomodoro" id="pomodoro" value={tempSettings.pomodoro} onChange={handleSettingsChange} className="w-full p-2 bg-input border rounded mt-1" />
                                </div>
                                <div>
                                    <label htmlFor="shortBreak" className="block text-sm">Short Break (min)</label>
                                    <input type="number" name="shortBreak" id="shortBreak" value={tempSettings.shortBreak} onChange={handleSettingsChange} className="w-full p-2 bg-input border rounded mt-1" />
                                </div>
                                <div>
                                    <label htmlFor="longBreak" className="block text-sm">Long Break (min)</label>
                                    <input type="number" name="longBreak" id="longBreak" value={tempSettings.longBreak} onChange={handleSettingsChange} className="w-full p-2 bg-input border rounded mt-1" />
                                </div>
                                <div>
                                    <label htmlFor="longBreakInterval" className="block text-sm">Pomodoros until long break</label>
                                    <input type="number" name="longBreakInterval" id="longBreakInterval" value={tempSettings.longBreakInterval} onChange={handleSettingsChange} className="w-full p-2 bg-input border rounded mt-1" />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 mt-6">
                                <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 bg-secondary rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PomodoroView;