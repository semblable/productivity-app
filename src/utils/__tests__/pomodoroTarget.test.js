import { getByLooseId, resolvePomodoroTarget } from '../pomodoroTarget';

const createTable = (items, getImpl) => ({
  get: jest.fn(getImpl || (async (id) => items.find((item) => item.id === id) || null)),
  toCollection: () => ({
    filter: (predicate) => ({
      first: async () => items.find(predicate) || null,
    }),
  }),
});

describe('pomodoroTarget utils', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('getByLooseId falls back to matching string ids when direct lookup misses', async () => {
    const table = createTable([{ id: '1', description: 'Deep Work' }], async () => null);

    const result = await getByLooseId(table, '1');

    expect(table.get).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: '1', description: 'Deep Work' });
  });

  test('resolvePomodoroTarget uses legacyId to resolve a goal description', async () => {
    const db = {
      goals: createTable([{ id: 'goal-1', legacyId: '1', description: 'Write docs', projectId: 'proj-1' }], async () => null),
      projects: createTable([]),
      tasks: createTable([]),
    };

    const result = await resolvePomodoroTarget(db, 'goal:1');

    expect(result).toEqual({
      description: 'Pomodoro - Write docs',
      projectId: 'proj-1',
      goalId: 'goal-1',
      taskId: null,
    });
  });

  test('resolvePomodoroTarget inherits project from linked goal for task targets', async () => {
    const db = {
      goals: createTable([{ id: 'goal-1', description: 'Course', projectId: 'proj-9' }]),
      projects: createTable([]),
      tasks: createTable([{ id: 'task-1', text: 'Module 3', projectId: null, goalId: 'goal-1' }]),
    };

    const result = await resolvePomodoroTarget(db, 'task:task-1');

    expect(result).toEqual({
      description: 'Pomodoro - Module 3',
      projectId: 'proj-9',
      goalId: 'goal-1',
      taskId: 'task-1',
    });
  });
});
