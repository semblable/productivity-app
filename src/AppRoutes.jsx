
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardView } from './components/DashboardView';
import { TodoView } from './components/TodoView';
import { TimeTrackerView } from './components/TimeTrackerView';
import { CalendarView } from './components/CalendarView';
import { NotesView } from './components/NotesView';
import PomodoroView from './components/PomodoroView';
import HabitsView from './components/HabitsView';
import { IvyLeeWrapper } from './App';
import { useAppContext } from './context/AppContext';
import { db } from './db/db';

export function AppRoutes({ handleStartFocus, handleSelectSlot, handleSelectEvent }) {
  const { appState, setState } = useAppContext();
  const { calendarDate, calendarView, activeTimer, activeGoalId, eventToTrack } = appState;


  return (
    <Routes>
      <Route
        path="/dashboard"
        element={<DashboardView onShowReview={() => setState({ showWeeklyReview: true })} />}
      />
      <Route path="/todo" element={<TodoView onStartFocus={handleStartFocus} />} />
      <Route path="/today" element={<IvyLeeWrapper />} />
      <Route path="/habits" element={<HabitsView />} />
      <Route path="/pomodoro" element={<PomodoroView />} />
      <Route
        path="/tracker"
        element={
          <TimeTrackerView
            activeTimer={activeTimer}
            setActiveTimer={(timer) => setState({ activeTimer: timer })}
            activeGoalId={activeGoalId}
            eventToTrack={eventToTrack}
            clearEventToTrack={() => setState({ eventToTrack: null })}
            onStopTimer={(duration) => {
              if (activeGoalId) {
                db.timeGoals
                  .where({ id: activeGoalId })
                  .first()
                  .then((goal) => {
                    if (goal) {
                      const newActualHours = goal.actualHours + duration / 3600;
                      db.timeGoals.update(activeGoalId, {
                        actualHours: newActualHours,
                        progress: Math.min(
                          100,
                          Math.round((newActualHours / goal.targetHours) * 100)
                        ),
                      });
                    }
                  });
                setState({ activeGoalId: null });
              }
            }}
          />
        }
      />
      <Route
        path="/planner"
        element={
          <CalendarView
            date={new Date(calendarDate)}
            view={calendarView}
            onNavigate={(date) => setState({ calendarDate: date.toISOString() })}
            onView={(view) => setState({ calendarView: view })}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
          />
        }
      />
      <Route path="/notes" element={<NotesView />} />
      <Route
        path="/"
        element={<Navigate to={activeTimer ? '/tracker' : '/dashboard'} replace />}
      />
    </Routes>
  );
}
