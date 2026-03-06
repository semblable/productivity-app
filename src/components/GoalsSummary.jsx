import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useGoals } from '../db/goals-repository';
import { calculateDailyPlan, formatHours } from '../utils/goalSchedule';

/**
 * Compact presentation of the user's goals with progress bars.
 * Each goal's actual hours is computed live from time entries tagged to that
 * specific goal (entry.goalId === goal.id), so multiple goals within the same
 * project track independently and always stay in sync with the time tracker.
 */
const GoalsSummary = () => {
    const goals       = useGoals();
    const projects    = useLiveQuery(() => db.projects.toArray(), []);
    const timeEntries = useLiveQuery(() => db.timeEntries.toArray(), []);

    // goalId → total tracked seconds
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

    // Enrich each goal with its real tracked hours from time entries
    const enrichedGoals = useMemo(() => {
        if (!goals) return [];
        return goals.map(goal => {
            const totalSeconds = goalTimeMap[String(goal.id)] || 0;
            const actualHours  = totalSeconds / 3600;
            const progress     = goal.targetHours > 0
                ? Math.min(100, Math.round((actualHours / goal.targetHours) * 100))
                : 0;
            return { ...goal, actualHours, progress };
        });
    }, [goals, goalTimeMap]);

    if (!goals || !timeEntries) {
        return <div className="text-center text-muted-foreground">Loading goals...</div>;
    }

    if (enrichedGoals.length === 0) {
        return (
            <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                <h2 className="text-lg font-bold mb-2 text-card-foreground">Goals</h2>
                <p className="text-sm text-muted-foreground">No goals set yet.</p>
            </div>
        );
    }

    const projectMap = projects?.reduce((acc, proj) => {
        acc[String(proj.id)] = proj;
        return acc;
    }, {}) || {};

    return (
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-card-foreground">Goals</h2>
            <ul className="space-y-3">
                {enrichedGoals.map(goal => {
                    const barColor = projectMap[String(goal.projectId)]?.color || '#0ea5e9';
                    const plan     = calculateDailyPlan(goal);

                    return (
                        <li key={goal.id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-card-foreground truncate mr-2" title={goal.description}>
                                    {goal.description}
                                </span>
                                <span className="text-muted-foreground whitespace-nowrap">{goal.progress}%</span>
                            </div>
                            <div className="w-full bg-background rounded-full h-2">
                                <div
                                    className="h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${goal.progress}%`, backgroundColor: barColor }}
                                />
                            </div>
                            {plan && plan.dailyHoursRequired !== null && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {!plan.isOnTrack && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Behind pace" />
                                    )}
                                    <span>
                                        <span className="font-medium" style={{ color: barColor }}>
                                            {formatHours(plan.dailyHoursRequired)}/day
                                        </span>
                                        {' '}&middot; {plan.remainingAvailableDays} day{plan.remainingAvailableDays !== 1 ? 's' : ''} left
                                        {!plan.isOnTrack && plan.hoursAheadOrBehind < 0 && (
                                            <> &middot; {formatHours(Math.abs(plan.hoursAheadOrBehind))} behind</>
                                        )}
                                    </span>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default GoalsSummary;
