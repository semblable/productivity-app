import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db, projectColors } from '../db/db';
import { Plus, Trash2, Play, Edit } from 'lucide-react';

export const ProjectManager = ({ onStartGoalTimer }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedColor, setSelectedColor] = useState(projectColors[0]);
    const projects = useLiveQuery(() => db.projects.toArray());
    const timeGoals = useLiveQuery(() => db.timeGoals.toArray());
    
    // New state for time goals
    const [goalDescription, setGoalDescription] = useState('');
    const [targetHours, setTargetHours] = useState('');
    const [deadline, setDeadline] = useState('');
    const [hoursCompleted, setHoursCompleted] = useState(0);
    const [goalProjectId, setGoalProjectId] = useState('');
    const [errors, setErrors] = useState({});

    // State for editing goals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [editFormData, setEditFormData] = useState({
        description: '',
        targetHours: '',
        actualHours: '',
        deadline: '',
        projectId: '',
    });

    // State for editing projects
    const [isProjectEditModalOpen, setIsProjectEditModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [editProjectFormData, setEditProjectFormData] = useState({
        name: '',
        color: projectColors[0]
    });

    const addProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return toast.error("Project name cannot be empty.");
        
        try {
            await db.projects.add({ 
                name: newProjectName.trim(), 
                color: selectedColor,
                createdAt: new Date() 
            });
            setNewProjectName('');
            toast.success("Project added!");
        } catch (error) {
            console.error("Failed to add project:", error);
            if (error.name === 'ConstraintError') {
                toast.error("A project with this name already exists.");
            } else {
                toast.error("Failed to add project.");
            }
        }
    };
    
    // Add new time goal
    const addGoal = async (e) => {
        e.preventDefault();
        let hasErrors = false;
        const newErrors = {};
        
        // Validate inputs
        if (!goalDescription.trim()) {
            newErrors.description = "Goal description is required";
            hasErrors = true;
        }
        
        const hours = parseFloat(targetHours);
        if (isNaN(hours) || hours <= 0) {
            newErrors.targetHours = "Target hours must be a positive number";
            hasErrors = true;
        }
        
        const completed = parseFloat(hoursCompleted);
        if (isNaN(completed) || completed < 0) {
            newErrors.hoursCompleted = "Hours completed must be a non-negative number";
            hasErrors = true;
        }
        
        if (hasErrors) {
            setErrors(newErrors);
            return;
        }
        
        // Add new goal
        const progress = Math.min(100, Math.round((completed / hours) * 100));
        
        const newGoal = {
            description: goalDescription.trim(),
            targetHours: hours,
            actualHours: completed,
            deadline: deadline || null,
            progress,
            createdAt: new Date(),
            projectId: goalProjectId ? Number(goalProjectId) : null,
        };
        
        try {
            await db.timeGoals.add(newGoal);
            setGoalDescription('');
            setTargetHours('');
            setDeadline('');
            setHoursCompleted(0);
            setGoalProjectId('');
            setErrors({});
            toast.success("Goal added!");
        } catch (error) {
            console.error("Failed to add goal:", error);
            toast.error("Failed to add goal.");
        }
    };
    
    // Log hours to an existing goal
    const logHours = async (goalId, hours) => {
        try {
            const goal = await db.timeGoals.get(goalId);
            if (goal) {
                const newActualHours = goal.actualHours + parseFloat(hours);
                const progress = Math.min(100, Math.round((newActualHours / goal.targetHours) * 100));
                await db.timeGoals.update(goalId, { actualHours: newActualHours, progress });
                toast.success("Hours logged!");
            }
        } catch (error) {
            console.error("Failed to log hours:", error);
            toast.error("Failed to log hours.");
        }
    };

    const deleteGoal = async (id) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p>Delete this goal?</p>
                <div className="flex gap-2 justify-end">
                    <button
                        className="bg-accent hover:opacity-80 text-white p-1 px-3 rounded text-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                console.log('[Goal] Deleting goal', id);
                                await db.timeGoals.delete(id);
                                toast.success('Goal deleted');
                            } catch (err) {
                                toast.error('Failed to delete goal.');
                                console.error(err);
                            }
                        }}
                    >
                        Delete
                    </button>
                    <button
                        className="bg-secondary hover:bg-border text-foreground p-1 px-3 rounded text-sm"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ));
    };
    
    const deleteProject = async (id) => {
        // A confirmation toast for such a destructive action
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p>Delete project and all its tasks/events?</p>
                <div className="flex gap-2 justify-end">
                    <button 
                        className="bg-accent hover:opacity-80 text-white p-1 px-3 rounded text-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                // This is a simple deletion. A more complex app might need to cascade deletes.
                                await db.projects.delete(id);
                                // Also delete associated tasks and events
                                const tasksToDelete = await db.tasks.where({ projectId: id }).primaryKeys();
                                await db.tasks.bulkDelete(tasksToDelete);
                                const eventsToDelete = await db.events.where({ projectId: id }).primaryKeys();
                                await db.events.bulkDelete(eventsToDelete);
                                const goalsToDelete = await db.timeGoals.where({ projectId: id }).primaryKeys();
                                await db.timeGoals.bulkDelete(goalsToDelete);
                                
                                toast.success("Project deleted.");
                            } catch(error) {
                                console.error("Failed to delete project:", error);
                                toast.error("Failed to delete project.");
                            }
                        }}
                    >
                        Delete
                    </button>
                    <button 
                        className="bg-secondary hover:bg-border text-foreground p-1 px-3 rounded text-sm"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ));
    }

    const openEditModal = (goal) => {
        setEditingGoal(goal);
        setEditFormData({
            description: goal.description,
            targetHours: goal.targetHours,
            actualHours: goal.actualHours,
            deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
            projectId: goal.projectId || '',
        });
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingGoal(null);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        if (!editingGoal) return;

        const { description, targetHours, actualHours, deadline, projectId } = editFormData;
        const hours = parseFloat(targetHours);
        const completed = parseFloat(actualHours);

        if (!description.trim() || isNaN(hours) || hours <= 0 || isNaN(completed) || completed < 0) {
            return toast.error("Please fill in all required fields correctly.");
        }
        
        const progress = Math.min(100, Math.round((completed / hours) * 100));

        try {
            await db.timeGoals.update(editingGoal.id, {
                description: description.trim(),
                targetHours: hours,
                actualHours: completed,
                deadline: deadline || null,
                progress,
                projectId: projectId ? Number(projectId) : null,
            });
            toast.success("Goal updated!");
            closeEditModal();
        } catch (error) {
            console.error("Failed to update goal:", error);
            toast.error("Failed to update goal.");
        }
    };

    const openProjectEditModal = (project) => {
        setEditingProject(project);
        setEditProjectFormData({
            name: project.name,
            color: project.color || projectColors[0]
        });
        setIsProjectEditModalOpen(true);
    };

    const closeProjectEditModal = () => {
        setIsProjectEditModalOpen(false);
        setEditingProject(null);
    };

    const handleProjectEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditProjectFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateProject = async (e) => {
        e.preventDefault();
        if (!editingProject) return;

        const { name, color } = editProjectFormData;
        if (!name.trim()) return toast.error("Project name cannot be empty.");

        try {
            await db.projects.update(editingProject.id, {
                name: name.trim(),
                color: color
            });
            toast.success("Project updated!");
            closeProjectEditModal();
        } catch (error) {
            console.error("Failed to update project:", error);
            if (error.name === 'ConstraintError') {
                toast.error("A project with this name already exists.");
            } else {
                toast.error("Failed to update project.");
            }
        }
    };

    return (
        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-card-foreground">Projects</h2>
            <form onSubmit={addProject} className="space-y-4 mb-4">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="New project name"
                        className="flex-grow p-2 rounded-md bg-secondary border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground p-2 rounded-md flex items-center justify-center">
                        <Plus size={20} />
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-secondary-foreground">Color:</span>
                    <div className="flex gap-2">
                        {projectColors.map(color => (
                            <button
                                type="button"
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
                                style={{ backgroundColor: color }}
                                aria-label={`Select color ${color}`}
                            />
                        ))}
                    </div>
                </div>
            </form>
            <ul className="space-y-2">
                {projects?.map(project => (
                    <li key={project.id} className="flex justify-between items-center p-2 rounded-md hover:bg-secondary group">
                       <div className="flex items-center gap-3">
                           <span className="w-3 h-3 rounded-full" style={{backgroundColor: project.color || '#64748b' }}></span>
                           <span className="text-secondary-foreground">{project.name}</span>
                       </div>
                       <div className="flex gap-2 transition-opacity">
                           <button onClick={() => openProjectEditModal(project)} className="text-blue-500">
                               <Edit size={16} />
                           </button>
                           <button onClick={() => deleteProject(project.id)} className="text-accent">
                               <Trash2 size={16} />
                           </button>
                       </div>
                    </li>
                ))}
            </ul>
            
            {/* Time Goal Section */}
            <div className="mt-8">
                <h2 className="text-lg font-bold mb-4 text-card-foreground">Set Time Goal</h2>
                <form onSubmit={addGoal} className="space-y-4">
                    <div className="flex flex-col gap-3">
                        <div>
                            <input
                                type="text"
                                value={goalDescription}
                                onChange={(e) => setGoalDescription(e.target.value)}
                                placeholder="Goal description *"
                                required
                                className={`p-2 w-full rounded-md bg-secondary border ${
                                    errors.description ? 'border-accent' : 'border-border'
                                } focus:ring-2 focus:ring-primary focus:outline-none`}
                                data-testid="goal-description-input"
                            />
                            {errors.description && (
                                <p className="text-accent text-sm mt-1">{errors.description}</p>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap gap-3">
                            <div className="flex-1 min-w-[150px]">
                                <input
                                    type="number"
                                    value={targetHours}
                                    onChange={(e) => setTargetHours(e.target.value)}
                                    placeholder="Target hours *"
                                    min="0"
                                    required
                                    className={`p-2 w-full rounded-md bg-secondary border ${
                                        errors.targetHours ? 'border-accent' : 'border-border'
                                    } focus:ring-2 focus:ring-primary focus:outline-none`}
                                    data-testid="target-hours-input"
                                />
                                {errors.targetHours && (
                                    <p className="text-accent text-sm mt-1">{errors.targetHours}</p>
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-[150px]">
                                <input
                                    type="number"
                                    value={hoursCompleted}
                                    onChange={(e) => setHoursCompleted(e.target.value)}
                                    placeholder="Hours completed"
                                    min="0"
                                    step="0.1"
                                    className={`p-2 w-full rounded-md bg-secondary border ${
                                        errors.hoursCompleted ? 'border-accent' : 'border-border'
                                    } focus:ring-2 focus:ring-primary focus:outline-none`}
                                    data-testid="hours-completed-input"
                                />
                                {errors.hoursCompleted && (
                                    <p className="text-accent text-sm mt-1">{errors.hoursCompleted}</p>
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-[150px]">
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="p-2 w-full rounded-md bg-secondary border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                                    data-testid="deadline-input"
                                />
                            </div>
                        </div>
                        
                        <select
                            name="projectId"
                            value={goalProjectId}
                            onChange={(e) => setGoalProjectId(e.target.value)}
                            className="p-2 w-full rounded-md bg-secondary border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                            <option value="">No Project</option>
                            {projects?.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        
                        <button
                            type="submit"
                            className="bg-primary hover:opacity-90 text-primary-foreground font-bold py-2 px-4 rounded w-full transition-colors duration-200"
                            data-testid="add-goal-button"
                        >
                            Add Goal
                        </button>
                    </div>
                </form>
                
                {/* Goals List */}
                {timeGoals && timeGoals.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-md font-semibold mb-3">Current Goals</h3>
                        <ul className="space-y-3">
                            {timeGoals.map(goal => {
                                projects?.find(p => p.id === goal.projectId);
                                return (
                                    <li key={goal.id} className="p-3 rounded-md bg-secondary" data-testid="goal-item">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-grow min-w-0">
                                                <p className="font-medium">{goal.description}</p>
                                                <p className="text-sm text-secondary-foreground mt-1">
                                                    {goal.targetHours} hours {goal.deadline ? `by ${new Date(goal.deadline).toLocaleDateString()}` : '(No deadline)'}
                                                </p>
                                                <p className="text-sm mt-1">
                                                    Completed: {goal.actualHours.toFixed(1)}/{goal.targetHours} hours
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 ml-2">
                                               <button onClick={() => openEditModal(goal)} className="text-blue-500 opacity-80 hover:opacity-100 transition-opacity p-1">
                                                   <Edit size={14} />
                                               </button>
                                               <button onClick={() => deleteGoal(goal.id)} className="text-red-500 hover:text-red-700 transition-colors p-1">
                                                   <Trash2 size={14} />
                                               </button>
                                               <button
                                                   onClick={() => onStartGoalTimer(goal)}
                                                   className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                                                   data-testid={`start-timer-button-${goal.id}`}
                                               >
                                                   <Play size={12} />
                                                   Start
                                               </button>
                                           </div>
                                        </div>
                                        <div className="mt-2">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Progress</span>
                                                <span>{goal.progress}%</span>
                                            </div>
                                            <div className="w-full bg-background rounded-full h-1.5">
                                                <div
                                                    className="bg-accent h-1.5 rounded-full"
                                                    style={{ width: `${goal.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                placeholder="Add hours"
                                                className="p-1 text-sm rounded border border-border bg-secondary"
                                                data-testid={`log-hours-input-${goal.id}`}
                                            />
                                            <button
                                                onClick={() => {
                                                    const input = document.querySelector(`[data-testid="log-hours-input-${goal.id}"]`);
                                                    if (input && input.value) {
                                                        logHours(goal.id, input.value);
                                                        input.value = '';
                                                    }
                                                }}
                                                className="bg-primary hover:opacity-90 text-primary-foreground text-sm px-3 py-1 rounded whitespace-nowrap"
                                                data-testid={`log-hours-button-${goal.id}`}
                                            >
                                                Log Hours
                                            </button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}
            </div>

            {isProjectEditModalOpen && editingProject && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md m-4">
                        <h2 className="text-lg font-bold mb-4">Edit Project</h2>
                        <form onSubmit={handleUpdateProject} className="space-y-4">
                            <input
                                type="text"
                                name="name"
                                value={editProjectFormData.name}
                                onChange={handleProjectEditFormChange}
                                placeholder="Project name"
                                required
                                className="p-2 w-full rounded-md bg-secondary border border-border"
                            />
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-secondary-foreground">Color:</span>
                                <div className="flex gap-2">
                                    {projectColors.map(color => (
                                        <button
                                            type="button"
                                            key={color}
                                            onClick={() => setEditProjectFormData(prev => ({...prev, color}))}
                                            className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 ${editProjectFormData.color === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
                                            style={{ backgroundColor: color }}
                                            aria-label={`Select color ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={closeProjectEditModal} className="bg-secondary hover:bg-border text-foreground p-2 px-4 rounded-md">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-4 rounded-md">
                                    Update Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEditModalOpen && editingGoal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md m-4">
                        <h2 className="text-lg font-bold mb-4">Edit Time Goal</h2>
                        <form onSubmit={handleUpdateGoal} className="space-y-4">
                            <input
                                type="text"
                                name="description"
                                value={editFormData.description}
                                onChange={handleEditFormChange}
                                placeholder="Goal description"
                                required
                                className="p-2 w-full rounded-md bg-secondary border border-border"
                            />
                            <select
                                name="projectId"
                                value={editFormData.projectId}
                                onChange={handleEditFormChange}
                                className="p-2 w-full rounded-md bg-secondary border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                            >
                                <option value="">No Project</option>
                                {projects?.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <div className="flex gap-4">
                                <input
                                    type="number"
                                    name="targetHours"
                                    value={editFormData.targetHours}
                                    onChange={handleEditFormChange}
                                    placeholder="Target hours"
                                    min="0"
                                    required
                                    className="p-2 w-full rounded-md bg-secondary border border-border"
                                />
                                <input
                                    type="number"
                                    name="actualHours"
                                    value={editFormData.actualHours}
                                    onChange={handleEditFormChange}
                                    placeholder="Hours completed"
                                    min="0"
                                    step="0.1"
                                    className="p-2 w-full rounded-md bg-secondary border border-border"
                                />
                            </div>
                            <input
                                type="date"
                                name="deadline"
                                value={editFormData.deadline}
                                onChange={handleEditFormChange}
                                className="p-2 w-full rounded-md bg-secondary border border-border"
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={closeEditModal} className="bg-secondary hover:bg-border text-foreground p-2 px-4 rounded-md">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-4 rounded-md">
                                    Update Goal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};