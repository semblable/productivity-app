import { db } from '../db/db';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, Download, Star, Trash2 } from 'lucide-react';

export const DataTools = ({ onShowReview }) => {
    const fileInputRef = useRef(null);
    const legacyFileInputRef = useRef(null);

    // Catalog of our known tables (legacy and cloud)
    const LEGACY_TABLE_NAMES = [
        'projects', 'folders', 'tasks', 'goals', 'timeEntries', 'events', 'notes', 'habits', 'habit_completions'
    ];
    const CLOUD_TABLE_NAMES = [
        'projects_cloud', 'folders_cloud', 'tasks_cloud', 'events_cloud', 'goals_cloud', 'timeEntries_cloud',
        'habits_cloud', 'habit_completions_cloud', 'notes_cloud'
    ];
    const ALL_TABLE_NAMES = [...LEGACY_TABLE_NAMES, ...CLOUD_TABLE_NAMES, 'ivyLee'];

    // Ensure DB is open before inspecting physical stores
    const ensureDbOpen = async () => {
        if (!db.isOpen()) {
            await db.open();
        }
    };

    // Check if an object store physically exists in the current database
    const objectStoreExists = (name) => {
        try {
            const nativeDb = typeof db.backendDB === 'function' ? db.backendDB() : null;
            const list = nativeDb?.objectStoreNames;
            if (!list) return false;
            if (typeof list.contains === 'function') return list.contains(name);
            if (typeof list.includes === 'function') return list.includes(name);
            const arr = Array.from({ length: list.length }, (_, i) => list.item(i));
            return arr.includes(name);
        } catch {
            return false;
        }
    };

    const getExistingTable = (name) => (objectStoreExists(name) ? db.table(name) : null);

    const exportData = async () => {
       try {
            const data = {
                dbVersion: db.verno,
                exportedAt: new Date().toISOString(),
                tables: {},
            };
            
           for (const table of db.tables) {
               data.tables[table.name] = await table.toArray();
           }

           // Also back up relevant localStorage settings
           const settings = {};
           const pomodoroSettings = localStorage.getItem('pomodoroSettings');
           const theme = localStorage.getItem('theme');
           const activeTimer = localStorage.getItem('activeTimer');
           
           if (pomodoroSettings) settings.pomodoroSettings = pomodoroSettings;
           if (theme) settings.theme = theme;
           if (activeTimer) settings.activeTimer = activeTimer;
           
           // Backup notification settings
           const notificationKeys = Object.keys(localStorage).filter(key => 
               key.startsWith('notification_') || key.includes('Notification')
           );
           if (notificationKeys.length > 0) {
               settings.notifications = {};
               notificationKeys.forEach(key => {
                   settings.notifications[key] = localStorage.getItem(key);
               });
           }
           
           if (Object.keys(settings).length > 0) {
               data.settings = settings;
           }

           const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           URL.revokeObjectURL(url);
           toast.success("Data exported successfully!");
       } catch (error) {
          console.error("Export failed:", error);
           toast.error("Export failed!");
       }
    };

    const triggerImport = () => {
       fileInputRef.current.click(); // trigger hidden input
    }

    const triggerLegacyImport = () => {
        legacyFileInputRef.current.click();
    }

    const importData = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawData = JSON.parse(e.target.result);
                // Debugging
                console.debug("Backup file parsed:", rawData);
                
                // Handle both old and new formats
                // New format has a "tables" property, old format has tables at the root
                const tableData = rawData.tables ? rawData.tables : rawData;
                const dbVersion = rawData.dbVersion || 0; // Default to 0 if not present
                console.debug("Backup DB version:", dbVersion);
                const settings = rawData.settings || {};

                // Detect whether backup contains cloud tables
                const tableNames = Object.keys(tableData || {});
                const hasCloudTables = tableNames.some(name => name.endsWith('_cloud') || name === 'notes_cloud');
                const legacyTableCandidates = LEGACY_TABLE_NAMES;
                const hasLegacyTablesOnly = legacyTableCandidates.some(n => n in tableData) && !hasCloudTables;

                if (dbVersion > db.verno) {
                    throw new Error(`Backup from a newer database version (v${dbVersion}) cannot be imported into an older version (v${db.verno}). Please update the app.`);
                }
                
                const importPayload = { tableData, settings };
                console.debug("Prepared import payload:", importPayload);

                // If this looks like a legacy backup and cloud is configured, offer a seamless import+migrate
                if (hasLegacyTablesOnly && cloudConfigured) {
                    showLegacyMigrateConfirmation(importPayload, event);
                    return;
                }

                // Otherwise, standard flow (will import into whatever tables names match)
                showImportConfirmation(importPayload, event);

            } catch (error) {
                console.error("Import validation failed:", error);
                toast.error(`Import failed: ${error.message}`);
                event.target.value = null; // Reset file input
            }
        };
        reader.onerror = (error) => {
           console.error("File reading error:", error);
           toast.error("Error reading file.");
           event.target.value = null;
        }
       reader.readAsText(file);
    };

    const importLegacyData = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawData = JSON.parse(e.target.result);
                const tableData = rawData.tables ? rawData.tables : rawData;
                const settings = rawData.settings || {};

                const importPayload = { tableData, settings };
                showLegacyImportConfirmation(importPayload, event);
            } catch (error) {
                console.error("Legacy import validation failed:", error);
                toast.error(`Legacy import failed: ${error.message}`);
                event.target.value = null;
            }
        };
        reader.onerror = (error) => {
            console.error("File reading error:", error);
            toast.error("Error reading file.");
            event.target.value = null;
        };
        reader.readAsText(file);
    };

    const showImportConfirmation = (payload, inputEvent) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p>Importing will <b>overwrite all current data</b>. Are you sure?</p>
                <div className="flex gap-2 justify-end">
                    <button 
                        className="bg-accent hover:opacity-80 text-white p-1 px-3 rounded text-sm"
                        onClick={() => {
                            toast.dismiss(t.id);
                            executeImport(payload, inputEvent);
                        }}
                    >
                        Import & Overwrite
                    </button>
                    <button 
                        className="bg-secondary hover:bg-border text-foreground p-1 px-3 rounded text-sm"
                        onClick={() => {
                            toast.dismiss(t.id);
                            inputEvent.target.value = null; // Reset file input
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 10000 });
    };

    const showLegacyImportConfirmation = (payload, inputEvent) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p>Importing legacy backup will <b>overwrite legacy tables only</b> and leave cloud tables intact. Continue?</p>
                <div className="flex gap-2 justify-end">
                    <button 
                        className="bg-accent hover:opacity-80 text-white p-1 px-3 rounded text-sm"
                        onClick={() => {
                            toast.dismiss(t.id);
                            executeImportLegacy(payload, inputEvent);
                        }}
                    >
                        Import Legacy
                    </button>
                    <button 
                        className="bg-secondary hover:bg-border text-foreground p-1 px-3 rounded text-sm"
                        onClick={() => {
                            toast.dismiss(t.id);
                            inputEvent.target.value = null; // Reset file input
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 12000 });
    };

    const showLegacyMigrateConfirmation = (payload, inputEvent) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p>
                    Legacy backup detected. This will <b>import legacy tables</b> and then <b>migrate to cloud IDs</b>
                    so the app continues seamlessly with syncing. Continue?
                </p>
                <div className="flex gap-2 justify-end">
                    <button
                        className="bg-accent hover:opacity-80 text-white p-1 px-3 rounded text-sm"
                        onClick={() => {
                            toast.dismiss(t.id);
                            executeImportLegacyAndMigrate(payload, inputEvent);
                        }}
                    >
                        Import + Migrate
                    </button>
                    <button
                        className="bg-secondary hover:bg-border text-foreground p-1 px-3 rounded text-sm"
                        onClick={() => {
                            toast.dismiss(t.id);
                            inputEvent.target.value = null;
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 12000 });
    };

    const executeImport = async (payload, inputEvent) => {
        try {
            const { tableData, settings } = payload;
            console.debug("Starting import for tables:", Object.keys(tableData));

            await ensureDbOpen();
            const txTables = ALL_TABLE_NAMES.map(getExistingTable).filter(Boolean);
            if (txTables.length === 0) {
                throw new Error('No object stores available for import.');
            }
            await db.transaction('rw', ...txTables, async () => {
                // Clear only our known tables that physically exist
                for (const table of txTables) {
                    await table.clear();
                }
                
                // Import data table by table
                for (let [name, rows] of Object.entries(tableData)) {
                    console.debug(`Importing ${Array.isArray(rows) ? rows.length : 0} rows into table "${name}"`);
                    if (objectStoreExists(name)) {
                        // Data cleaning step
                        if (name === 'goals' && Array.isArray(rows)) {
                            rows = rows.map(row => {
                                const newRow = {...row};
                                // remove deprecated fields that may exist in older backups
                                delete newRow.deadline;

                                // Add any missing fields that are now required
                                if (newRow.type === undefined) newRow.type = 'time';
                                if (newRow.target === undefined) newRow.target = newRow.targetHours || 0;
                                
                                return newRow;
                            });
                        }

                        if (Array.isArray(rows) && rows.length > 0) {
                             await db.table(name).bulkAdd(rows);
                        }
                    } else {
                        console.warn(`Table "${name}" from backup not found in current database schema. Skipping.`);
                    }
                }
            });
            
            console.debug("Import transaction completed");
            
            // Restore settings from backup
            if (settings?.pomodoroSettings) {
                localStorage.setItem('pomodoroSettings', settings.pomodoroSettings);
            }
            if (settings?.theme) {
                localStorage.setItem('theme', settings.theme);
            }
            if (settings?.activeTimer) {
                localStorage.setItem('activeTimer', settings.activeTimer);
            }
            if (settings?.notifications) {
                Object.entries(settings.notifications).forEach(([key, value]) => {
                    localStorage.setItem(key, value);
                });
            }

            toast.success("Data imported successfully! Refreshing...");
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Import failed:", error);
            toast.error(`Import failed: ${error.message}`);
        } finally {
            // Make sure the file input is reset even if something goes wrong
            if (inputEvent) {
                inputEvent.target.value = null;
            }
        }
    };

    // Internal helper to perform legacy import without reloading
    const performLegacyImport = async ({ tableData, settings }) => {
        console.debug("Starting legacy import for tables:", Object.keys(tableData));

        await ensureDbOpen();
        const legacyTables = LEGACY_TABLE_NAMES
            .map(getExistingTable)
            .filter(Boolean);

        if (legacyTables.length === 0) {
            throw new Error('No legacy object stores available for import.');
        }
        await db.transaction('rw', ...legacyTables, async () => {
            // Clear legacy tables only
            for (const table of legacyTables) {
                await table.clear();
            }
            // Import
            for (let [name, rows] of Object.entries(tableData)) {
                if (!LEGACY_TABLE_NAMES.includes(name)) continue;
                if (!Array.isArray(rows) || rows.length === 0) continue;

                if (name === 'goals') {
                    rows = rows.map(row => {
                        const newRow = { ...row };
                        delete newRow.deadline;
                        if (newRow.type === undefined) newRow.type = 'time';
                        if (newRow.target === undefined) newRow.target = newRow.targetHours || 0;
                        return newRow;
                    });
                }

                if (objectStoreExists(name)) {
                    await db.table(name).bulkAdd(rows);
                }
            }
        });

        // Restore settings
        if (settings?.pomodoroSettings) localStorage.setItem('pomodoroSettings', settings.pomodoroSettings);
        if (settings?.theme) localStorage.setItem('theme', settings.theme);
        if (settings?.activeTimer) localStorage.setItem('activeTimer', settings.activeTimer);
        if (settings?.notifications) {
            Object.entries(settings.notifications).forEach(([key, value]) => localStorage.setItem(key, value));
        }
    };

    const executeImportLegacy = async (payload, inputEvent) => {
        try {
            await performLegacyImport(payload);
            // Ensure UI stays on legacy tables
            window.localStorage.setItem('cloudIdsMigrated', '0');
            toast.success('Legacy data imported. Reloading...');
            setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            console.error('Legacy import failed:', error);
            toast.error(`Legacy import failed: ${error.message}`);
        } finally {
            if (inputEvent) inputEvent.target.value = null;
        }
    };

    const executeImportLegacyAndMigrate = async (payload, inputEvent) => {
        try {
            setIsBusy(true);
            await performLegacyImport(payload);
            // Migrate to cloud IDs for seamless operation
            await migrateToCloudIds();
            // migrateToCloudIds triggers reload; nothing more to do here
        } catch (error) {
            console.error('Import + migrate failed:', error);
            toast.error(`Import + migrate failed: ${error.message}`);
        } finally {
            setIsBusy(false);
            if (inputEvent) inputEvent.target.value = null;
        }
    };

    const clearDatabase = async () => {
        const confirmed = window.confirm(
            "⚠️ WARNING: This will permanently delete ALL your data including tasks, projects, goals, habits, notes, and time entries. This action cannot be undone!\n\nAre you absolutely sure you want to clear the entire database?"
        );
        
        if (!confirmed) return;

        // Double confirmation for safety
        const doubleConfirmed = window.confirm(
            "🚨 FINAL WARNING: You are about to delete EVERYTHING. This includes:\n\n• All tasks and projects\n• All habits and streaks\n• All goals and time tracking\n• All notes and calendar events\n• All folders and settings\n\nType 'DELETE' in the next prompt to confirm."
        );

        if (!doubleConfirmed) return;

        const deleteConfirmation = window.prompt(
            "Type 'DELETE' (in capital letters) to confirm database deletion:"
        );

        if (deleteConfirmation !== 'DELETE') {
            toast.error("Database clear cancelled - confirmation text did not match.");
            return;
        }

        try {
            await db.transaction('rw', ...db.tables, async () => {
                for (const table of db.tables) {
                    await table.clear();
                }
            });

            // Clear localStorage settings as well
            localStorage.removeItem('pomodoroSettings');
            localStorage.removeItem('theme');
            localStorage.removeItem('activeTimer');
            
            // Clear notification settings
            const notificationKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('notification_') || key.includes('Notification')
            );
            notificationKeys.forEach(key => localStorage.removeItem(key));
            
            toast.success("Database cleared successfully! Refreshing page...");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error("Clear database failed:", error);
            toast.error(`Failed to clear database: ${error.message}`);
        }
    };

    const DataButton = ({ onClick, children, className = '' }) => (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors ${className}`}
        >
            {children}
        </button>
    );

    // One-time migration to cloud-ready tables with string IDs
    const migrateToCloudIds = async () => {
        try {
            setIsBusy(true);
            await ensureDbOpen();

            // Build old->new ID maps per table
            const projectIdMap = new Map();
            const folderIdMap = new Map();
            const taskIdMap = new Map();
            const goalIdMap = new Map();
            const eventIdMap = new Map();
            const habitIdMap = new Map();
            
            // Helpers: reference tables only if they physically exist, to avoid NotFoundError
            const hasStore = (name) => objectStoreExists(name);
            const getTableSafe = (name) => (hasStore(name) ? db.table(name) : null);

            // Always reference physical tables explicitly to avoid alias issues
            const srcProjects = getTableSafe('projects');
            const srcFolders = getTableSafe('folders');
            const srcTasks = getTableSafe('tasks');
            const srcGoals = getTableSafe('goals');
            const srcEvents = getTableSafe('events');
            const srcTimeEntries = getTableSafe('timeEntries');
            const srcHabits = getTableSafe('habits');
            const srcHabitCompletions = getTableSafe('habit_completions');

            const destProjects = getTableSafe('projects_cloud');
            const destFolders = getTableSafe('folders_cloud');
            const destTasks = getTableSafe('tasks_cloud');
            const destGoals = getTableSafe('goals_cloud');
            const destEvents = getTableSafe('events_cloud');
            const destTimeEntries = getTableSafe('timeEntries_cloud');
            const destHabits = getTableSafe('habits_cloud');
            const destHabitCompletions = getTableSafe('habit_completions_cloud');
            const srcNotes = getTableSafe('notes');
            const destNotes = getTableSafe('notes_cloud');

            // 1) Projects
            if (srcProjects && destProjects) {
                const items = await srcProjects.toArray();
                await db.transaction('rw', destProjects, async () => {
                    for (const p of items) {
                        const newId = await destProjects.add({ name: p.name, createdAt: p.createdAt, color: p.color ?? null, legacyId: p.id });
                        projectIdMap.set(p.id, newId);
                    }
                });
            }

            // 2) Goals (needs projectId)
            if (srcGoals && destGoals) {
                const items = await srcGoals.toArray();
                await db.transaction('rw', destGoals, async () => {
                    for (const g of items) {
                        const newProjectId = g.projectId != null ? projectIdMap.get(g.projectId) ?? null : null;
                        const newId = await destGoals.add({
                            description: g.description,
                            type: g.type,
                            target: g.target,
                            actual: g.actual,
                            targetHours: g.targetHours,
                            actualHours: g.actualHours,
                            progress: g.progress,
                            createdAt: g.createdAt,
                            projectId: newProjectId,
                            legacyId: g.id,
                        });
                        goalIdMap.set(g.id, newId);
                    }
                });
            }

            // 3) Folders (needs projectId and parentId)
            if (srcFolders && destFolders) {
                const items = await srcFolders.toArray();
                await db.transaction('rw', destFolders, async () => {
                    for (const f of items) {
                        const newProjectId = f.projectId != null ? projectIdMap.get(f.projectId) ?? null : null;
                        // parent id remap will be done after all folders are inserted via an update loop
                        const newId = await destFolders.add({
                            name: f.name,
                            projectId: newProjectId,
                            parentId: null,
                            createdAt: f.createdAt,
                            color: f.color,
                            legacyId: f.id,
                        });
                        folderIdMap.set(f.id, newId);
                    }
                    // Patch folder parentId now that all new IDs exist
                    for (const f of items) {
                        const newId = folderIdMap.get(f.id);
                        await destFolders.update(newId, { parentId: f.parentId != null ? folderIdMap.get(f.parentId) ?? null : null });
                    }
                });
            }

            // 4) Tasks (needs projectId, goalId, parentId, folderId)
            if (srcTasks && destTasks) {
                const items = await srcTasks.toArray();
                await db.transaction('rw', destTasks, async () => {
                    for (const t of items) {
                        const newProjectId = t.projectId != null ? projectIdMap.get(t.projectId) ?? null : null;
                        const newGoalId = t.goalId != null ? goalIdMap.get(t.goalId) ?? null : null;
                        const newFolderId = t.folderId != null ? folderIdMap.get(t.folderId) ?? null : null;
                        const newId = await destTasks.add({
                            text: t.text,
                            projectId: newProjectId,
                            completed: t.completed,
                            createdAt: t.createdAt,
                            goalId: newGoalId,
                            parentId: null, // temporarily null, patch after all tasks inserted
                            folderId: newFolderId,
                            order: t.order,
                            dueDate: t.dueDate ?? null,
                            priority: t.priority ?? 0,
                            subtasks: t.subtasks ?? [],
                            rrule: t.rrule ?? null,
                            templateId: t.templateId ?? null,
                            legacyId: t.id,
                        });
                        taskIdMap.set(t.id, newId);
                    }
                    // Patch task parentId now that all task IDs exist
                    for (const t of items) {
                        if (t.parentId != null) {
                            await destTasks.update(taskIdMap.get(t.id), { parentId: taskIdMap.get(t.parentId) ?? null });
                        }
                    }
                });
            }

            // 5) Events (needs projectId, parentId)
            if (srcEvents && destEvents) {
                const items = await srcEvents.toArray();
                await db.transaction('rw', destEvents, async () => {
                    for (const e of items) {
                        const newProjectId = e.projectId != null ? projectIdMap.get(e.projectId) ?? null : null;
                        const newId = await destEvents.add({
                            title: e.title,
                            startTime: e.startTime,
                            endTime: e.endTime,
                            rrule: e.rrule ?? null,
                            parentId: null, // optionally map if hierarchical
                            lastInstance: e.lastInstance ?? null,
                            projectId: newProjectId,
                            templateId: e.templateId ?? null,
                            legacyId: e.id,
                        });
                        eventIdMap.set(e.id, newId);
                    }
                });
            }

            // 6) Time Entries (needs projectId, goalId, taskId, eventId)
            if (srcTimeEntries && destTimeEntries) {
                const items = await srcTimeEntries.toArray();
                await db.transaction('rw', destTimeEntries, async () => {
                    for (const te of items) {
                        const newProjectId = te.projectId != null ? projectIdMap.get(te.projectId) ?? null : null;
                        const newGoalId = te.goalId != null ? goalIdMap.get(te.goalId) ?? null : null;
                        const newTaskId = te.taskId != null ? taskIdMap.get(te.taskId) ?? null : null;
                        const newEventId = te.eventId != null ? eventIdMap.get(te.eventId) ?? null : null;
                        await destTimeEntries.add({
                            description: te.description,
                            startTime: te.startTime,
                            endTime: te.endTime,
                            duration: te.duration ?? (te.startTime && te.endTime ? Math.floor((new Date(te.endTime) - new Date(te.startTime)) / 1000) : null),
                            goalId: newGoalId,
                            projectId: newProjectId,
                            taskId: newTaskId,
                            eventId: newEventId,
                            legacyId: te.id,
                        });
                    }
                });
            }

            // 7) Habits (needs projectId and maybe taskId)
            if (srcHabits && destHabits) {
                const items = await srcHabits.toArray();
                await db.transaction('rw', destHabits, async () => {
                    for (const h of items) {
                        const newProjectId = h.projectId != null ? projectIdMap.get(h.projectId) ?? null : null;
                        const newTaskId = h.taskId != null ? taskIdMap.get(h.taskId) ?? null : null;
                        const newId = await destHabits.add({
                            taskId: newTaskId,
                            name: h.name,
                            startDate: h.startDate,
                            streak: h.streak,
                            bestStreak: h.bestStreak,
                            lastCompletionDate: h.lastCompletionDate,
                            streakFriezes: h.streakFriezes, // preserved legacy field if present
                            streakFreezes: h.streakFreezes ?? null,
                            lastStreakMilestone: h.lastStreakMilestone ?? null,
                            projectId: newProjectId,
                            legacyId: h.id,
                        });
                        habitIdMap.set(h.id, newId);
                    }
                });
            }

            // 8) Habit Completions (needs habitId)
            if (srcHabitCompletions && destHabitCompletions) {
                const items = await srcHabitCompletions.toArray();
                await db.transaction('rw', destHabitCompletions, async () => {
                    for (const hc of items) {
                        const newHabitId = hc.habitId != null ? habitIdMap.get(hc.habitId) ?? null : null;
                        await destHabitCompletions.add({
                            habitId: newHabitId,
                            date: hc.date,
                            legacyId: hc.id,
                        });
                    }
                });
            }

            // 9) Notes (if present)
            if (srcNotes && destNotes) {
                const items = await srcNotes.toArray();
                await db.transaction('rw', destNotes, async () => {
                    for (const n of items) {
                        await destNotes.add({
                            title: n.title,
                            content: n.content,
                            createdAt: n.createdAt ?? new Date(),
                            modifiedAt: n.modifiedAt ?? n.createdAt ?? new Date(),
                            legacyId: n.id,
                        });
                    }
                });
            }

            // Only switch to cloud-backed tables if all cloud stores exist
            const canAliasToCloud = CLOUD_TABLE_NAMES.every(hasStore);
            if (canAliasToCloud) {
                window.localStorage.setItem('cloudIdsMigrated', '1');
                toast.success('Migration complete. Reloading...');
            } else {
                toast.success('Legacy data imported. Cloud tables unavailable; staying on local tables. Reloading...');
            }
            setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            console.error('Migration failed', error);
            toast.error(`Migration failed: ${error.message}`);
        } finally {
            setIsBusy(false);
        }
    };

    const cloudConfigured = Boolean(process.env.REACT_APP_DEXIE_CLOUD_URL);

    // Cloud status
    const [cloudUser, setCloudUser] = useState(null);
    const [syncState, setSyncState] = useState(null);
    const [isBusy, setIsBusy] = useState(false);

    useEffect(() => {
        if (!cloudConfigured) return;
        const sub1 = db.cloud.userInteraction.subscribe(() => {}); // ensure observable initialized
        const sub2 = db.cloud.syncState.subscribe(state => setSyncState(state));
        const sub3 = db.cloud.currentUser.subscribe(user => setCloudUser(user));
        return () => {
            sub1?.unsubscribe?.();
            sub2?.unsubscribe?.();
            sub3?.unsubscribe?.();
        };
    }, [cloudConfigured]);

    const login = async () => {
        try {
            setIsBusy(true);
            await db.cloud.login();
            toast.success('Logged in');
        } catch (e) {
            console.error(e);
            toast.error('Login failed');
        } finally {
            setIsBusy(false);
        }
    };

    const logout = async () => {
        try {
            setIsBusy(true);
            await db.cloud.logout();
            toast.success('Logged out');
        } catch (e) {
            console.error(e);
            toast.error('Logout failed');
        } finally {
            setIsBusy(false);
        }
    };

    const syncNow = async () => {
        try {
            setIsBusy(true);
            await db.cloud.sync();
            toast.success('Sync complete');
        } catch (e) {
            console.error(e);
            toast.error('Sync failed');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-card-foreground">Tools</h2>
            <div className="grid grid-cols-1 gap-2">
                {cloudConfigured && (
                    <>
                        <div className="flex items-center justify-between p-2 rounded bg-muted text-muted-foreground">
                            <div className="text-sm">
                                <div className="font-medium">Cloud Status</div>
                                <div>{cloudUser ? `Signed in as ${cloudUser?.profile?.name || cloudUser?.email || 'user'}` : 'Signed out'}</div>
                                <div className="text-xs">{syncState?.status || 'idle'}{syncState?.error ? ` • error: ${syncState.error}` : ''}</div>
                            </div>
                            {isBusy && <span className="animate-spin inline-block rounded-full border-2 border-current border-r-transparent h-5 w-5" />}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <DataButton onClick={login} className="bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-60" disabled={isBusy || !!cloudUser}>
                                Login
                            </DataButton>
                            <DataButton onClick={syncNow} className="bg-secondary hover:bg-border text-secondary-foreground disabled:opacity-60" disabled={isBusy}>
                                Sync Now
                            </DataButton>
                            <DataButton onClick={logout} className="bg-secondary hover:bg-border text-secondary-foreground disabled:opacity-60" disabled={isBusy || !cloudUser}>
                                Logout
                            </DataButton>
                        </div>
                        <div className="mt-2">
                            <DataButton onClick={migrateToCloudIds} className="bg-accent hover:opacity-90 text-accent-foreground disabled:opacity-60" disabled={isBusy}>
                                Migrate to Cloud IDs (one-time)
                            </DataButton>
                        </div>
                    </>
                )}
                <DataButton onClick={exportData} className="bg-secondary hover:bg-border text-secondary-foreground">
                    <Download size={16} /> Export Backup
                </DataButton>
                <DataButton onClick={triggerImport} className="bg-secondary hover:bg-border text-secondary-foreground">
                    <Upload size={16} /> Import Backup
                </DataButton>
                <DataButton onClick={triggerLegacyImport} className="bg-secondary hover:bg-border text-secondary-foreground">
                    <Upload size={16} /> Import Legacy Backup (local-only)
                </DataButton>
                <DataButton onClick={onShowReview} className="bg-primary hover:opacity-90 text-primary-foreground mt-2">
                    <Star size={16} /> Weekly Review
                </DataButton>
                <DataButton onClick={clearDatabase} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground mt-2">
                    <Trash2 size={16} /> Clear Database
                </DataButton>
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={importData} 
                accept=".json" 
                style={{ display: 'none' }}
            />
            <input
                type="file"
                ref={legacyFileInputRef}
                onChange={importLegacyData}
                accept=".json"
                style={{ display: 'none' }}
            />
        </div>
    );
}; 