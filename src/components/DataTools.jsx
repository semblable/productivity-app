import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Upload, Download, Star, Trash2 } from 'lucide-react';
import { api } from '../api/apiClient';

const DATA_TABLE_NAMES = [
    'projects',
    'folders',
    'tasks',
    'goals',
    'timeEntries',
    'events',
    'notes',
    'habits',
    'habit_completions',
    'ivyLee',
];

const DataButton = ({ onClick, children, className = '' }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors ${className}`}
    >
        {children}
    </button>
);

function getSettingsBackup() {
    const settings = {};
    const pomodoroSettings = localStorage.getItem('pomodoroSettings');
    const theme = localStorage.getItem('theme');
    const activeTimer = localStorage.getItem('activeTimer');

    if (pomodoroSettings) settings.pomodoroSettings = pomodoroSettings;
    if (theme) settings.theme = theme;
    if (activeTimer) settings.activeTimer = activeTimer;

    const notificationKeys = Object.keys(localStorage).filter(
        (key) => key.startsWith('notification_') || key.includes('Notification')
    );
    if (notificationKeys.length > 0) {
        settings.notifications = {};
        notificationKeys.forEach((key) => {
            settings.notifications[key] = localStorage.getItem(key);
        });
    }

    return settings;
}

function restoreSettings(settings = {}) {
    if (settings.pomodoroSettings) localStorage.setItem('pomodoroSettings', settings.pomodoroSettings);
    if (settings.theme) localStorage.setItem('theme', settings.theme);
    if (settings.activeTimer) localStorage.setItem('activeTimer', settings.activeTimer);
    if (settings.notifications) {
        Object.entries(settings.notifications).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    }
}

export const DataTools = ({ onShowReview }) => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);

    const exportData = async () => {
        try {
            const data = await api.exportData();
            const payload = {
                exportedAt: data.exportedAt || new Date().toISOString(),
                tables: data.tables || {},
                settings: getSettingsBackup(),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Data exported successfully!');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Export failed!');
        }
    };

    const triggerImport = () => {
        fileInputRef.current?.click();
    };

    const importData = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const rawData = JSON.parse(text);
            const tableData = rawData.tables || rawData.tableData || rawData;
            const settings = rawData.settings || {};
            const filteredTables = Object.fromEntries(
                Object.entries(tableData).filter(([name]) => DATA_TABLE_NAMES.includes(name))
            );

            if (!window.confirm('Importing will overwrite all current SQLite data. Continue?')) {
                event.target.value = null;
                return;
            }

            await api.migrateData(filteredTables);
            restoreSettings(settings);
            await queryClient.invalidateQueries();
            toast.success('Data imported successfully! Refreshing...');
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error('Import failed:', error);
            toast.error(`Import failed: ${error.message}`);
        } finally {
            event.target.value = null;
        }
    };

    const clearDatabase = async () => {
        const confirmed = window.confirm(
            "This will permanently delete all SQLite data. This action cannot be undone."
        );
        if (!confirmed) return;

        const deleteConfirmation = window.prompt(
            "Type 'DELETE' (in capital letters) to confirm database deletion:"
        );
        if (deleteConfirmation !== 'DELETE') {
            toast.error('Database clear cancelled - confirmation text did not match.');
            return;
        }

        try {
            await api.clearData();
            localStorage.removeItem('pomodoroSettings');
            localStorage.removeItem('theme');
            localStorage.removeItem('activeTimer');
            Object.keys(localStorage)
                .filter((key) => key.startsWith('notification_') || key.includes('Notification'))
                .forEach((key) => localStorage.removeItem(key));
            await queryClient.invalidateQueries();
            toast.success('Database cleared successfully! Refreshing page...');
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error('Clear database failed:', error);
            toast.error(`Failed to clear database: ${error.message}`);
        }
    };

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