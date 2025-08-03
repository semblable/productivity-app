import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TimeEntryItem } from './TimeEntryItem';
import { useState } from 'react';

export const TimeEntryList = () => {
    const [filter, setFilter] = useState('today'); // 'today', 'week', 'month', 'all', 'custom'
    const [customRange, setCustomRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });

    const projects = useLiveQuery(() => db.projects.toArray(), []);

    const entries = useLiveQuery(() => {
        const query = db.timeEntries;
        const now = new Date();

        const inclusive = true; // for Dexie between inclusivity flags
        let startRange = null;
        let endRange = null;

        switch (filter) {
            case 'today': {
                startRange = new Date(now);
                startRange.setHours(0, 0, 0, 0);
                endRange = new Date(now);
                endRange.setHours(23, 59, 59, 999);
                break;
            }
            case 'week': {
                startRange = new Date(now);
                startRange.setDate(startRange.getDate() - 6); // include today + previous 6 days
                startRange.setHours(0, 0, 0, 0);
                endRange = new Date(now);
                endRange.setHours(23, 59, 59, 999);
                break;
            }
            case 'month': {
                startRange = new Date(now);
                startRange.setMonth(startRange.getMonth() - 1);
                startRange.setHours(0, 0, 0, 0);
                endRange = new Date(now);
                endRange.setHours(23, 59, 59, 999);
                break;
            }
            case 'custom': {
                startRange = new Date(customRange.start);
                startRange.setHours(0, 0, 0, 0);
                endRange = new Date(customRange.end);
                endRange.setHours(23, 59, 59, 999);
                break;
            }
            case 'all':
            default:
                return query.orderBy('startTime').reverse().toArray();
        }

        /* Guard: if startRange or endRange invalid, return empty array */
        if (!startRange || !endRange) {
            return [];
        }
        return query.where('startTime').between(startRange, endRange, inclusive, inclusive).reverse().toArray();
    }, [filter, customRange]);

    /* ------------------------------------------------------------------ */
    /* Build a map of project id -> project to avoid repeated look-ups    */
    /* ------------------------------------------------------------------ */
    const projectMap =
        projects?.reduce((map, proj) => {
            // eslint-disable-next-line no-param-reassign
            map[proj.id] = proj;
            return map;
        }, {}) || {};

    const groupedEntries = entries?.reduce((groups, entry) => {
        const date = new Date(entry.startTime).toLocaleDateString([], {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        if (!groups[date]) groups[date] = [];
        groups[date].push(entry);
        return groups;
    }, {});

    if (!entries || !projects) return <div className="text-gray-600 dark:text-gray-300">Loading...</div>;
    if (entries.length === 0)
        return (
            <div className="text-gray-600 dark:text-gray-300 mt-4 text-center">
                No time entries yet. Start the timer to log your work!
            </div>
        );

    return (
        <div className="space-y-6 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-2">
                    <FilterButton current={filter} value="today" setFilter={setFilter}>
                        Today
                    </FilterButton>
                    <FilterButton current={filter} value="week" setFilter={setFilter}>
                        Last 7 Days
                    </FilterButton>
                    <FilterButton current={filter} value="month" setFilter={setFilter}>
                        Last Month
                    </FilterButton>
                    <FilterButton current={filter} value="all" setFilter={setFilter}>
                        All Time
                    </FilterButton>
                </div>

                {filter === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={customRange.start}
                            onChange={(e) => setCustomRange((p) => ({ ...p, start: e.target.value }))}
                            className="p-2 rounded bg-background"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={customRange.end}
                            onChange={(e) => setCustomRange((p) => ({ ...p, end: e.target.value }))}
                            className="p-2 rounded bg-background"
                        />
                    </div>
                )}
                <button
                    onClick={() => setFilter('custom')}
                    className={`px-3 py-1 text-sm rounded-md ${
                        filter === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-border'
                    }`}
                >
                    Custom Range
                </button>
            </div>

            {entries.length === 0 ? (
                <div className="text-center py-8">No time entries in this period.</div>
            ) : (
                Object.keys(groupedEntries).map((date) => (
                    <div key={date}>
                        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2 pb-2 border-b border-gray-600 dark:border-gray-400">
                            {date}
                        </h2>
                        <div className="space-y-2">
                            {groupedEntries[date].map((entry) => (
                                <TimeEntryItem 
                                    key={entry.id} 
                                    entry={entry} 
                                    project={projectMap[entry.projectId]} 
                                    projects={projects}
                                />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

const FilterButton = ({ current, value, setFilter, children }) => (
    <button
        onClick={() => setFilter(value)}
        className={`px-3 py-1 text-sm rounded-md ${
            current === value ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-border'
        }`}
    >
        {children}
    </button>
);
