import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TimeTracker } from './TimeTracker';
import { TimeEntryList } from './TimeEntryList';
import { useRef } from 'react';

export const TimeTrackerView = ({ activeTimer, setActiveTimer, activeGoalId, onStopTimer, eventToTrack, clearEventToTrack }) => {
    const projects = useLiveQuery(() => db.projects.toArray(), []);
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
                initialEvent={eventToTrack}
                onEventConsumed={clearEventToTrack}
                onStopTimer={onStopTimer}
            />
            <TimeEntryList onStartTimer={handleStartTimerFromEntry} activeTimer={activeTimer} />
        </div>
    );
}; 