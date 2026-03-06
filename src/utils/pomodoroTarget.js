import { normalizeId } from '../db/id-utils';

export const getByLooseId = async (table, rawId) => {
  if (rawId == null || rawId === '') return null;

  const normalizedId = normalizeId(rawId);
  if (normalizedId != null) {
    const exactMatch = await table.get(normalizedId);
    if (exactMatch) return exactMatch;
  }

  return table
    .toCollection()
    .filter((item) => String(item.id) === String(rawId) || String(item.legacyId || '') === String(rawId))
    .first();
};

export const resolvePomodoroTarget = async (db, selectedTarget) => {
  const resolved = {
    description: 'Pomodoro',
    projectId: null,
    goalId: null,
    taskId: null,
  };

  if (!selectedTarget || selectedTarget === 'none') {
    return resolved;
  }

  const [kind, idStr] = String(selectedTarget).split(':');
  if (!idStr) {
    return resolved;
  }

  if (kind === 'goal') {
    const goal = await getByLooseId(db.goals, idStr);
    if (goal) {
      resolved.description = `Pomodoro - ${goal.description}`;
      resolved.goalId = goal.id;
      resolved.projectId = goal.projectId || null;
    }
    return resolved;
  }

  if (kind === 'project') {
    const project = await getByLooseId(db.projects, idStr);
    if (project) {
      resolved.description = `Pomodoro - ${project.name}`;
      resolved.projectId = project.id;
    }
    return resolved;
  }

  if (kind === 'task') {
    const task = await getByLooseId(db.tasks, idStr);
    if (!task) {
      return resolved;
    }

    resolved.description = `Pomodoro - ${task.text}`;
    resolved.taskId = task.id;
    resolved.projectId = task.projectId || null;

    if (task.goalId) {
      resolved.goalId = task.goalId;
      if (!resolved.projectId) {
        const taskGoal = await getByLooseId(db.goals, task.goalId);
        if (taskGoal?.projectId) {
          resolved.projectId = taskGoal.projectId;
        }
      }
    }
  }

  return resolved;
};
