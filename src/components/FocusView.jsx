import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import PomodoroView from './PomodoroView';

export const FocusView = ({ taskId, onExit }) => {
    const task = useLiveQuery(() => db.tasks.get(taskId), [taskId]);
    
    if (!task) return <div className="text-center p-8">Loading task...</div>;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex flex-col items-center justify-center text-white">
            <div className="w-full max-w-2xl text-center">
                <button onClick={onExit} className="absolute top-4 right-4 text-lg hover:text-blue-400">&times; Exit Focus</button>
                <h1 className="text-4xl font-bold mb-4">Focus Mode</h1>
                <p className="text-gray-400 mb-8">Working on:</p>
                <div className="bg-gray-800 p-6 rounded-lg mb-8 shadow-lg">
                    <h2 className="text-3xl font-semibold">{task.text}</h2>
                </div>

                <PomodoroView />
            </div>
        </div>
    );
}; 