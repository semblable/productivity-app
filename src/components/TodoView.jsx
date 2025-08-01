import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useEffect } from 'react';
import { db } from '../db/db';
import { AddTaskForm } from './AddTaskForm';
import { TaskItem } from './TaskItem';
import { FolderHeader } from './FolderHeader';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableTaskList } from './SortableTaskList';
import { AddFolderForm } from './AddFolderForm';

export const TodoView = ({ onStartFocus }) => {
    const projects = useLiveQuery(() => db.projects.toArray(), []);
    
    // Local UI state for filters / search
    const [searchTerm, setSearchTerm] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');
    const [showCompleted, setShowCompleted] = useState(true);
    const [folderFilter, setFolderFilter] = useState('all');
    const [activeTask, setActiveTask] = useState(null);

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

    // Folders for the selected project (if any)
    const folders = useLiveQuery(() => {
        if (projectFilter === 'all') return db.folders.toArray();
        return db.folders.where({ projectId: Number(projectFilter) }).toArray();
    }, [projectFilter]);

    // Reset folder filter when switching projects or to 'all'
    useEffect(() => {
        setFolderFilter('all');
    }, [projectFilter]);

    // --- DND sensors ---
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    if (!tasks || !projects) return <div className="text-muted-foreground">Loading...</div>;

    const handleDragStart = (event) => {
        const { active } = event;
        const taskId = Number(String(active.id).replace('task-',''));
        const task = tasks.find(t => t.id === taskId);
        setActiveTask(task);
    };

    // Handle drag end
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveTask(null);
        if (!over) return;
        if (active.id === over.id) return;

        const activeTaskId = Number(String(active.id).replace('task-',''));
        // If dropped on folder header
        if (String(over.id).startsWith('folder-')) {
            const folderStr = String(over.id).replace('folder-','');
            const newFolderId = folderStr === 'null' ? null : Number(folderStr);
            await db.tasks.update(activeTaskId, { folderId: newFolderId, order: Date.now() });
            return;
        }
        // Dropped over another task (reorder)
        if (String(over.id).startsWith('task-')) {
            const overTaskId = Number(String(over.id).replace('task-',''));
            
            // This is a complex calculation, so we get all tasks to be safe
            const allTasks = await db.tasks.toArray();
            const overTask = allTasks.find(t => t.id === overTaskId);
            if (!overTask) return;

            // Find tasks in the same list (same folderId)
            const siblings = allTasks
                .filter(t => t.folderId === overTask.folderId)
                .sort((a, b) => a.order - b.order);

            const overTaskIndex = siblings.findIndex(t => t.id === overTaskId);
            
            // Get order of task before and after the drop target
            const prevTaskOrder = siblings[overTaskIndex - 1]?.order || null;
            const nextTaskOrder = siblings[overTaskIndex]?.order || null;
            
            let newOrder;
            if (prevTaskOrder !== null && nextTaskOrder !== null) {
                // Average between the two
                newOrder = (prevTaskOrder + nextTaskOrder) / 2;
            } else if (prevTaskOrder !== null) {
                // Dropped at the end, add 1 to the last order
                newOrder = prevTaskOrder + 1;
            } else if (nextTaskOrder !== null) {
                // Dropped at the beginning, subtract 1 from the first order
                newOrder = nextTaskOrder - 1;
            } else {
                // Only one item in the list
                newOrder = Date.now();
            }
            
            await db.tasks.update(activeTaskId, { folderId: overTask.folderId ?? null, order: newOrder });
        }
    };

    // --- Filtering logic ---
    const filtered = tasks.filter(task => {
        const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = projectFilter === 'all' || String(task.projectId) === projectFilter;
                const matchesFolder = projectFilter === 'all' 
            ? true 
            : folderFilter === 'all' 
                ? true 
                : (folderFilter === 'ungrouped' ? !task.folderId : String(task.folderId) === folderFilter);

        return matchesSearch && matchesProject && matchesFolder;
    });

    const incompleteTasks = filtered.filter(t => !t.completed);
    const completedTasks = filtered.filter(t => t.completed);

    // Optionally hide completed tasks
    const visibleCompleted = showCompleted ? completedTasks : [];

    // ---- Build task list content based on grouping ----
    let taskListContent;
    if (projectFilter === 'all') {
        // Group by project, then by folder
        const groupedByProject = incompleteTasks.reduce((acc, task) => {
            const projectKey = task.projectId || 'none';
            if (!acc[projectKey]) {
                acc[projectKey] = { ungrouped: [], byFolder: {} };
            }

            if (task.folderId) {
                if (!acc[projectKey].byFolder[task.folderId]) {
                    acc[projectKey].byFolder[task.folderId] = [];
                }
                acc[projectKey].byFolder[task.folderId].push(task);
            } else {
                acc[projectKey].ungrouped.push(task);
            }
            return acc;
        }, {});

        taskListContent = Object.entries(groupedByProject).map(([projectId, { ungrouped, byFolder }]) => {
            const project = projectMap[projectId];
            const projectFolders = folders?.filter(f => f.projectId === Number(projectId)) || [];
            
            return (
                <div key={projectId} className="mb-6">
                    <h3 className="text-lg font-bold text-primary mb-3 border-b border-border pb-2">{project?.name || 'No Project'}</h3>
                    {projectFolders.map(folder => (
                        <FolderHeader key={folder.id} folder={folder}>
                            <SortableTaskList tasks={byFolder[folder.id] || []} projects={projects} projectMap={projectMap} onStartFocus={onStartFocus} />
                        </FolderHeader>
                    ))}
                    {ungrouped.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2 ml-4">Ungrouped</h4>
                            <SortableTaskList tasks={ungrouped} projects={projects} projectMap={projectMap} onStartFocus={onStartFocus} />
                        </div>
                    )}
                </div>
            );
        });
    } else {
        // Group by folder when a specific project is selected
        const ungrouped = incompleteTasks.filter(t => !t.folderId);
        const groupedByFolder = incompleteTasks.filter(t => t.folderId).reduce((acc, t) => {
            (acc[t.folderId] = acc[t.folderId] || []).push(t);
            return acc;
        }, {});

        taskListContent = (
            <>
                {folders?.map(folder => (
                    <FolderHeader key={folder.id} folder={folder}>
                        <SortableTaskList tasks={groupedByFolder[folder.id] || []} projects={projects} projectMap={projectMap} onStartFocus={onStartFocus} />
                    </FolderHeader>
                ))}
                {ungrouped.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Ungrouped</h4>
                        <SortableTaskList tasks={ungrouped} projects={projects} projectMap={projectMap} onStartFocus={onStartFocus} />
                    </div>
                )}
            </>
        );
    }

        return (
    <>
        <DndContext  
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
        <div className="space-y-6">
            {/* Add Task / Folder */}
            <div className="space-y-3">
                <AddTaskForm projects={projects} />
                <AddFolderForm projectId={projectFilter !== 'all' ? projectFilter : undefined} />
            </div>

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
                {projectFilter !== 'all' && (
                    <select
                        value={folderFilter}
                        onChange={e => setFolderFilter(e.target.value)}
                        className="p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                        <option value="all">All Folders</option>
                        {folders?.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                        <option value="ungrouped">Ungrouped</option>
                    </select>
                )}
                <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" className="h-4 w-4" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
                    Show completed
                </label>
            </div>

            {/* Task list */}
            <div className="space-y-6">
                {taskListContent /* generated above */}

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
                </DndContext>
        <DragOverlay>
            {activeTask ? <TaskItem task={activeTask} project={projectMap[activeTask.projectId]} isOverlay /> : null}
        </DragOverlay>
    </>
    );
}; 