import { db } from './db';

/**
 * Finds all goals linked to a specific project and adds the given duration
 * to their actualHours, updating their progress.
 * @param {number} projectId The ID of the project.
 * @param {number} durationInSeconds The duration to add, in seconds.
 * @param {number|null} goalToExclude Optional goal ID to exclude from updates (prevents double-counting).
 */
export const logTimeToProjectGoals = async (projectId, durationInSeconds, goalToExclude = null) => {
    if (!projectId || durationInSeconds <= 0) return;

    // console.log(`[TimeUtil] Checking for goals linked to projectId: ${projectId}, excluding goal: ${goalToExclude}`);

    try {
        let linkedGoals = await db.goals.where({ projectId: Number(projectId) }).toArray();

        if (goalToExclude) {
            // Ensure type consistency for comparison (both should be numbers)
            linkedGoals = linkedGoals.filter(g => g.id !== Number(goalToExclude));
        }

        if (linkedGoals.length > 0) {
            // console.log(`[TimeUtil] Found ${linkedGoals.length} linked goals to update.`);
            const hoursToAdd = durationInSeconds / 3600;

            for (const goal of linkedGoals) {
                const newActualHours = (goal.actualHours || 0) + hoursToAdd;
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