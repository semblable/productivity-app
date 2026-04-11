import { api } from '../api/apiClient';

const defaultResolvedTarget = () => ({
  description: 'Pomodoro',
  projectId: null,
  goalId: null,
  taskId: null,
});

const isTableLike = (value) => value && typeof value.get === 'function';

const createTableAccess = (dbOrApi = api) => {
  if (
    dbOrApi &&
    isTableLike(dbOrApi.goals) &&
    isTableLike(dbOrApi.projects) &&
    isTableLike(dbOrApi.tasks)
  ) {
    return dbOrApi;
  }

  return {
    goals: {
      get: (id) => dbOrApi.goals.get(id),
      toCollection: () => ({
        filter: (predicate) => ({
          first: async () => {
            const rows = await dbOrApi.goals.list();
            return rows.find(predicate) || null;
          },
        }),
      }),
    },
    projects: {
      get: (id) => dbOrApi.projects.get(id),
      toCollection: () => ({
        filter: (predicate) => ({
          first: async () => {
            const rows = await dbOrApi.projects.list();
            return rows.find(predicate) || null;
          },
        }),
      }),
    },
    tasks: {
      get: (id) => dbOrApi.tasks.get(id),
      toCollection: () => ({
        filter: (predicate) => ({
          first: async () => {
            const rows = await dbOrApi.tasks.list();
            return rows.find(predicate) || null;
          },
        }),
      }),
    },
  };
};

export const getByLooseId = async (table, rawId) => {
  if (!table || rawId == null || rawId === '') {
    return null;
  }

  const normalizedStringId = String(rawId);
  const numericId = Number(rawId);
  const directId = Number.isNaN(numericId) ? rawId : numericId;

  let entity = await table.get(directId);
  if (entity) {
    return entity;
  }

  if (typeof table.toCollection === 'function') {
    entity = await table
      .toCollection()
      .filter((item) => String(item?.id) === normalizedStringId || String(item?.legacyId) === normalizedStringId)
      .first();
  }

  if (!entity && directId !== rawId) {
    entity = await table.get(rawId);
  }

  return entity || null;
};

export const resolvePomodoroTarget = async (dbOrSelectedTarget, maybeSelectedTarget) => {
  const selectedTarget = maybeSelectedTarget ?? dbOrSelectedTarget;
  const tables = createTableAccess(maybeSelectedTarget == null ? api : dbOrSelectedTarget);
  const resolved = {
    ...defaultResolvedTarget(),
  };

  if (!selectedTarget || selectedTarget === 'none') {
    return resolved;
  }

  const [kind, idStr] = String(selectedTarget).split(':');
  if (!idStr) {
    return resolved;
  }

  if (kind === 'goal') {
    const goal = await getByLooseId(tables.goals, idStr);
    if (goal) {
      resolved.description = `Pomodoro - ${goal.description}`;
      resolved.goalId = goal.id;
      resolved.projectId = goal.projectId || null;
    }
    return resolved;
  }

  if (kind === 'project') {
    const project = await getByLooseId(tables.projects, idStr);
    if (project) {
      resolved.description = `Pomodoro - ${project.name}`;
      resolved.projectId = project.id;
    }
    return resolved;
  }

  if (kind === 'task') {
    const task = await getByLooseId(tables.tasks, idStr);
    if (!task) {
      return resolved;
    }

    resolved.description = `Pomodoro - ${task.text}`;
    resolved.taskId = task.id;
    resolved.projectId = task.projectId || null;

    if (task.goalId) {
      resolved.goalId = task.goalId;
      if (!resolved.projectId) {
        const taskGoal = await getByLooseId(tables.goals, task.goalId);
        if (taskGoal?.projectId) {
          resolved.projectId = taskGoal.projectId;
        }
      }
    }
  }

  return resolved;
};
