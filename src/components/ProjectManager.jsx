import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../api/queryKeys';
import { projectColors } from '../db/db';
import { useGoals, createGoal, updateGoal as updateGoalRepo, deleteGoal as deleteGoalRepo, deleteGoalsByProjectId } from '../db/goals-repository';
import { cancelScheduledNotification, clearEventNotificationFlags } from '../hooks/useNotifications';
import { normalizeNullableId } from '../db/id-utils';
import { Plus, Trash2, Play, Edit } from 'lucide-react';
import { DAY_SELECTOR, PRESET_WEEKDAYS, PRESET_ALL_DAYS, calculateDailyPlan, formatHours } from '../utils/goalSchedule';
import { api } from '../api/apiClient';
import { useProjects, useTimeEntries } from '../hooks/useAppData';

export const ProjectManager = ({ onStartGoalTimer }) => {
    const queryClient = useQueryClient();
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedColor, setSelectedColor] = useState(projectColors[0]);
    const { data: projects = [] } = useProjects();
    const goals = useGoals();
    const { data: timeEntries = [] } = useTimeEntries();

    // goalId → total tracked seconds from time entries tagged to each goal
    const goalTimeMap = useMemo(() => {
        if (!timeEntries) return {};
        return timeEntries.reduce((map, entry) => {
            if (entry.goalId) {
                const key = String(entry.goalId);
                map[key] = (map[key] || 0) + (Number(entry.duration) || 0);
            }
            return map;
        }, {});
    }, [timeEntries]);

    // Enrich each goal with its real tracked hours so the display always
    // matches the time tracker. Multiple goals in the same project track
    // independently — only entries explicitly tagged to a goal count for it.
    const enrichedGoals = useMemo(() => {
        if (!goals) return [];
        return goals.map(goal => {
            const totalSeconds = goalTimeMap[String(goal.id)] || 0;
            const actualHours = totalSeconds / 3600;
            const progress = goal.targetHours > 0
                ? Math.min(100, Math.round((actualHours / goal.targetHours) * 100))
                : 0;
            return { ...goal, actualHours, progress };
        });
    }, [goals, goalTimeMap]);

    // New state for time goals
    const [goalDescription, setGoalDescription] = useState('');
    const [targetHours, setTargetHours] = useState('');
    const [deadline, setDeadline] = useState('');
    const [startDate, setStartDate] = useState('');
    const [scheduleDays, setScheduleDays] = useState(PRESET_WEEKDAYS);
    const [hoursCompleted, setHoursCompleted] = useState(0);
    const [goalProjectId, setGoalProjectId] = useState('');
    const [errors, setErrors] = useState({});

    // Live preview of the daily plan for the add form
    const addFormPlanPreview = useMemo(() => {
        const hours = parseFloat(targetHours);
        if (!startDate || !deadline || isNaN(hours) || hours <= 0 || scheduleDays.length === 0) return null;
        return calculateDailyPlan({
            targetHours: hours,
            actualHours: parseFloat(hoursCompleted) || 0,
            startDate,
            deadline,
            scheduleDays,
        });
    }, [targetHours, hoursCompleted, startDate, deadline, scheduleDays]);

    // State for editing goals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [editFormData, setEditFormData] = useState({
        description: '',
        targetHours: '',
        actualHours: '',
        deadline: '',
        startDate: '',
        scheduleDays: PRESET_WEEKDAYS,
        projectId: '',
    });

    // Live preview of the daily plan for the edit form
    const editFormPlanPreview = useMemo(() => {
        const hours = parseFloat(editFormData.targetHours);
        if (!editFormData.startDate || !editFormData.deadline || isNaN(hours) || hours <= 0 || editFormData.scheduleDays.length === 0) return null;
        return calculateDailyPlan({
            targetHours: hours,
            actualHours: parseFloat(editFormData.actualHours) || 0,
            startDate: editFormData.startDate,
            deadline: editFormData.deadline,
            scheduleDays: editFormData.scheduleDays,
        });
    }, [editFormData]);

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
            await api.projects.create({
                name: newProjectName.trim(),
                color: selectedColor,
                createdAt: new Date()
            });
            await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
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

        if (startDate && deadline) {
            const start = new Date(startDate);
            const end = new Date(deadline);
            if (isNaN(start.getTime())) {
                newErrors.startDate = "Start date is invalid";
                hasErrors = true;
            }
            if (isNaN(end.getTime())) {
                newErrors.deadline = "Deadline date is invalid";
                hasErrors = true;
            }
            if (!newErrors.startDate && !newErrors.deadline && start > end) {
                newErrors.deadline = "Deadline must be on or after Start Date";
                hasErrors = true;
            }
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
            startDate: startDate || null,
            scheduleDays: scheduleDays.length > 0 ? scheduleDays : null,
            progress,
            createdAt: new Date(),
            projectId: normalizeNullableId(goalProjectId),
        };

        try {
            await createGoal(newGoal);
            await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
            setGoalDescription('');
            setTargetHours('');
            setDeadline('');
            setStartDate('');
            setScheduleDays(PRESET_WEEKDAYS);
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
            const seconds = Math.round(parseFloat(hours) * 3600);
            if (!isNaN(seconds) && seconds !== 0) {
                const goal = goals?.find(g => String(g.id) === String(goalId));
                const endTime = new Date();
                const startTime = new Date(endTime.getTime() - Math.abs(seconds) * 1000);
                await api.timeEntries.create({
                    description: goal?.description || 'Manual log',
                    projectId: goal?.projectId ?? null,
                    goalId,
                    startTime,
                    endTime,
                    duration: seconds,
                });
                await api.goals.recalculate(goalId);
                await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
                await queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries });
                toast.success("Hours logged!");
            } else {
                toast.error("Please enter a valid number of hours.");
            }
        } catch (error) {
            console.error("Failed to log hours:", error);
            toast.error("Failed to log hours.");
        }
    };

    const handleSetTotalHours = async (goal, newTotal) => {
        if (isNaN(newTotal) || newTotal < 0) return;
        const original = goal.actualHours || 0;
        const diffHours = newTotal - original;
        if (diffHours === 0) return;
        const seconds = Math.round(diffHours * 3600);
        try {
            await api.timeEntries.create({
                description: 'Manual adjustment',
                projectId: goal.projectId || null,
                goalId: goal.id,
                startTime: new Date(),
                endTime: new Date(),
                duration: seconds,
            });
            await api.goals.recalculate(goal.id);
            await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
            await queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries });
            toast.success("Total hours updated!");
        } catch (e) {
            console.error("Failed to update total hours:", e);
            toast.error("Failed to update total hours");
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
                                // console.log('[Goal] Deleting goal', id);
                                await deleteGoalRepo(id);
                                await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
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
                                await api.projects.remove(id);
                                const tasksToDelete = await api.tasks.list({ projectId: normalizeNullableId(id) });
                                if (tasksToDelete.length > 0) {
                                    await api.tasks.bulkRemove(tasksToDelete.map((task) => task.id));
                                }
                                const eventsToDelete = await api.events.list({ projectId: normalizeNullableId(id) });
                                // Cancel any pending notifications and clear flags for these events
                                eventsToDelete.forEach((event) => {
                                    cancelScheduledNotification(`event-finish-${event.id}`);
                                    clearEventNotificationFlags(event.id);
                                });
                                // Delete time entries linked to these events
                                if (eventsToDelete.length > 0) {
                                    const teIds = await api.timeEntries.list({
                                        eventId_in: eventsToDelete.map((event) => event.id).join(','),
                                    });
                                    if (teIds.length > 0) {
                                        await api.timeEntries.bulkRemove(teIds.map((entry) => entry.id));
                                    }
                                }
                                if (eventsToDelete.length > 0) {
                                    await api.events.bulkRemove(eventsToDelete.map((event) => event.id));
                                }
                                // Delete time entries directly tied to this project (no eventId)
                                const directTeIds = await api.timeEntries.list({ projectId: normalizeNullableId(id) });
                                if (directTeIds.length > 0) {
                                    await api.timeEntries.bulkRemove(directTeIds.map((entry) => entry.id));
                                }
                                await deleteGoalsByProjectId(id);
                                // Also delete associated folders
                                const foldersToDelete = await api.folders.list({ projectId: normalizeNullableId(id) });
                                if (foldersToDelete.length > 0) {
                                    await api.folders.bulkRemove(foldersToDelete.map((folder) => folder.id));
                                }

                                await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
                                await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
                                await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
                                await queryClient.invalidateQueries({ queryKey: queryKeys.events });
                                await queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries });
                                await queryClient.invalidateQueries({ queryKey: queryKeys.folders });
                                toast.success("Project deleted.");
                            } catch (error) {
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
            actualHours: goal.actualHours != null ? Math.round(goal.actualHours * 100) / 100 : goal.actualHours,
            deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
            startDate: goal.startDate ? new Date(goal.startDate).toISOString().split('T')[0] : '',
            scheduleDays: goal.scheduleDays && goal.scheduleDays.length > 0 ? goal.scheduleDays : PRESET_WEEKDAYS,
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

    const toggleAddScheduleDay = (dayNum) => {
        setScheduleDays(prev => {
            const next = prev.includes(dayNum)
                ? prev.filter(d => d !== dayNum)
                : [...prev, dayNum].sort((a, b) => a - b);
            return next;
        });
    };

    const toggleEditScheduleDay = (dayNum) => {
        setEditFormData(prev => {
            const current = prev.scheduleDays || [];
            const next = current.includes(dayNum)
                ? current.filter(d => d !== dayNum)
                : [...current, dayNum].sort((a, b) => a - b);
            return { ...prev, scheduleDays: next };
        });
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        if (!editingGoal) return;

        const { description, targetHours, actualHours, deadline, startDate, scheduleDays, projectId } = editFormData;
        const hours = parseFloat(targetHours);
        const completed = parseFloat(actualHours);
        if (startDate && deadline) {
            const start = new Date(startDate);
            const end = new Date(deadline);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return toast.error("Please provide valid start and deadline dates.");
            }
            if (start > end) {
                return toast.error("Deadline must be on or after start date.");
            }
        }

        if (!description.trim() || isNaN(hours) || hours <= 0 || isNaN(completed) || completed < 0) {
            return toast.error("Please fill in all required fields correctly.");
        }



        try {
            const originalCompleted = editingGoal.actualHours || 0;
            const targetProjectId = normalizeNullableId(projectId);

            await updateGoalRepo(editingGoal.id, {
                description: description.trim(),
                targetHours: hours,
                deadline: deadline || null,
                startDate: startDate || null,
                scheduleDays: scheduleDays && scheduleDays.length > 0 ? scheduleDays : null,
                projectId: targetProjectId,
            });

            if (completed !== originalCompleted) {
                const diffHours = completed - originalCompleted;
                const seconds = Math.round(diffHours * 3600);
                if (seconds !== 0) {
                    await api.timeEntries.create({
                        description: 'Manual adjustment',
                        projectId: targetProjectId,
                        goalId: editingGoal.id,
                        startTime: new Date(),
                        endTime: new Date(),
                        duration: seconds,
                    });
                    await api.goals.recalculate(editingGoal.id);
                    await queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries });
                }
            }

            await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
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
            await api.projects.update(editingProject.id, {
                name: name.trim(),
                color: color
            });
            await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
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
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color || '#64748b' }}></span>
                            <span className="text-secondary-foreground">{project.name}</span>
                        </div>
                        <div className="flex gap-2 transition-opacity">
                            <button aria-label={`Edit project ${project.name}`} onClick={() => openProjectEditModal(project)} className="text-blue-500">
                                <Edit size={16} />
                            </button>
                            <button aria-label={`Delete project ${project.name}`} onClick={() => deleteProject(project.id)} className="text-accent">
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
                                className={`p-2 w-full rounded-md bg-secondary border ${errors.description ? 'border-accent' : 'border-border'
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
                                    step="any"
                                    required
                                    className={`p-2 w-full rounded-md bg-secondary border ${errors.targetHours ? 'border-accent' : 'border-border'
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
                                    step="any"
                                    className={`p-2 w-full rounded-md bg-secondary border ${errors.hoursCompleted ? 'border-accent' : 'border-border'
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
                                    placeholder="Deadline"
                                />
                                <span className="text-xs text-muted-foreground ml-1">Deadline</span>
                                {errors.deadline && (
                                    <p className="text-accent text-sm mt-1">{errors.deadline}</p>
                                )}
                            </div>

                            <div className="flex-1 min-w-[150px]">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="p-2 w-full rounded-md bg-secondary border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                                    data-testid="start-date-input"
                                />
                                <span className="text-xs text-muted-foreground ml-1">Start Date</span>
                                {errors.startDate && (
                                    <p className="text-accent text-sm mt-1">{errors.startDate}</p>
                                )}
                            </div>
                        </div>

                        {/* Schedule days selector */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground font-medium">Schedule:</span>
                                <button
                                    type="button"
                                    onClick={() => setScheduleDays(PRESET_WEEKDAYS)}
                                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${JSON.stringify(scheduleDays) === JSON.stringify(PRESET_WEEKDAYS)
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-secondary border-border text-muted-foreground hover:border-primary'
                                        }`}
                                >
                                    Weekdays
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScheduleDays(PRESET_ALL_DAYS)}
                                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${scheduleDays.length === 7
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-secondary border-border text-muted-foreground hover:border-primary'
                                        }`}
                                >
                                    Every Day
                                </button>
                            </div>
                            <div className="flex gap-1">
                                {DAY_SELECTOR.map(({ label, value }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => toggleAddScheduleDay(value)}
                                        className={`w-8 h-8 rounded-full text-xs font-medium border transition-colors ${scheduleDays.includes(value)
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-secondary border-border text-muted-foreground hover:border-primary'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Daily plan preview */}
                        {addFormPlanPreview && (
                            <div className={`text-xs px-3 py-2 rounded-md border flex items-center gap-2 ${addFormPlanPreview.isOnTrack
                                ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                }`}>
                                <span>
                                    {addFormPlanPreview.totalAvailableDays} available days &middot;{' '}
                                    {addFormPlanPreview.dailyHoursRequired !== null
                                        ? <><strong>{formatHours(addFormPlanPreview.dailyHoursRequired)}/day</strong> required</>
                                        : 'deadline has passed'
                                    }
                                </span>
                            </div>
                        )}

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
                {goals && goals.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-md font-semibold mb-3">Current Goals</h3>
                        <ul className="space-y-3">
                            {enrichedGoals.map(goal => {
                                return (
                                    <li key={goal.id} className="p-3 rounded-md bg-secondary" data-testid="goal-item">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-grow min-w-0">
                                                <p className="font-medium">{goal.description}</p>
                                                <p className="text-sm text-secondary-foreground mt-1">
                                                    {goal.targetHours} hours {goal.deadline ? `by ${new Date(goal.deadline).toLocaleDateString()}` : '(No deadline)'}
                                                </p>
                                                <div className="flex items-center gap-1 mt-1 text-sm">
                                                    <span>Completed:</span>
                                                    <input
                                                        key={`goal-actual-${goal.id}-${(goal.actualHours || 0).toFixed(4)}`}
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        defaultValue={goal.actualHours ? parseFloat(goal.actualHours.toFixed(2)) : 0}
                                                        onBlur={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            const currentVal = goal.actualHours ? parseFloat(goal.actualHours.toFixed(2)) : 0;
                                                            if (!isNaN(val) && val >= 0 && val !== currentVal) {
                                                                handleSetTotalHours(goal, val);
                                                            } else if (isNaN(val) || val < 0) {
                                                                e.target.value = currentVal;
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') e.target.blur();
                                                        }}
                                                        title="Click to edit total time spent"
                                                        className="w-16 p-0 bg-transparent font-medium border-b border-dashed border-primary/50 text-center hover:bg-secondary focus:bg-secondary focus:border-solid focus:outline-none transition-colors"
                                                    />
                                                    <span>/ {goal.targetHours} hours</span>
                                                </div>
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
                                            <div
                                                className="w-full bg-muted rounded-full h-2 relative overflow-hidden"
                                                role="progressbar"
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={goal.progress}
                                            >
                                                <div
                                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${goal.progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Schedule info */}
                                        {(() => {
                                            const plan = calculateDailyPlan(goal);
                                            const hasDays = goal.scheduleDays && goal.scheduleDays.length > 0;
                                            if (!plan && !hasDays) return null;
                                            return (
                                                <div className="mt-2 space-y-1">
                                                    {hasDays && (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {DAY_SELECTOR.map(({ label, value }) => (
                                                                <span
                                                                    key={value}
                                                                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${goal.scheduleDays.includes(value)
                                                                        ? 'bg-primary/20 text-primary'
                                                                        : 'bg-muted text-muted-foreground opacity-40'
                                                                        }`}
                                                                >
                                                                    {label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {plan && (
                                                        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${plan.isOnTrack
                                                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                            }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${plan.isOnTrack ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                            {plan.dailyHoursRequired !== null ? (
                                                                <>
                                                                    <strong>{formatHours(plan.dailyHoursRequired)}/day</strong>
                                                                    <span className="text-muted-foreground">&middot; {plan.remainingAvailableDays} day{plan.remainingAvailableDays !== 1 ? 's' : ''} left</span>
                                                                    {!plan.isOnTrack && plan.hoursAheadOrBehind < 0 && (
                                                                        <span>&middot; {formatHours(Math.abs(plan.hoursAheadOrBehind))} behind</span>
                                                                    )}
                                                                    {plan.isOnTrack && plan.hoursAheadOrBehind > 0.25 && (
                                                                        <span>&middot; {formatHours(plan.hoursAheadOrBehind)} ahead</span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span>Deadline passed</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
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
                                            onClick={() => setEditProjectFormData(prev => ({ ...prev, color }))}
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
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        name="targetHours"
                                        value={editFormData.targetHours}
                                        onChange={handleEditFormChange}
                                        placeholder="Target hours"
                                        min="0"
                                        step="any"
                                        required
                                        className="p-2 w-full rounded-md bg-secondary border border-border"
                                    />
                                    <span className="text-xs text-muted-foreground ml-1">Target Hours</span>
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        name="actualHours"
                                        value={editFormData.actualHours}
                                        onChange={handleEditFormChange}
                                        placeholder="Hours completed"
                                        min="0"
                                        step="any"
                                        className="p-2 w-full rounded-md bg-secondary border border-border"
                                    />
                                    <span className="text-xs text-muted-foreground ml-1">Time Spent (Hours)</span>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <input
                                        type="date"
                                        name="startDate"
                                        value={editFormData.startDate}
                                        onChange={handleEditFormChange}
                                        className="p-2 w-full rounded-md bg-secondary border border-border"
                                    />
                                    <span className="text-xs text-muted-foreground ml-1">Start Date</span>
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="date"
                                        name="deadline"
                                        value={editFormData.deadline}
                                        onChange={handleEditFormChange}
                                        className="p-2 w-full rounded-md bg-secondary border border-border"
                                    />
                                    <span className="text-xs text-muted-foreground ml-1">Deadline</span>
                                </div>
                            </div>

                            {/* Schedule days selector */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground font-medium">Schedule:</span>
                                    <button
                                        type="button"
                                        onClick={() => setEditFormData(prev => ({ ...prev, scheduleDays: PRESET_WEEKDAYS }))}
                                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${JSON.stringify(editFormData.scheduleDays) === JSON.stringify(PRESET_WEEKDAYS)
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-secondary border-border text-muted-foreground hover:border-primary'
                                            }`}
                                    >
                                        Weekdays
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditFormData(prev => ({ ...prev, scheduleDays: PRESET_ALL_DAYS }))}
                                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${editFormData.scheduleDays.length === 7
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-secondary border-border text-muted-foreground hover:border-primary'
                                            }`}
                                    >
                                        Every Day
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    {DAY_SELECTOR.map(({ label, value }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => toggleEditScheduleDay(value)}
                                            className={`w-8 h-8 rounded-full text-xs font-medium border transition-colors ${editFormData.scheduleDays.includes(value)
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-secondary border-border text-muted-foreground hover:border-primary'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Daily plan preview */}
                            {editFormPlanPreview && (
                                <div className={`text-xs px-3 py-2 rounded-md border flex items-center gap-2 ${editFormPlanPreview.isOnTrack
                                    ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                    }`}>
                                    <span>
                                        {editFormPlanPreview.totalAvailableDays} available days &middot;{' '}
                                        {editFormPlanPreview.dailyHoursRequired !== null
                                            ? <><strong>{formatHours(editFormPlanPreview.dailyHoursRequired)}/day</strong> required</>
                                            : 'deadline has passed'
                                        }
                                        {!editFormPlanPreview.isOnTrack && editFormPlanPreview.hoursAheadOrBehind < 0 && (
                                            <span className="ml-1">&mdash; {formatHours(Math.abs(editFormPlanPreview.hoursAheadOrBehind))} behind pace</span>
                                        )}
                                    </span>
                                </div>
                            )}

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
