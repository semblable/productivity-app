import { api } from '../api/apiClient';
import { useGoals as useGoalsQuery } from '../hooks/useAppData';

export const useGoals = () => {
  const { data = [] } = useGoalsQuery();
  return data;
};

export const listGoals = async () => api.goals.list();
export const getGoalById = async (goalId) => api.goals.get(goalId);
export const listGoalsByProjectId = async (projectId) =>
  api.goals.list({ projectId: projectId ?? 'null' });

export const createGoal = async (goal) => api.goals.create(goal);

export const updateGoal = async (goalId, changes) => api.goals.update(goalId, changes);

export const deleteGoal = async (goalId) => api.goals.remove(goalId);

export const deleteGoalsByProjectId = async (projectId) => {
  const goals = await api.goals.list({ projectId: projectId ?? 'null' });
  const ids = goals.map((goal) => goal.id);
  if (ids.length > 0) {
    return api.goals.bulkRemove(ids);
  }
  return undefined;
};
