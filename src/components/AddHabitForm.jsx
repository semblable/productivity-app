import { useState, useEffect } from 'react';
import { db } from '../db/db';
import toast from 'react-hot-toast';
import { RRule } from 'rrule';
import { Plus } from 'lucide-react';
import { normalizeNullableId } from '../db/id-utils';

export const AddHabitForm = ({ onHabitAdded }) => {
    const [text, setText] = useState('');
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');

    useEffect(() => {
        const fetchProjects = async () => {
            const allProjects = await db.projects.toArray();
            setProjects(allProjects);
        };
        fetchProjects();
    }, []);

    const addHabit = async (e) => {
        e.preventDefault();
        if (!text.trim()) return toast.error("Habit name cannot be empty.");

        const projectId = normalizeNullableId(selectedProjectId);

        // Create a daily recurring task for this habit
        const rule = new RRule({
            freq: RRule.DAILY,
            dtstart: new Date(),
        });
        const rruleString = rule.toString();

        try {
            const newTaskId = await db.tasks.add({
                text: text.trim(),
                completed: false,
                createdAt: new Date(),
                dueDate: new Date(),
                projectId: projectId,
                priority: 0,
                rrule: rruleString,
                parentId: null,
                templateId: null, // Habit templates are not instances
            });

            await db.habits.add({
                taskId: newTaskId,
                name: text.trim(),
                startDate: new Date(),
                streak: 0,
                bestStreak: 0,
                lastCompletionDate: null,
                streakFreezes: 0,
                streakFriezes: 0,
                lastStreakMilestone: 0,
                projectId: projectId
            });
            
            setText('');
            setSelectedProjectId('');
            toast.success(`Habit '${text.trim()}' added!`);
            if (onHabitAdded) onHabitAdded();
        } catch (error) {
            console.error('Failed to add habit:', error);
            toast.error("Failed to add habit.");
        }
    };

    const inputClasses = "p-2 rounded-md bg-secondary border border-border text-foreground focus:ring-2 focus:ring-ring focus:outline-none";

    return (
        <form onSubmit={addHabit} className="flex items-center gap-3 mt-4 bg-card p-4 rounded-lg border border-border shadow-sm flex-wrap">
            <input
                type="text"
                placeholder="Name your new daily habit..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={`flex-grow min-w-[200px] ${inputClasses}`}
                autoFocus
            />
            <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={`flex-grow min-w-[150px] ${inputClasses}`}
            >
                <option value="">No Project</option>
                {projects.map(project => (
                    <option key={project.id} value={project.id}>
                        {project.name}
                    </option>
                ))}
            </select>
            <button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-4 rounded-md flex items-center gap-2">
                <Plus size={16} /> Add Habit
            </button>
        </form>
    );
}; 