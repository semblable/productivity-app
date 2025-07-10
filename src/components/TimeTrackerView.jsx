import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TimeTracker } from './TimeTracker';
import { TimeEntryList } from './TimeEntryList';

export const TimeTrackerView = ({ activeTimer, setActiveTimer, activeGoalId, onStopTimer, eventToTrack, clearEventToTrack }) => {
    const projects = useLiveQuery(() => db.projects.toArray(), []);

    if (!projects) return <div className="text-gray-400">Loading...</div>;

    return (
        <div>
            <TimeTracker
                activeTimer={activeTimer}
                setActiveTimer={setActiveTimer}
                projects={projects}
                activeGoalId={activeGoalId}
                initialEvent={eventToTrack}
                onEventConsumed={clearEventToTrack}
                onStopTimer={onStopTimer}
            />
            <TimeEntryList />
        </div>
    );
}; 