import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TimeEntryItem } from './TimeEntryItem';
import { useState } from 'react';

export const TimeEntryList = ({ onStartTimer, activeTimer }) => {
    const [filter, setFilter] = useState('week'); // 'today', 'week', 'month', 'all', 'custom'
    const [customRange, setCustomRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    const DEFAULT_ALL_LIMIT = 300;
    const [allLimit, setAllLimit] = useState(DEFAULT_ALL_LIMIT);

    const projects = useLiveQuery(() => db.projects.toArray(), []);

    const entries = useLiveQuery(async () => {
        // Use a consistent, type-safe approach that works even if some backups stored dates as strings
        const getTime = (value) => {
            const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
            return Number.isFinite(t) ? t : 0;
        };

        const now = new Date();
        let startMs = null;
        let endMs = null;

        switch (filter) {
            case 'today': {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                startMs = start.getTime();
                endMs = end.getTime();
                break;
            }
            case 'week': {
                const start = new Date(now);
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                startMs = start.getTime();
                endMs = end.getTime();
                break;
            }
            case 'month': {
                const start = new Date(now);
                start.setMonth(start.getMonth() - 1);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                startMs = start.getTime();
                endMs = end.getTime();
                break;
            }
            case 'custom': {
                const start = new Date(customRange.start);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customRange.end);
                end.setHours(23, 59, 59, 999);
                startMs = start.getTime();
                endMs = end.getTime();
                break;
            }
            case 'all':
            default: {
                // For performance, only load the most recent N entries for "All Time"
                try {
                    return await db.timeEntries
                        .orderBy('startTime')
                        .reverse()
                        .limit(allLimit)
                        .toArray();
                } catch {
                    // Fallback: load all then slice client-side (kept for mixed data compatibility)
                    const all = await db.timeEntries.toArray();
                    return all
                        .slice()
                        .sort((a, b) => getTime(b.startTime) - getTime(a.startTime))
                        .slice(0, allLimit);
                }
            }
        }

        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];

        // Prefer indexed range query when possible; fall back to client-side filtering if needed
        try {
            const rangeResults = await db.timeEntries
                .where('startTime')
                .between(new Date(startMs), new Date(endMs), true, true)
                .toArray();
            return rangeResults
                .filter((e) => {
                    const t = getTime(e.startTime);
                    return t >= startMs && t <= endMs;
                })
                .sort((a, b) => getTime(b.startTime) - getTime(a.startTime));
        } catch {
            const all = await db.timeEntries.toArray();
            return all
                .filter((e) => {
                    const t = getTime(e.startTime);
                    return t >= startMs && t <= endMs;
                })
                .sort((a, b) => getTime(b.startTime) - getTime(a.startTime));
        }
    }, [filter, customRange, allLimit]);

    /* ------------------------------------------------------------------ */
    /* Build a map of project id -> project to avoid repeated look-ups    */
    /* ------------------------------------------------------------------ */
    const projectMap =
        projects?.reduce((map, proj) => {
            // eslint-disable-next-line no-param-reassign
            map[String(proj.id)] = proj;
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
                <div className="text-center py-8">
                    {filter === 'today' ? 
                        "No time entries today. Start the timer to log your work!" :
                        "No time entries in this period."
                    }
                </div>
            ) : (
                <>
                    {Object.keys(groupedEntries).map((date) => (
                        <div key={date}>
                            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2 pb-2 border-b border-gray-600 dark:border-gray-400">
                                {date}
                            </h2>
                            <div className="space-y-2">
                                {groupedEntries[date].map((entry) => (
                                    <TimeEntryItem 
                                        key={entry.id} 
                                        entry={entry} 
                                        project={projectMap[String(entry.projectId)]} 
                                        projects={projects}
                                        onStartTimer={onStartTimer}
                                        activeTimer={activeTimer}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {filter === 'all' && entries.length >= allLimit && (
                        <div className="text-center pt-2">
                            <button
                                onClick={() => setAllLimit((l) => l + DEFAULT_ALL_LIMIT)}
                                className="px-3 py-1 text-sm rounded-md bg-background hover:bg-border"
                            >
                                Load more
                            </button>
                        </div>
                    )}
                </>
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
