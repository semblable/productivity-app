import { useState, useEffect, useRef } from 'react';
// Import React Router components
import {
  BrowserRouter as Router,
  NavLink,
  useNavigate,
} from 'react-router-dom';
// Removed react-toastify in favor of react-hot-toast
import { useLiveQuery } from 'dexie-react-hooks';
import { RRule } from 'rrule';
import { format } from 'date-fns';
import { Toaster as HotToaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// Import all views and components
import { AddEventModal } from './components/AddEventModal';
import { db } from './db/db';
import { FocusView } from './components/FocusView';
import { WeeklyReview } from './components/WeeklyReview';
import { useNotifications } from './hooks/useNotifications';
import { ThemeToggle } from './components/ThemeToggle';
import IvyLeeView from './components/IvyLeeView';
import IvyLeePlanner from './components/IvyLeePlanner';
import { AppRoutes } from './AppRoutes';
import { checkBrokenStreaks } from './db/habit-utils';
import { ProjectManager } from './components/ProjectManager';
import UserGuide from './components/UserGuide';
import { AppProvider, useAppContext } from './context/AppContext';
import { logTimeToProjectGoals, logTimeToGoal } from './db/time-entry-utils';


// A wrapper component to contain the main layout and navigation
function AppLayout() {
    const navigate = useNavigate();
    const { appState, setState } = useAppContext();
  const { focusTaskId, showWeeklyReview, isModalOpen, modalEventData, showUserGuide } = appState;

    const recurrenceCheckInProgress = useRef(false);

    // --- Hooks ---
    const { requestNotificationPermission, hasNotificationPermission } = useNotifications();
    
    const projects = useLiveQuery(() => db.projects.toArray());

    useEffect(() => {
        handleRecurrence();
        checkBrokenStreaks();
    }, []);

  // Global listener for Pomodoro SW status to coordinate time tracking even when on other routes
  const lastStatusRef = useRef({ mode: null, timerState: null, pomodoros: -1 });
  const trackingRef = useRef({ active: false, pomodoroCount: -1 });
  const appStateRef = useRef(appState);

  useEffect(() => {
      appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
      if (!('serviceWorker' in navigator)) return;

      const handleMessage = async (event) => {
          const { type, mode, timerState, pomodoros } = event.data || {};
          if (type !== 'status') return;

          const prev = lastStatusRef.current;
          const curr = { mode, timerState, pomodoros };
          const isPomodoro = mode === 'pomodoro';
          const isRunning = timerState === 'running';
          const activeTimer = appStateRef.current.activeTimer;
          const hasNonPomodoroTimer = !!activeTimer && activeTimer.origin !== 'pomodoro';

          const enteringRunningPomodoro = isPomodoro && isRunning && !(prev.mode === 'pomodoro' && prev.timerState === 'running');

          // If a non-pomodoro timer is running, never auto-start/stop
          if (hasNonPomodoroTimer) {
              lastStatusRef.current = curr;
              return;
          }

          // Ensure trackingRef reflects persisted activeTimer on mount
          if (!trackingRef.current.active && activeTimer && activeTimer.origin === 'pomodoro') {
              trackingRef.current.active = true;
              trackingRef.current.pomodoroCount = pomodoros;
          }

          // Start when entering running Pomodoro and not already tracking
          if (enteringRunningPomodoro && !trackingRef.current.active) {
              try {
                  const selectedTarget = localStorage.getItem('pomodoroSelectedTarget') || 'none';
                  if (selectedTarget === 'none') {
                      lastStatusRef.current = curr;
                      return;
                  }
                  // Build context
                  let description = 'Pomodoro';
                  let projectId = null;
                  let goalId = null;
                  let taskId = null;

                  const [kind, idStr] = selectedTarget.split(':');
                  const id = idStr;
                  if (kind === 'goal' && id) {
                      const goal = await db.goals.get(id);
                      if (goal) {
                          description = `Pomodoro - ${goal.description}`;
                          goalId = goal.id;
                          projectId = goal.projectId || null;
                      }
                  } else if (kind === 'project' && id) {
                      const proj = await db.projects.get(id);
                      if (proj) {
                          description = `Pomodoro - ${proj.name}`;
                          projectId = proj.id;
                      }
                  } else if (kind === 'task' && id) {
                      const task = await db.tasks.get(id);
                      if (task) {
                          description = `Pomodoro - ${task.text}`;
                          taskId = task.id;
                          projectId = task.projectId || null;
                      }
                  }

                  setState({
                      activeTimer: {
                          description,
                          projectId,
                          goalId,
                          taskId,
                          startTime: Date.now(),
                          origin: 'pomodoro',
                      }
                  });
                  trackingRef.current.active = true;
                  trackingRef.current.pomodoroCount = pomodoros;
                  toast.success('Started tracking Pomodoro');
              } catch {}
          }

          // Finalize when Pomodoro no longer running or mode changes (break/reset)
          if (trackingRef.current.active && (!isPomodoro || !isRunning)) {
              const active = appStateRef.current.activeTimer;
              if (active && active.origin === 'pomodoro') {
                  const endMs = Date.now();
                  const duration = Math.max(0, Math.floor((endMs - (active.startTime || endMs)) / 1000));
                  if (duration > 0) {
                      try {
                          await db.timeEntries.add({
                              description: active.description,
                              projectId: active.projectId || null,
                              goalId: active.goalId || null,
                              taskId: active.taskId || null,
                              startTime: new Date(active.startTime),
                              endTime: new Date(endMs),
                              duration,
                          });
                          if (active.projectId) {
                              await logTimeToProjectGoals(active.projectId, duration, active.goalId || null);
                          }
                          if (active.goalId) {
                              await logTimeToGoal(active.goalId, duration);
                          }
                          toast.success('Pomodoro time logged');
                      } catch (e) {
                          console.error('Failed to log Pomodoro time:', e);
                          toast.error('Failed to log Pomodoro time');
                      }
                  }
              }
              setState({ activeTimer: null });
              trackingRef.current.active = false;
              trackingRef.current.pomodoroCount = -1;
          }

          lastStatusRef.current = curr;
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      navigator.serviceWorker.controller?.postMessage({ command: 'getStatus' });
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [setState]);

    useEffect(() => {
        if (appState.activeTimer) {
            localStorage.setItem('activeTimer', JSON.stringify(appState.activeTimer));
        } else {
            localStorage.removeItem('activeTimer');
        }
    }, [appState.activeTimer]);

    // --- Global Keyboard Shortcuts ---
    useEffect(() => {
        const sequenceRef = { key: null, time: 0 };

        const handleKeyDown = (e) => {
            const tag = e.target.tagName;
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
            if (isTyping) return; // Ignore when typing in inputs

            // Ctrl + .  (period) → New Task
            if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '.') {
                e.preventDefault();
                navigate('/todo');
                // Wait for view render then focus input
                setTimeout(() => {
                    const input = document.querySelector('input[placeholder="Add new task..."]');
                    if (input) input.focus();
                }, 50);
                return;
            }

            // Ctrl + , (comma) → New Note
            if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === ',') {
                e.preventDefault();
                navigate('/notes');
                setTimeout(() => {
                    const newNoteBtn = document.querySelector('button');
                    if (newNoteBtn && newNoteBtn.textContent?.toLowerCase().includes('new note')) {
                        newNoteBtn.click();
                    }
                }, 50);
                return;
            }

            // Two-key sequences starting with "t"
            const now = Date.now();
            if (sequenceRef.key && now - sequenceRef.time > 800) {
                sequenceRef.key = null;
            }

            if (!sequenceRef.key && e.key.toLowerCase() === 't') {
                sequenceRef.key = 't';
                sequenceRef.time = now;
                return;
            }

            if (sequenceRef.key === 't') {
                if (e.key.toLowerCase() === 'p') {
                    // T then P → Pomodoro
                    navigate('/pomodoro');
                } else if (e.key.toLowerCase() === 'i') {
                    // T then I → Ivy Lee
                    navigate('/today');
                }
                sequenceRef.key = null;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate, setState]);

    const handleStartGoalTimer = (goal) => {
        setState({ activeGoalId: goal.id });
        navigate('/tracker');
    };

    const handleStartFocus = async (taskId) => {
        const task = await db.tasks.get(taskId);
        if (task && task.goalId) {
            const goal = await db.timeGoals.get(task.goalId);
            if (goal) {
                handleStartGoalTimer(goal);
            } else {
                // Fallback to focus view if goal not found
                setState({ focusTaskId: taskId });
            }
        } else {
            setState({ focusTaskId: taskId });
        }
    };

    const handleRecurrence = async () => {
        if (recurrenceCheckInProgress.current) {
            return;
        }
        recurrenceCheckInProgress.current = true;

        try {

        const now = new Date();
        const lookahead = new Date();
        lookahead.setDate(now.getDate() + 7);

        const processRecurrence = async (item, type) => {
            const isEvent = type === 'event';
            if (!item.rrule || (isEvent && item.parentId) || (!isEvent && item.templateId)) return;

            const dbTable = isEvent ? db.events : db.tasks;
            const startTimeField = isEvent ? 'startTime' : 'createdAt';
            
            try {
                const ruleOptions = RRule.parseString(item.rrule);
                const rule = new RRule(ruleOptions);

                const occurrences = rule.between(now, lookahead, true); // inc = true

                for (const occurrence of occurrences) {
                    const occTime = occurrence.getTime();

                    // Skip creating an instance if it matches the parent's start time
                    if (new Date(item[startTimeField]).getTime() === occTime) {
                        continue;
                    }

                    // Check if an instance already exists for this exact time
                    // Use templateId + occurrence time to detect duplicates without parentId
                    const exists = await dbTable.where('templateId').equals(item.id)
                        .filter(child => new Date(child[startTimeField]).getTime() === occTime)
                        .first();

                    if (!exists) {
                        const newItem = {
                            ...item,
                            id: undefined,
                            templateId: item.id, // Track template without parentId hierarchy
                            rrule: null, // Remove rrule from instances
                        };
                        newItem[startTimeField] = occurrence;

                        if (isEvent) {
                            const duration = new Date(item.endTime).getTime() - new Date(item.startTime).getTime();
                            newItem.endTime = new Date(occurrence.getTime() + duration);
                            newItem.parentId = item.id; // link instance back to parent for bulk operations
                        } else {
                            newItem.dueDate = occurrence;
                            newItem.completed = false;
                        }
                        
                        await dbTable.add(newItem);
                    }
                }
            } catch (error) {
                console.error(`Error processing recurring ${type}:`, item, error);
            }
        };

        const recurringTasks = await db.tasks.filter(task => !!task.rrule && !task.templateId).toArray();
        const recurringEvents = await db.events.filter(event => !!event.rrule && !event.templateId).toArray();
        
        for (const task of recurringTasks) {
            await processRecurrence(task, 'task');
        }

        for (const event of recurringEvents) {
            await processRecurrence(event, 'event');
        }

        } catch (err) {
            console.error('Error in handleRecurrence:', err);
        } finally {
            recurrenceCheckInProgress.current = false;
        }
    };

    // --- Calendar Handlers ---
    const handleSelectSlot = (slotInfo) => {
        setState({
            modalEventData: { start: slotInfo.start, end: slotInfo.end },
            isModalOpen: true
        });
    };

    const handleSelectEvent = (event) => {
        setState({
            modalEventData: { ...event.resource, start: event.start, end: event.end },
            isModalOpen: true
        });
    };

    const closeModal = () => {
        setState({
            isModalOpen: false,
            modalEventData: null
        });
    };

    const handleStartTrackingEvent = (eventObj) => {
        setState({
            eventToTrack: eventObj,
            isModalOpen: false,
            modalEventData: null,
        });
        navigate('/tracker');
    };
    
    const NavButton = ({ to, children }) => (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`
            }
        >
            {children}
        </NavLink>
    );

    if (focusTaskId) {
        return <FocusView taskId={focusTaskId} onExit={() => setState({ focusTaskId: null })} />;
    }

    return (
        <div className="bg-background min-h-screen text-foreground font-sans">
            {/* Global notifications (react-hot-toast) */}
            <HotToaster position="top-right" />
            
            <header className="bg-secondary shadow-md sticky top-0 z-10">
                <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <h1 className="text-xl font-bold text-primary mr-6">Productivity Hub</h1>
                        <div className="hidden md:flex items-baseline space-x-4">
                            <NavButton to="/dashboard">Dashboard</NavButton>
                            <NavButton to="/todo">To-Do List</NavButton>
                            <NavButton to="/today">Today's Focus</NavButton>
                            <NavButton to="/habits">Habits</NavButton>
                            <NavButton to="/pomodoro">Pomodoro</NavButton>
                            <NavButton to="/tracker">Time Tracker</NavButton>
                            <NavButton to="/planner">Time Planner</NavButton>
                            <NavButton to="/notes">Notes</NavButton>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {!hasNotificationPermission && (
                            <button
                                onClick={() => requestNotificationPermission()}
                                className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
                                title="Enable notifications for task and event reminders"
                            >
                                🔔 Enable Notifications
                            </button>
                        )}
                        <button
                            onClick={() => setState({ showUserGuide: true })}
                            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                            title="Open user guide"
                        >
                            📖 Help
                        </button>
                        <ThemeToggle />
                    </div>
                </nav>
            </header>

            <div className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1 space-y-6">
                    <ProjectManager onStartGoalTimer={handleStartGoalTimer} />
                </aside>

                <main className="lg:col-span-3">
                    <AppRoutes
                        handleStartFocus={handleStartFocus}
                        handleSelectSlot={handleSelectSlot}
                        handleSelectEvent={handleSelectEvent}
                        db={db}
                    />
                </main>
            </div>
            
            <AddEventModal 
                isOpen={isModalOpen}
                onClose={closeModal}
                eventData={modalEventData}
                projects={projects || []}
                onStartTracking={handleStartTrackingEvent}
            />

            {showWeeklyReview && <WeeklyReview onExit={() => setState({ showWeeklyReview: false })} />}
            
            <UserGuide 
                isOpen={showUserGuide} 
                onClose={() => setState({ showUserGuide: false })} 
            />
        </div>
    );
}

// Wrapper for IvyLeeView to handle its specific logic
export function IvyLeeWrapper() {
    const [showIvyLeePlanner, setShowIvyLeePlanner] = useState(false);

    const checkIvyLeePlan = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const todaysPlan = await db.ivyLee.get(today);

        if (todaysPlan && todaysPlan.tasks?.length > 0) {
            setShowIvyLeePlanner(false);
        } else {
            setShowIvyLeePlanner(true);
        }
    };

    useEffect(() => {
        checkIvyLeePlan();
    }, []);

    return showIvyLeePlanner ? (
        <IvyLeePlanner onPlanCreated={() => setShowIvyLeePlanner(false)} />
    ) : (
        <IvyLeeView openPlanner={() => setShowIvyLeePlanner(true)} />
    );
}

// Main App component now is just the Router provider
function App() {
    return (
        <Router>
            <AppProvider>
                <AppLayout />
            </AppProvider>
        </Router>
    );
}

export default App;