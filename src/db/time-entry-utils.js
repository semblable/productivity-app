import { db } from './db';
import { normalizeId, idsEqual } from './id-utils';

/**
 * Recomputes a goal's actualHours by summing real time entries from the DB,
 * then persists the corrected value. Use this to fix drift between the
 * incremental counter and the actual logged data.
 *
 * Rules (mirror the incremental logic):
 *  - If the goal is linked to a project: sum ALL entries for that project.
 *  - Otherwise: sum only entries where entry.goalId === goal.id.
 *
 * @param {number|string} goalId
 */
export const recalculateGoalHours = async (goalId) => {
    if (!goalId) return;
    try {
        const goal = await db.goals.get(goalId);
        if (!goal) return;

        let entries;
        if (goal.projectId) {
            entries = await db.timeEntries
                .where('projectId')
                .equals(normalizeId(goal.projectId))
                .toArray();
        } else {
            entries = await db.timeEntries
                .where('goalId')
                .equals(normalizeId(goalId))
                .toArray();
        }

        const totalSeconds = entries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
        const newActualHours = totalSeconds / 3600;
        const progress = goal.targetHours > 0
            ? Math.min(100, Math.round((newActualHours / goal.targetHours) * 100))
            : 0;

        await db.goals.update(goalId, { actualHours: newActualHours, progress });
    } catch (error) {
        console.error('Failed to recalculate goal hours:', error);
        throw error;
    }
};

/**
 * Finds all goals linked to a specific project and applies a duration delta
 * to their actualHours, updating their progress. Positive values increase,
 * negative values decrease progress while never dropping below zero.
 * @param {number|string} projectId The ID of the project.
 * @param {number} durationInSeconds Duration delta in seconds (can be negative).
 * @param {number|string|null} goalToExclude Optional goal ID to exclude from updates (prevents double-counting).
 */
export const logTimeToProjectGoals = async (projectId, durationInSeconds, goalToExclude = null) => {
    if (!projectId || !Number.isFinite(durationInSeconds) || durationInSeconds === 0) return;

    // console.log(`[TimeUtil] Checking for goals linked to projectId: ${projectId}, excluding goal: ${goalToExclude}`);

    try {
        let linkedGoals = await db.goals.where({ projectId: normalizeId(projectId) }).toArray();

        if (goalToExclude) {
            // Ensure type consistency for comparison
            linkedGoals = linkedGoals.filter(g => !idsEqual(g.id, goalToExclude));
        }

        if (linkedGoals.length > 0) {
            // console.log(`[TimeUtil] Found ${linkedGoals.length} linked goals to update.`);
            const hoursToAdd = durationInSeconds / 3600;

            for (const goal of linkedGoals) {
                const newActualHours = Math.max(0, (goal.actualHours || 0) + hoursToAdd);
                const progress = goal.targetHours > 0 
                    ? Math.min(100, Math.round((newActualHours / goal.targetHours) * 100)) 
                    : 0;
                
                await db.goals.update(goal.id, {
                    actualHours: newActualHours,
                    progress: progress,
                });
                // console.log(`[TimeUtil] Updated goal "${goal.description}" with ${hoursToAdd.toFixed(2)} hours.`);
            }
        } else {
            // console.log(`[TimeUtil] No goals linked to project ${projectId} to update.`);
        }
    } catch (error) {
        console.error("Failed to log time to project goals:", error);
        // Silently fail for now, or add a toast if this is critical user feedback
    }
}; 

/**
 * Increment (or decrement) a specific time-based goal by a duration (in seconds).
 * Calculates new progress as a percentage of targetHours and persists to DB.
 * Central function used by TimeTracker and admin tools to avoid duplicate logic.
 *
 * @param {number|string} goalId
 * @param {number} durationInSeconds
 */
export const logTimeToGoal = async (goalId, durationInSeconds) => {
    if (!goalId || !Number.isFinite(durationInSeconds) || durationInSeconds === 0) return;
    try {
        const goal = await db.goals.get(goalId);
        if (!goal) return;
        const hoursToAdd = durationInSeconds / 3600;
        const newActualHours = Math.max(0, (goal.actualHours || 0) + hoursToAdd);
        const progress = goal.targetHours > 0
            ? Math.min(100, Math.round((newActualHours / goal.targetHours) * 100))
            : 0;
        await db.goals.update(goalId, { actualHours: newActualHours, progress });
        // Notify on completion
        try {
            const hasPermission = typeof Notification !== 'undefined' && Notification.permission === 'granted';
            if (hasPermission && progress >= 100 && (goal.progress || 0) < 100) {
                new Notification('Goal Completed', {
                    body: `"${goal.description}" reached ${newActualHours.toFixed(1)} / ${goal.targetHours} hours`,
                    icon: '/favicon.ico',
                });
            }
        } catch {
            // ignore notification errors
        }
    } catch (error) {
        console.error('Failed to update goal with logged time:', error);
    }
};