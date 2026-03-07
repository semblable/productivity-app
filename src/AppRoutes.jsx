
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardView } from './components/DashboardView';
import { TodoView } from './components/TodoView';
import { TimeTrackerView } from './components/TimeTrackerView';
import { CalendarView } from './components/CalendarView';
import { NotesView } from './components/NotesView';
import PomodoroView from './components/PomodoroView';
import HabitsView from './components/HabitsView';
import { useAppContext } from './context/AppContext';

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
      <Route path="/habits" element={<HabitsView />} />
      <Route path="/pomodoro" element={<PomodoroView />} />
      <Route
        path="/tracker"
        element={
          <TimeTrackerView
            activeTimer={activeTimer}
            setActiveTimer={(timer) => setState({ activeTimer: timer })}
            activeGoalId={activeGoalId}
            clearActiveGoalId={() => setState({ activeGoalId: null })}
            eventToTrack={eventToTrack}
            clearEventToTrack={() => setState({ eventToTrack: null })}
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
