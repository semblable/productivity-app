import { TimeTracker } from './TimeTracker';
import { TimeEntryList } from './TimeEntryList';
import { useRef } from 'react';
import { useProjects } from '../hooks/useAppData';

export const TimeTrackerView = ({ activeTimer, setActiveTimer, activeGoalId, clearActiveGoalId, eventToTrack, clearEventToTrack }) => {
    const { data: projects = [] } = useProjects();
    const timeTrackerRef = useRef();

    if (!projects) return <div className="text-gray-400">Loading...</div>;

    const handleStartTimerFromEntry = (timerData) => {
        if (timeTrackerRef.current && timeTrackerRef.current.handleStartTimer) {
            timeTrackerRef.current.handleStartTimer(timerData);
        }
    };

    return (
        <div>
            <TimeTracker
                ref={timeTrackerRef}
                activeTimer={activeTimer}
                setActiveTimer={setActiveTimer}
                projects={projects}
                activeGoalId={activeGoalId}
                clearActiveGoalId={clearActiveGoalId}
                initialEvent={eventToTrack}
                onEventConsumed={clearEventToTrack}
            />
            <TimeEntryList onStartTimer={handleStartTimerFromEntry} activeTimer={activeTimer} />
        </div>
    );
}; 