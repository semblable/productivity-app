import { useEffect, useRef } from 'react';
// Import React Router components
import {
  BrowserRouter as Router,
  NavLink,
  useNavigate,
} from 'react-router-dom';
// Removed react-toastify in favor of react-hot-toast
import { useLiveQuery } from 'dexie-react-hooks';
import { RRule } from 'rrule';
import { Toaster as HotToaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// Import all views and components
import { AddEventModal } from './components/AddEventModal';
import { db } from './db/db';
import { FocusView } from './components/FocusView';
import { WeeklyReview } from './components/WeeklyReview';
import { useNotifications } from './hooks/useNotifications';
import { ThemeToggle } from './components/ThemeToggle';
import { AppRoutes } from './AppRoutes';
import { checkBrokenStreaks } from './db/habit-utils';
import { ProjectManager } from './components/ProjectManager';
import UserGuide from './components/UserGuide';
import { AppProvider, useAppContext } from './context/AppContext';
import { resolvePomodoroTarget } from './utils/pomodoroTarget';


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

  // Global listener for Pomodoro SW status to coordinate time tracking even when on other routes.
  //
  // Accumulator pattern: time is accumulated across pause/resume cycles and a
  // single entry is written only when the pomodoro finishes (mode changes away
  // from 'pomodoro'). Pausing does NOT write an entry — it just banks the
  // elapsed segment into accumulatedSeconds.
  const lastStatusRef = useRef({ mode: null, timerState: null, pomodoros: -1 });
  const trackingRef = useRef({
      active: false,
      pomodoroCount: -1,
      accumulatedSeconds: 0,
      segmentStart: null,
  });
  const didInitialStatusRef = useRef(false);
  const appStateRef = useRef(appState);

  // Unique ID for this browser tab so only one tab writes the pomodoro entry.
  // sessionStorage is per-tab; localStorage is shared across tabs.
  const tabIdRef = useRef(() => {
      let id = sessionStorage.getItem('pomodoroTabId');
      if (!id) {
          id = `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem('pomodoroTabId', id);
      }
      return id;
  });
  const getTabId = () => {
      if (typeof tabIdRef.current === 'function') {
          tabIdRef.current = tabIdRef.current();
      }
      return tabIdRef.current;
  };

  const createSessionId = () => {
      try {
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
              return crypto.randomUUID();
          }
      } catch {}
      return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  };

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

          // Never interfere with a manually-started timer
          if (hasNonPomodoroTimer) {
              lastStatusRef.current = curr;
              return;
          }

          // On mount ONLY (prev.timerState === null is the first-message sentinel):
          // restore tracking state if a pomodoro activeTimer was persisted in localStorage.
          // The prev.timerState guard prevents this from re-firing on every subsequent
          // message when trackingRef.active is briefly false between sessions, which
          // would create a ghost session from the stale appStateRef and break pomo 2+.
          if (prev.timerState === null && !trackingRef.current.active && activeTimer && activeTimer.origin === 'pomodoro') {
              // Only restore as the active tracker if no other tab already owns it,
              // OR if this tab was the original owner.
              const currentOwner = localStorage.getItem('pomodoroTrackerOwner');
              const thisTab = getTabId();
              if (!currentOwner || currentOwner === thisTab) {
                  trackingRef.current.active = true;
                  trackingRef.current.pomodoroCount = pomodoros;
                  trackingRef.current.accumulatedSeconds = activeTimer.accumulatedSeconds || 0;
                  trackingRef.current.segmentStart = isRunning
                      ? (activeTimer.segmentStart || Date.now())
                      : null;
                  try { localStorage.setItem('pomodoroTrackerOwner', thisTab); } catch {}
              }
          }

          const wasRunning = prev.mode === 'pomodoro' && prev.timerState === 'running';
          const enteringRunning = isPomodoro && isRunning && !wasRunning;
          const leavingRunning = trackingRef.current.active && isPomodoro && !isRunning &&
              (prev.timerState === 'running');
          // Finish when: mode leaves 'pomodoro' (natural/break), OR user resets
          // while in pomodoro mode (timerState → 'idle', prev was not idle and not
          // the very first message on mount where prev.timerState is null).
          const pomodoroFinished = trackingRef.current.active && (
              !isPomodoro ||
              (isPomodoro && timerState === 'idle' && prev.timerState !== null && prev.timerState !== 'idle')
          );

          // ── START ────────────────────────────────────────────────────────────
          // Pomodoro just started (or resumed after pause)
          if (isPomodoro && enteringRunning) {
              if (!trackingRef.current.active) {
                  // First start of a new pomodoro — resolve the target once
                  try {
                      const selectedTarget = localStorage.getItem('pomodoroSelectedTarget') || 'none';
                      if (selectedTarget === 'none') {
                          lastStatusRef.current = curr;
                          return;
                      }
                      const { description, projectId, goalId, taskId } = await resolvePomodoroTarget(db, selectedTarget);
                      const sessionId = createSessionId();
                      const startedAt = Date.now();
                      setState({
                          activeTimer: {
                              description,
                              projectId,
                              goalId,
                              taskId,
                              startTime: startedAt,
                              origin: 'pomodoro',
                              status: 'running',
                              sessionId,
                              accumulatedSeconds: 0,
                              segmentStart: startedAt,
                          }
                      });
                      trackingRef.current.active = true;
                      trackingRef.current.pomodoroCount = pomodoros;
                      trackingRef.current.accumulatedSeconds = 0;
                      trackingRef.current.segmentStart = startedAt;
                      try { localStorage.setItem('pomodoroTrackerOwner', getTabId()); } catch {}
                      toast.success('Started tracking Pomodoro');
                  } catch (err) {
                      console.error('Failed to start Pomodoro tracking:', err);
                      toast.error('Failed to start Pomodoro tracking');
                  }
              } else {
                  // Resuming from pause — just record a new segment start
                  const resumedAt = Date.now();
                  trackingRef.current.segmentStart = resumedAt;
                  const active = appStateRef.current.activeTimer;
                  if (active && active.origin === 'pomodoro') {
                      setState({
                          activeTimer: {
                              ...active,
                              status: 'running',
                              segmentStart: resumedAt,
                          }
                      });
                  }
              }
          }

          // ── PAUSE ────────────────────────────────────────────────────────────
          // Timer paused — bank elapsed segment, do NOT write an entry yet
          if (leavingRunning && trackingRef.current.segmentStart !== null) {
              const segmentSeconds = Math.floor((Date.now() - trackingRef.current.segmentStart) / 1000);
              trackingRef.current.accumulatedSeconds += segmentSeconds;
              trackingRef.current.segmentStart = null;
              // Persist accumulated total so a page reload doesn't lose it
              const active = appStateRef.current.activeTimer;
              if (active && active.origin === 'pomodoro') {
                  setState({
                      activeTimer: {
                          ...active,
                          status: 'paused',
                          accumulatedSeconds: trackingRef.current.accumulatedSeconds,
                          segmentStart: null,
                      }
                  });
              }
          }

          // ── FINISH ───────────────────────────────────────────────────────────
          // Mode changed away from 'pomodoro' — write the single accumulated entry.
          // The finishingRef guard prevents any re-entrant call from saving again
          // while the async DB write is in flight.
          if (pomodoroFinished) {
              // Only the tab that owns the tracking session writes the entry.
              // All other tabs just clean up their local state.
              const isOwner = localStorage.getItem('pomodoroTrackerOwner') === getTabId();

              // Bank any still-running segment (needed for accurate accumulated time)
              if (trackingRef.current.segmentStart !== null) {
                  const segmentSeconds = Math.floor((Date.now() - trackingRef.current.segmentStart) / 1000);
                  trackingRef.current.accumulatedSeconds += segmentSeconds;
                  trackingRef.current.segmentStart = null;
              }

              const active = appStateRef.current.activeTimer;
              const totalDuration = trackingRef.current.accumulatedSeconds;

              // Tear down tracking synchronously in every tab
              setState({ activeTimer: null });
              trackingRef.current.active = false;
              trackingRef.current.pomodoroCount = -1;
              trackingRef.current.accumulatedSeconds = 0;
              trackingRef.current.segmentStart = null;
              lastStatusRef.current = curr;

              if (isOwner && active && active.origin === 'pomodoro' && totalDuration > 0) {
                  const sid = active.sessionId;
                  // Claim the session BEFORE the async write so even a concurrent
                  // check in this tab's re-entrant path will bail out.
                  if (sid) {
                      try { localStorage.setItem(`timeEntryLogged:${sid}`, '1'); } catch {}
                  }
                  try { localStorage.removeItem('pomodoroTrackerOwner'); } catch {}

                  try {
                      const startDate = new Date(active.startTime);
                      const endDate = new Date();
                      await db.timeEntries.add({
                          description: active.description,
                          projectId: active.projectId || null,
                          goalId: active.goalId || null,
                          taskId: active.taskId || null,
                          startTime: startDate,
                          endTime: endDate,
                          duration: totalDuration,
                      });
                      toast.success('Pomodoro time logged');
                  } catch (e) {
                      if (sid) {
                          try { localStorage.removeItem(`timeEntryLogged:${sid}`); } catch {}
                      }
                      console.error('Failed to log Pomodoro time:', e);
                      toast.error('Failed to log Pomodoro time');
                  }
              } else if (!isOwner) {
                  try { localStorage.removeItem('pomodoroTrackerOwner'); } catch {}
              }
              return;
          }

          lastStatusRef.current = curr;
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      if (!didInitialStatusRef.current) {
          didInitialStatusRef.current = true;
          navigator.serviceWorker.controller?.postMessage({ command: 'getStatus' });
      }
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [setState]);

    useEffect(() => {
        if (appState.activeTimer) {
            localStorage.setItem('activeTimer', JSON.stringify(appState.activeTimer));
        } else {
            localStorage.removeItem('activeTimer');
            trackingRef.current.active = false;
            trackingRef.current.pomodoroCount = -1;
            trackingRef.current.accumulatedSeconds = 0;
            trackingRef.current.segmentStart = null;
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
            const goal = await db.goals.get(task.goalId);
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
                    // Prefer compound index on [templateId+startTime] for events
                    let exists;
                    if (isEvent) {
                        exists = await db.events
                            .where('[templateId+startTime]')
                            .equals([item.id, occurrence])
                            .first();
                    } else {
                        exists = await dbTable.where('templateId').equals(item.id)
                            .filter(child => new Date(child[startTimeField]).getTime() === occTime)
                            .first();
                    }

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
            modalEventData: { startTime: slotInfo.start, endTime: slotInfo.end },
            isModalOpen: true
        });
    };

    const handleSelectEvent = (event) => {
        setState({
            modalEventData: { ...event.resource, startTime: event.start, endTime: event.end },
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
                        <h1 className="text-xl font-bold text-primary mr-6">Momentum Planner</h1>
                        <div className="hidden md:flex items-baseline space-x-4">
                            <NavButton to="/dashboard">Dashboard</NavButton>
                            <NavButton to="/todo">To-Do List</NavButton>
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