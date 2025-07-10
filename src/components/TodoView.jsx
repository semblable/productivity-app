import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { AddTaskForm } from './AddTaskForm';
import { TaskItem } from './TaskItem';

export const TodoView = ({ onStartFocus }) => {
    const projects = useLiveQuery(() => db.projects.toArray(), []);
    
    // Local UI state for filters / search
    const [searchTerm, setSearchTerm] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');
    const [showCompleted, setShowCompleted] = useState(true);

    // Custom sorting: priority(desc) then creation date(desc)
    const tasks = useLiveQuery(async () => {
        const all = await db.tasks.orderBy('createdAt').reverse().toArray();
        const topLevel = all.filter(t => t.parentId === null || t.parentId === undefined);
        return topLevel.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }, []);

    const projectMap = projects?.reduce((map, proj) => {
        map[proj.id] = proj;
        return map;
    }, {}) || {};

    if (!tasks || !projects) return <div className="text-muted-foreground">Loading...</div>;

    // --- Filtering logic ---
    const filtered = tasks.filter(task => {
        const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = projectFilter === 'all' || String(task.projectId) === projectFilter;
        return matchesSearch && matchesProject;
    });

    const incompleteTasks = filtered.filter(t => !t.completed);
    const completedTasks = filtered.filter(t => t.completed);

    // Optionally hide completed tasks
    const visibleCompleted = showCompleted ? completedTasks : [];

    return (
        <div className="space-y-6">
            {/* Add Task */}
            <AddTaskForm projects={projects} />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-lg border border-border shadow-sm">
                <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-grow min-w-[150px] p-2 rounded-md bg-secondary text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                />
                <select
                    value={projectFilter}
                    onChange={e => setProjectFilter(e.target.value)}
                    className="p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                >
                    <option value="all">All Projects</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" className="h-4 w-4" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
                    Show completed
                </label>
            </div>

            {/* Task list grouped by due date */}
            <div className="space-y-6">
                {Object.entries(
                    incompleteTasks.reduce((acc, task) => {
                        const key = task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric'}) : 'No Date';
                        (acc[key] = acc[key] || []).push(task);
                        return acc;
                    }, {})
                ).sort(([a], [b]) => {
                    if (a === 'No Date') return 1;
                    if (b === 'No Date') return -1;
                    return new Date(a) - new Date(b);
                }).map(([dateLabel, tasksForDate]) => (
                    <div key={dateLabel}>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">{dateLabel}</h4>
                        <div className="space-y-3">
                            {tasksForDate.map(task => (
                                <TaskItem key={task.id} task={task} project={projectMap[task.projectId]} allProjects={projects} onStartFocus={onStartFocus} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {visibleCompleted.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground border-b border-border pb-2">Completed</h3>
                    <div className="space-y-3">
                        {visibleCompleted.map(task => (
                            <TaskItem key={task.id} task={task} project={projectMap[task.projectId]} allProjects={projects} onStartFocus={onStartFocus} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}; 