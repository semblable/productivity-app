import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/**
 * Compact presentation of the user's goals with progress bars.
 * Designed for use inside the dashboard sidebar.
 */
const GoalsSummary = () => {
    const goals = useLiveQuery(() => db.timeGoals.toArray(), []);
    const projects = useLiveQuery(() => db.projects.toArray(), []);

    if (!goals) {
        return <div className="text-center text-muted-foreground">Loading goals...</div>;
    }

    if (goals.length === 0) {
        return (
            <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                <h2 className="text-lg font-bold mb-2 text-card-foreground">Goals</h2>
                <p className="text-sm text-muted-foreground">No goals set yet.</p>
            </div>
        );
    }

    // Map projects for quick lookup of colors / names
    const projectMap = projects?.reduce((acc, proj) => {
        acc[proj.id] = proj;
        return acc;
    }, {}) || {};

    return (
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-card-foreground">Goals</h2>
            <ul className="space-y-3">
                {goals.map(goal => {
                    const progress = goal.progress !== undefined
                        ? goal.progress
                        : goal.targetHours
                            ? Math.min(100, Math.round((goal.actualHours / goal.targetHours) * 100))
                            : 0;
                    const barColor = projectMap[goal.projectId]?.color || '#0ea5e9';

                    return (
                        <li key={goal.id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-card-foreground truncate mr-2" title={goal.description}>{goal.description}</span>
                                <span className="text-muted-foreground whitespace-nowrap">{progress}%</span>
                            </div>
                            <div className="w-full bg-background rounded-full h-2">
                                <div
                                    className="h-2 rounded-full"
                                    style={{ width: `${progress}%`, backgroundColor: barColor }}
                                ></div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default GoalsSummary; 