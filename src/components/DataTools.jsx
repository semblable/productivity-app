import { db } from '../db/db';
import { useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, Download, Star, Trash2 } from 'lucide-react';

export const DataTools = ({ onShowReview }) => {
    const fileInputRef = useRef(null);

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

                if (dbVersion > db.verno) {
                    throw new Error(`Backup from a newer database version (v${dbVersion}) cannot be imported into an older version (v${db.verno}). Please update the app.`);
                }
                
                const importPayload = { tableData, settings };
                console.debug("Prepared import payload:", importPayload);
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

    const executeImport = async (payload, inputEvent) => {
        try {
            const { tableData, settings } = payload;
            console.debug("Starting import for tables:", Object.keys(tableData));

            await db.transaction('rw', ...db.tables, async () => {
                // Clear all existing data
                for (const table of db.tables) {
                    await table.clear();
                }
                
                // Import data table by table
                for (let [name, rows] of Object.entries(tableData)) {
                    console.debug(`Importing ${Array.isArray(rows) ? rows.length : 0} rows into table "${name}"`);
                    if (db[name]) {
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
                             await db[name].bulkAdd(rows);
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

    return (
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-card-foreground">Tools</h2>
            <div className="grid grid-cols-1 gap-2">
                <DataButton onClick={exportData} className="bg-secondary hover:bg-border text-secondary-foreground">
                    <Download size={16} /> Export Backup
                </DataButton>
                <DataButton onClick={triggerImport} className="bg-secondary hover:bg-border text-secondary-foreground">
                    <Upload size={16} /> Import Backup
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
        </div>
    );
}; 