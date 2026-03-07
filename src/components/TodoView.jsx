import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { AddTaskForm } from './AddTaskForm';
import { TaskItem } from './TaskItem';
import { FolderHeader } from './FolderHeader';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import toast from 'react-hot-toast';
import { SortableTaskList } from './SortableTaskList';
import { AddFolderForm } from './AddFolderForm';
import { normalizeNullableId, normalizeId } from '../db/id-utils';
import { api } from '../api/apiClient';
import { useFolders, useProjects, useTasks } from '../hooks/useAppData';

export const TodoView = ({ onStartFocus }) => {
    const queryClient = useQueryClient();
    const { appState, setState, clearSelection, addSelectedTask } = useAppContext();
    const { data: projects = [] } = useProjects();
    
    // Local UI state for filters / search
    const [searchTerm, setSearchTerm] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');
    const [showCompleted, setShowCompleted] = useState(true);
    const [folderFilter, setFolderFilter] = useState('all');
    const [activeTask, setActiveTask] = useState(null);
    
    // Drag selection state
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
    const [dragCurrentPos, setDragCurrentPos] = useState({ x: 0, y: 0 });

    // Custom sorting: priority(desc) then creation date(desc)
    const { data: allTasks = [] } = useTasks();
    const tasks = useMemo(() => {
        const all = allTasks
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Filter out template tasks (those with rrule but no templateId) and database-level subtasks
        const topLevel = all.filter(t => {
            // Hide recurring templates (tasks with rrule but no templateId)
            if (t.rrule && !t.templateId) return false;
            // Hide database-level subtasks (keep parentId filtering for any remaining subtasks)
            if (t.parentId !== null && t.parentId !== undefined) return false;
            return true;
        });
        return topLevel.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }, [allTasks]);

    const projectMap = projects?.reduce((map, proj) => {
        map[proj.id] = proj;
        return map;
    }, {}) || {};

    // Folders for the selected project (if any)
    const { data: allFolders = [] } = useFolders();
    const folders = useMemo(() => {
        if (projectFilter === 'all') return allFolders;
        return allFolders.filter((folder) => String(folder.projectId) === String(projectFilter));
    }, [allFolders, projectFilter]);

    // Reset folder filter when switching projects or to 'all'
    useEffect(() => {
        setFolderFilter('all');
    }, [projectFilter]);

    // --- Filtering logic - moved up to avoid "used before defined" issues ---
    const filtered = tasks?.filter(task => {
        const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = projectFilter === 'all' || String(task.projectId) === String(projectFilter);
        const matchesFolder = projectFilter === 'all' 
            ? true 
            : folderFilter === 'all' 
                ? true 
                : (folderFilter === 'ungrouped' ? !task.folderId : String(task.folderId) === folderFilter);

        return matchesSearch && matchesProject && matchesFolder;
    }) || [];

    const incompleteTasks = filtered.filter(t => !t.completed);
    const completedTasks = filtered.filter(t => t.completed);

    // Optionally hide completed tasks - wrapped in useMemo to prevent dependency changes
    const visibleCompleted = useMemo(() => {
        return showCompleted ? completedTasks : [];
    }, [showCompleted, completedTasks]);

    // --- DND sensors ---
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    // Helper functions for drag selection
    const getSelectionRect = useCallback(() => {
        return {
            left: Math.min(dragStartPos.x, dragCurrentPos.x),
            top: Math.min(dragStartPos.y, dragCurrentPos.y),
            right: Math.max(dragStartPos.x, dragCurrentPos.x),
            bottom: Math.max(dragStartPos.y, dragCurrentPos.y)
        };
    }, [dragStartPos, dragCurrentPos]);

    const isIntersecting = useCallback((rect1, rect2) => {
        return !(rect1.right < rect2.left || 
                rect1.left > rect2.right || 
                rect1.bottom < rect2.top || 
                rect1.top > rect2.bottom);
    }, []);

    // Drag selection handlers - wrapped in useCallback to fix dependency warnings
    const handleMouseMove = useCallback((e) => {
        if (!isDragSelecting) return;
        setDragCurrentPos({ x: e.clientX, y: e.clientY });
        
        // Throttle DOM queries for performance
        if (Date.now() - (handleMouseMove.lastQuery || 0) < 16) return; // ~60fps
        handleMouseMove.lastQuery = Date.now();
        
        // Get all task elements and check which ones intersect with selection box
        const taskElements = document.querySelectorAll('[data-task-item]');
        const selectionRect = getSelectionRect();
        
        taskElements.forEach(element => {
            const taskRect = element.getBoundingClientRect();
            const taskIdStr = element.getAttribute('data-task-id');
            const taskId = taskIdStr ? normalizeId(taskIdStr) : null;
            
            if (taskId != null && isIntersecting(selectionRect, taskRect)) {
                if (!appState.selectedTaskIds.has(taskId)) {
                    addSelectedTask(taskId);
                }
            }
        });
    }, [isDragSelecting, getSelectionRect, isIntersecting, appState.selectedTaskIds, addSelectedTask]);

    const handleMouseUp = useCallback(() => {
        setIsDragSelecting(false);
        // Clean up any remaining event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = (e) => {
        if (!appState.multiSelectMode) return;
        if (e.target.closest('[data-task-item]') || e.target.closest('button') || e.target.closest('input')) return;
        
        // Add delay to avoid conflicts with dnd-kit
        const startPos = { x: e.clientX, y: e.clientY };
        setDragStartPos(startPos);
        
        const handleMouseMoveStart = (moveEvent) => {
            const distance = Math.sqrt(
                Math.pow(moveEvent.clientX - startPos.x, 2) + 
                Math.pow(moveEvent.clientY - startPos.y, 2)
            );
            
            // Only start drag selection after moving 8px (more than dnd-kit's 4px)
            if (distance > 8) {
                setIsDragSelecting(true);
                setDragCurrentPos({ x: moveEvent.clientX, y: moveEvent.clientY });
                document.removeEventListener('mousemove', handleMouseMoveStart);
            }
        };
        
        const handleMouseUpStart = () => {
            document.removeEventListener('mousemove', handleMouseMoveStart);
            document.removeEventListener('mouseup', handleMouseUpStart);
        };
        
        document.addEventListener('mousemove', handleMouseMoveStart);
        document.addEventListener('mouseup', handleMouseUpStart);
        
        e.preventDefault();
    };



    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (isDragSelecting) {
                    setIsDragSelecting(false);
                } else if (appState.selectedTaskIds.size > 0) {
                    clearSelection();
                }
            }
            if (e.key === 'a' && (e.ctrlKey || e.metaKey) && appState.multiSelectMode) {
                e.preventDefault();
                // Select all visible tasks
                const visibleTasks = [...incompleteTasks, ...visibleCompleted];
                visibleTasks.forEach(task => addSelectedTask(task.id));
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragSelecting, appState.selectedTaskIds.size, appState.multiSelectMode, addSelectedTask, clearSelection, handleMouseMove, handleMouseUp, incompleteTasks, visibleCompleted]);



    if (!tasks || !projects) return <div className="text-muted-foreground">Loading...</div>;

    const handleDragStart = (event) => {
        const { active } = event;
            const taskId = String(active.id).replace('task-','');
            const task = tasks.find(t => String(t.id) === taskId);
        setActiveTask(task);
    };

    // Handle drag end
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveTask(null);
        if (!over) return;

        // ---- Multi-select move to folder ----
        if (appState.multiSelectMode && appState.selectedTaskIds.size > 0) {
            if (String(over.id).startsWith('folder-')) {
                const folderStr = String(over.id).replace('folder-','');
                const newFolderId = folderStr === 'null' ? null : folderStr;
                const idsToMove = Array.from(appState.selectedTaskIds);
                
                try {
                    // Use transaction to ensure atomicity
                    const existingTasks = tasks.filter((task) => idsToMove.includes(task.id));
                    const existingIds = existingTasks.map((task) => task.id);

                    if (existingIds.length > 0) {
                        const baseOrder = Date.now();
                        await Promise.all(
                            existingIds.map((id, index) =>
                                api.tasks.update(id, {
                                    folderId: normalizeNullableId(newFolderId),
                                    order: baseOrder + index
                                })
                            )
                        );
                        await queryClient.invalidateQueries();
                    }
                    clearSelection();
                    return;
                } catch (error) {
                    console.error('Failed to move selected tasks:', error);
                    toast.error('Failed to move some tasks');
                    return;
                }
            }
        }

        // ---- Single-item logic (unchanged) ----
        if (active.id === over.id) return;
        const activeTaskId = String(active.id).replace('task-','');

        // If dropped on folder header
        if (String(over.id).startsWith('folder-')) {
            const folderStr = String(over.id).replace('folder-','');
            const newFolderId = folderStr === 'null' ? null : folderStr;
            await api.tasks.update(activeTaskId, { folderId: normalizeNullableId(newFolderId), order: Date.now() });
            await queryClient.invalidateQueries();
            return;
        }
        // Dropped over another task (reorder)
        if (String(over.id).startsWith('task-')) {
            const overTaskId = String(over.id).replace('task-','');
            
            // This is a complex calculation, so we get all tasks to be safe
            const overTask = tasks.find(t => String(t.id) === overTaskId);
            if (!overTask) return;

            // Find tasks in the same list (same folderId)
            const siblings = tasks
                .filter(t => t.folderId === overTask.folderId)
                .sort((a, b) => a.order - b.order);

            const overTaskIndex = siblings.findIndex(t => String(t.id) === overTaskId);
            
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
            
            await api.tasks.update(activeTaskId, { folderId: overTask.folderId ?? null, order: newOrder });
            await queryClient.invalidateQueries();
        }
    };



    // Prepare grouped map for folder-based rendering (used when a single project is selected)
    const groupedByFolder = incompleteTasks.filter(t => t.folderId).reduce((acc, t) => {
        (acc[t.folderId] = acc[t.folderId] || []).push(t);
        return acc;
    }, {});

    // Helper to recursively render folders with indentation (for single project view)
    const renderFolder = (folder, level = 0) => {
        return (
            <FolderHeader key={folder.id} folder={folder} style={{ marginLeft: level * 16 }}>
                <SortableTaskList
                    tasks={groupedByFolder[folder.id] || []}
                    projects={projects}
                    projectMap={projectMap}
                    onStartFocus={onStartFocus}
                />
                {folders?.filter(f => String(f.parentId) === String(folder.id)).map(child => renderFolder(child, level + 1))}
            </FolderHeader>
        );
    };

    // Helper to recursively render folders for "All Projects" view
    const renderProjectFolder = (folder, projectFolders, byFolder, level = 0) => {
        return (
            <FolderHeader key={folder.id} folder={folder} className={level > 0 ? `ml-${level * 4}` : ''}>
                <SortableTaskList 
                    tasks={byFolder[folder.id] || []} 
                    projects={projects} 
                    projectMap={projectMap} 
                    onStartFocus={onStartFocus} 
                />
                {projectFolders.filter(child => String(child.parentId) === String(folder.id)).map(child => 
                    renderProjectFolder(child, projectFolders, byFolder, level + 1)
                )}
            </FolderHeader>
        );
    };

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
            const projectFolders = folders?.filter(f => String(f.projectId) === String(projectId)) || [];
            
            return (
                <div key={projectId} className="mb-6">
                    <h3 className="text-lg font-bold text-primary mb-3 border-b border-border pb-2">{project?.name || 'No Project'}</h3>
                    {projectFolders.filter(f=> f.parentId == null).map(folder => 
                        renderProjectFolder(folder, projectFolders, byFolder)
                    )}
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

        taskListContent = (
            <>
                {/* Render root-level folders (parentId === null) recursively */}
                {folders?.filter(f => f.parentId == null).map(folder => renderFolder(folder))}
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
        <div 
            className="space-y-6 relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
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
                <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" className="h-4 w-4" checked={appState.multiSelectMode} onChange={e => setState({ multiSelectMode: e.target.checked })} />
                    Multi-select
                </label>
                {appState.multiSelectMode && (
                    <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            appState.selectedTaskIds.size > 0 
                                ? 'bg-primary/20 text-primary border border-primary/30' 
                                : 'bg-muted text-muted-foreground'
                        }`}>
                            {appState.selectedTaskIds.size} selected
                        </span>
                        {appState.selectedTaskIds.size > 0 && (
                            <button
                                onClick={clearSelection}
                                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                )}
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
            
            {/* Selection Box Overlay */}
            {isDragSelecting && (
                <div
                    style={{
                        position: 'fixed',
                        left: Math.min(dragStartPos.x, dragCurrentPos.x),
                        top: Math.min(dragStartPos.y, dragCurrentPos.y),
                        width: Math.abs(dragCurrentPos.x - dragStartPos.x),
                        height: Math.abs(dragCurrentPos.y - dragStartPos.y),
                        border: '2px dashed #3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        pointerEvents: 'none',
                        zIndex: 1000
                    }}
                />
            )}
        </div>
                </DndContext>
        <DragOverlay>
            {activeTask ? <TaskItem task={activeTask} project={projectMap[activeTask.projectId]} isOverlay /> : null}
        </DragOverlay>
    </>
    );
}; 