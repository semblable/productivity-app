import { useMemo } from 'react';
import { useTasks, useTimeEntries } from '../hooks/useAppData';

export const WeeklyReview = ({ onExit }) => {
    const { data: tasks = [] } = useTasks();
    const { data: timeEntries = [] } = useTimeEntries();

    const data = useMemo(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        /* -----------------------------  TASKS  ----------------------------- */
        // All tasks created in the last week – use a safe comparison so we don't accidentally
        // include tasks whose createdAt may be stored as a string (older backups) or tasks that
        // have since been removed. We fetch all tasks and then filter in JS to handle both Date
        // and string representations consistently.
        const recentTasks = tasks.filter(t => {
            // Rule 1: Must be a top-level task, not a database-level subtask or recurring template.
            const isSubtask = t.parentId !== null && t.parentId !== undefined;
            const isRecurringTemplate = t.rrule && !t.templateId;
            if (isSubtask || isRecurringTemplate) return false;

            // Rule 2: Must have a creation date.
            if (!t.createdAt) return false;

            // Rule 3: Skip any soft-deleted tasks (future-proofing).
            if (t.deleted) return false;

            // Rule 4: Must be created within the last week.
            const created = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
            return created >= oneWeekAgo;
        });

        const completedTasks = recentTasks.filter(t => t.completed);
        const pendingTasks   = recentTasks.filter(t => !t.completed);

        /* ---------------------------  TIME ENTRIES  -------------------------- */
        // NOTE: The correct table name is `timeEntries` (camel-case)
        const recentEntries = timeEntries.filter((entry) => new Date(entry.endTime) > oneWeekAgo);

        const totalDuration = recentEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        const hours   = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration % 3600) / 60);

        return {
            completedTasks,
            pendingTasks,
            timeEntries: recentEntries,
            stats: {
                tasksCreated: recentTasks.length,
                tasksCompleted: completedTasks.length,
                tasksPending: pendingTasks.length,
                totalTracked: `${hours}h ${minutes}m`
            }
        };
    }, [tasks, timeEntries]);

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-[11000] p-8 overflow-y-auto">
            {/* Use fixed positioning so the button is always visible and clickable, even when the review is scrolled */}
            <button
                onClick={onExit}
                className="fixed top-4 right-4 z-[11010] text-lg font-semibold px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                &times; Exit Review
            </button>

            <div className="max-w-5xl mx-auto space-y-10">
                <h1 className="text-4xl font-bold text-center mb-4 text-blue-300">Your Week in Review</h1>

                {/* ----------- Quick Stats ----------- */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">Tasks Created</p>
                        <p className="text-3xl font-bold text-blue-400">{data?.stats?.tasksCreated ?? '–'}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">Tasks Completed</p>
                        <p className="text-3xl font-bold text-green-400">{data?.stats?.tasksCompleted ?? '–'}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">Pending Tasks</p>
                        <p className="text-3xl font-bold text-yellow-400">{data?.stats?.tasksPending ?? '–'}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">Time Tracked</p>
                        <p className="text-3xl font-bold text-purple-400">{data?.stats?.totalTracked ?? '0h 0m'}</p>
                    </div>
                </div>

                {/* ----------- Detailed Lists ----------- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Completed Tasks */}
                    <div className="bg-gray-800 p-6 rounded-lg h-full flex flex-col">
                        <h2 className="text-2xl font-bold mb-4">Completed Tasks</h2>
                        <p className="text-5xl font-bold text-green-400 mb-4">{data?.completedTasks?.length || 0}</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto flex-1">
                            {data?.completedTasks?.map(task => (
                                <div key={task.id} className="bg-gray-700 p-2 rounded-md text-sm">
                                    {task.text}
                                </div>
                            ))}
                            {data?.completedTasks?.length === 0 && <p className="text-center text-gray-500">No tasks completed this week.</p>}
                        </div>
                    </div>

                    {/* Time Entries */}
                    <div className="bg-gray-800 p-6 rounded-lg h-full flex flex-col">
                        <h2 className="text-2xl font-bold mb-4">Time Entries</h2>
                        <p className="text-5xl font-bold text-purple-400 mb-4">{data?.stats?.totalTracked || '0h 0m'}</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto flex-1">
                            {data?.timeEntries?.map(entry => (
                                <div key={entry.id} className="bg-gray-700 p-2 rounded-md text-sm flex justify-between items-center">
                                    <span>{entry.description}</span>
                                    <span className="text-gray-400 text-xs">{Math.round((entry.duration || 0) / 60)}m</span>
                                </div>
                            ))}
                            {data?.timeEntries?.length === 0 && <p className="text-center text-gray-500">No time logged this week.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}; 