import { useState, useMemo } from 'react';
import { db } from '../db/db';
import { toast } from 'react-toastify';
import { ChevronDown, Edit, Save, Trash2, Zap, Plus, Sparkles, Loader2 } from 'lucide-react';
import { generateSubTasks } from '../api/geminiClient';
import { updateHabit } from '../db/habit-utils';

const priorityStyles = {
    1: 'border-l-4 border-green-500', // Low
    2: 'border-l-4 border-yellow-500', // Medium
    3: 'border-l-4 border-red-500',   // High
};

export const TaskItem = ({ task, project, onStartFocus, allProjects }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(task.text);
    const [editProjectId, setEditProjectId] = useState(task.projectId);
    const [isExpanded, setIsExpanded] = useState(false);
    const [newSubtaskText, setNewSubtaskText] = useState('');
    const [isSlicing, setIsSlicing] = useState(false);

    const subtasks = useMemo(() => task.subtasks || [], [task.subtasks]);
    const completedSubtasks = useMemo(() => subtasks.filter(st => st.completed).length, [subtasks]);
    const progress = useMemo(() => (subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0), [subtasks.length, completedSubtasks]);

   const recalcGoalProgress = async (goalId) => {
        const goal = await db.goals.get(goalId);
        if (goal?.type !== 'task') return; // Only process task-based goals

        const allGoalTasks = await db.tasks.where({ goalId }).toArray();
        const completedCount = allGoalTasks.filter(t => t.completed).length;
        const totalCount = allGoalTasks.length;

        const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

        // Here, we update both progress and the actual/target to reflect task counts
        await db.goals.update(goalId, {
            progress,
            actual: completedCount,
            target: totalCount
        });
   };

   const toggleCompleted = async () => {
     try {
        const newCompleted = !task.completed;
        await db.tasks.update(task.id, { completed: newCompleted });

        if (newCompleted) {
            await updateHabit(task.id);
        }

        // If linked to goal, recompute progress
        if (task.goalId) {
            await recalcGoalProgress(task.goalId);
        }

        toast.success(`Task marked as ${newCompleted ? 'complete' : 'incomplete'}.`);

     } catch(error) {
         console.error("Failed to update task:", error);
         toast.error("Failed to update task.");
     }
   };

   const deleteTask = async () => {
      try {
         await db.tasks.delete(task.id);
         toast.success("Task deleted.");
       } catch(error) {
          console.error("Failed to delete task:", error);
          toast.error("Failed to delete task.");
       }
   };

   const handleEdit = async () => {
        if (!editText.trim()) return toast.error("Task text cannot be empty.");
        try {
            await db.tasks.update(task.id, { 
                text: editText.trim(),
                projectId: editProjectId ? Number(editProjectId) : null 
            });
            toast.success("Task updated.");
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to edit task:", error);
            toast.error("Failed to edit task.");
        }
   }

   const addSubtask = async () => {
       if (!newSubtaskText.trim()) return toast.error("Subtask text cannot be empty.");
       try {
           const newSubtask = { text: newSubtaskText, completed: false, id: Date.now() };
           await db.tasks.update(task.id, { subtasks: [...subtasks, newSubtask] });
           setNewSubtaskText('');
           toast.success("Subtask added.");
       } catch (error) {
           console.error("Failed to add subtask:", error);
           toast.error("Failed to add subtask.");
       }
   };

   const toggleSubtask = async (subtaskId) => {
        try {
            const updatedSubtasks = subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
            await db.tasks.update(task.id, { subtasks: updatedSubtasks });
        } catch (error) {
            console.error("Failed to update subtask:", error);
            toast.error("Failed to update subtask.");
        }
   };

   const deleteSubtask = async (subtaskId) => {
        try {
            const updatedSubtasks = subtasks.filter(st => st.id !== subtaskId);
            await db.tasks.update(task.id, { subtasks: updatedSubtasks });
            toast.success("Subtask deleted.");
        } catch (error) {
            console.error("Failed to delete subtask:", error);
            toast.error("Failed to delete subtask.");
        }
   };

   const handleSliceTask = async () => {
    if (isSlicing) return;
    setIsSlicing(true);
    const toastId = toast.loading('Slicing task...');
    try {
        const subtaskStrings = await generateSubTasks(task.text);
        const newSubtasks = subtaskStrings.map(text => ({
            id: Date.now() + Math.random(),
            text,
            completed: false,
        }));

        const existingSubtasks = task.subtasks || [];
        await db.tasks.update(task.id, { subtasks: [...existingSubtasks, ...newSubtasks] });
        
        toast.dismiss(toastId);
        toast.success('Task sliced into sub-tasks!');
        setIsExpanded(true); // Expand to show the new subtasks
    } catch (error) {
        console.error("Failed to slice task:", error);
        toast.dismiss(toastId);
        toast.error(`Slicing failed: ${error.message}`);
    } finally {
        setIsSlicing(false);
    }
   };
  
   const displayDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
   const priorityClass = priorityStyles[task.priority] || 'border-l-4 border-transparent';

   const inputClasses = "p-1 rounded-md bg-secondary border border-border text-foreground focus:ring-2 focus:ring-ring focus:outline-none";
   const buttonClasses = "text-muted-foreground hover:text-foreground transition-colors";

   return (
    <div className={`rounded-lg transition-all duration-300 bg-card border border-border shadow-sm ${task.completed ? 'opacity-60' : ''} ${priorityClass}`}>
        <div className="flex items-center justify-between gap-2 p-3">
            <div className="flex items-center gap-3 flex-grow">
                <input
                    type="checkbox"
                    checked={!!task.completed}
                    onChange={toggleCompleted}
                    className="h-5 w-5 rounded bg-secondary border-border text-primary focus:ring-primary"
                />
                {isEditing ? (
                    <>
                        <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className={`flex-grow ${inputClasses}`}
                            onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                            autoFocus
                        />
                        <select 
                            value={editProjectId || ''} 
                            onChange={(e) => setEditProjectId(e.target.value)}
                            className={inputClasses}
                        >
                            <option value="">No Project</option>
                            {allProjects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </>
                ) : (
                    <span className={`flex-grow ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {task.text}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-4 text-sm">
                {/* Sub-tasks toggle / indicator */}
                <div
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                    role="button"
                >
                    {subtasks.length > 0 ? (
                        <>
                            <span>{completedSubtasks}/{subtasks.length}</span>
                            <ChevronDown size={16} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </>
                    ) : (
                        <>
                            <Plus size={16} />
                            <span className="text-xs">Sub-tasks</span>
                        </>
                    )}
                </div>
                {project && (
                    <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full" style={{backgroundColor: project.color || 'var(--muted)' }}></span>
                       <span className="font-semibold text-muted-foreground">{project.name}</span>
                    </div>
                )}
                {task.goalId && (
                     <span className="text-xs bg-primary/20 text-primary-foreground border border-primary/30 px-2 py-0.5 rounded-full">Goal</span>
                )}
                {displayDate && <span className="text-xs text-muted-foreground">{displayDate}</span>}
                
                {/* AI Task Slicer Button */}
                {task.text.length > 20 && !task.subtasks?.length && (
                    <button 
                        onClick={handleSliceTask} 
                        className={`${buttonClasses} relative`} 
                        title="Slice task with AI"
                        disabled={isSlicing}
                    >
                        {isSlicing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                )}

                <button onClick={() => onStartFocus(task.id)} className={buttonClasses} title="Focus on this task">
                    <Zap size={16} />
                </button>
                {isEditing ? (
                    <button onClick={handleEdit} className={buttonClasses}><Save size={16} /></button>
                ) : (
                    <button onClick={() => setIsEditing(true)} className={buttonClasses}><Edit size={16} /></button>
                )}
                <button onClick={deleteTask} className="text-destructive transition-colors hover:opacity-80"><Trash2 size={16} /></button>
            </div>
        </div>
        {progress > 0 && !task.completed && (
            <div className="w-full bg-secondary rounded-full h-1 mx-3 mb-2">
                <div className="bg-primary h-1 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
        )}
        {isExpanded && (
            <div className="p-3 border-t border-border">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Sub-tasks</h4>
                    {/* Add subtask form */}
                    <form onSubmit={(e) => { e.preventDefault(); addSubtask(); }} className="flex gap-2 items-center">
                        <input
                            type="text"
                            value={newSubtaskText}
                            onChange={(e) => setNewSubtaskText(e.target.value)}
                            placeholder="New sub-task..."
                            className={`flex-grow text-sm ${inputClasses}`}
                        />
                        <button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground px-2 py-1 text-xs rounded-md">Add</button>
                    </form>
                </div>
                <div className="space-y-2">
                    {subtasks.map(subtask => (
                        <div key={subtask.id} className="flex items-center justify-between text-sm ml-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={subtask.completed}
                                    onChange={() => toggleSubtask(subtask.id)}
                                    className="h-4 w-4 rounded bg-secondary border-border text-primary focus:ring-primary"
                                />
                                <span className={subtask.completed ? 'line-through text-muted-foreground' : 'text-foreground'}>{subtask.text}</span>
                            </div>
                            <button onClick={() => deleteSubtask(subtask.id)} className="text-destructive text-xs hover:opacity-80"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </div>
        )}
     </div>
   );
 }; 