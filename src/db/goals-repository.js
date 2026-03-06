import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { normalizeNullableId } from './id-utils';

// Hooks
export const useGoals = () => useLiveQuery(() => db.goals.toArray(), []);

// Queries
export const listGoals = async () => db.goals.toArray();
export const getGoalById = async (goalId) => db.goals.get(goalId);
export const listGoalsByProjectId = async (projectId) => {
	return db.goals.where({ projectId: normalizeNullableId(projectId) }).toArray();
};

// Mutations
export const createGoal = async (goal) => {
	return db.goals.add({
		...goal,
		projectId: normalizeNullableId(goal.projectId),
	});
};

export const updateGoal = async (goalId, changes) => {
	const payload = { ...changes };
	if ('projectId' in payload) {
		payload.projectId = normalizeNullableId(payload.projectId);
	}
	return db.goals.update(goalId, payload);
};

export const deleteGoal = async (goalId) => db.goals.delete(goalId);

export const deleteGoalsByProjectId = async (projectId) => {
	const ids = await db.goals.where({ projectId: normalizeNullableId(projectId) }).primaryKeys();
	if (ids && ids.length > 0) {
		return db.goals.bulkDelete(ids);
	}
	return undefined;
};


