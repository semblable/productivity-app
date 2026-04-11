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

  // ── getByLooseId ────────────────────────────────────────────────
  describe('getByLooseId', () => {
    test('returns null for null table', async () => {
      expect(await getByLooseId(null, '1')).toBeNull();
    });

    test('returns null for null rawId', async () => {
      const table = createTable([]);
      expect(await getByLooseId(table, null)).toBeNull();
    });

    test('returns null for empty string rawId', async () => {
      const table = createTable([]);
      expect(await getByLooseId(table, '')).toBeNull();
    });

    test('returns entity on direct hit (skips collection filter)', async () => {
      const item = { id: 42, description: 'Direct' };
      const table = createTable([item]);

      const result = await getByLooseId(table, 42);
      expect(result).toEqual(item);
    });

    test('falls back to matching string ids when direct lookup misses', async () => {
      const table = createTable([{ id: '1', description: 'Deep Work' }], async () => null);

      const result = await getByLooseId(table, '1');

      expect(table.get).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: '1', description: 'Deep Work' });
    });

    test('falls back to legacyId match', async () => {
      const table = createTable(
        [{ id: 'uuid-1', legacyId: '99', description: 'Legacy' }],
        async () => null,
      );

      const result = await getByLooseId(table, '99');
      expect(result).toEqual({ id: 'uuid-1', legacyId: '99', description: 'Legacy' });
    });
  });

  // ── resolvePomodoroTarget ───────────────────────────────────────
  describe('resolvePomodoroTarget', () => {
    test('returns default for "none" target', async () => {
      const db = {
        goals: createTable([]),
        projects: createTable([]),
        tasks: createTable([]),
      };

      const result = await resolvePomodoroTarget(db, 'none');

      expect(result).toEqual({
        description: 'Pomodoro',
        projectId: null,
        goalId: null,
        taskId: null,
      });
    });

    test('returns default for null/undefined target', async () => {
      const db = {
        goals: createTable([]),
        projects: createTable([]),
        tasks: createTable([]),
      };

      const result = await resolvePomodoroTarget(db, null);

      expect(result).toEqual({
        description: 'Pomodoro',
        projectId: null,
        goalId: null,
        taskId: null,
      });
    });

    test('returns default when target has no colon (missing idStr)', async () => {
      const db = {
        goals: createTable([]),
        projects: createTable([]),
        tasks: createTable([]),
      };

      const result = await resolvePomodoroTarget(db, 'goal');

      expect(result).toEqual({
        description: 'Pomodoro',
        projectId: null,
        goalId: null,
        taskId: null,
      });
    });

    test('resolves goal target with legacyId', async () => {
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

    test('resolves project target', async () => {
      const db = {
        goals: createTable([]),
        projects: createTable([{ id: 'proj-5', name: 'My Project' }]),
        tasks: createTable([]),
      };

      const result = await resolvePomodoroTarget(db, 'project:proj-5');

      expect(result).toEqual({
        description: 'Pomodoro - My Project',
        projectId: 'proj-5',
        goalId: null,
        taskId: null,
      });
    });

    test('resolves project target with missing project → default description', async () => {
      const db = {
        goals: createTable([]),
        projects: createTable([], async () => null),
        tasks: createTable([]),
      };

      const result = await resolvePomodoroTarget(db, 'project:999');

      expect(result.description).toBe('Pomodoro');
      expect(result.projectId).toBeNull();
    });

    test('inherits project from linked goal for task targets', async () => {
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

    test('task target with own projectId does not override with goal projectId', async () => {
      const db = {
        goals: createTable([{ id: 'goal-1', description: 'Course', projectId: 'proj-9' }]),
        projects: createTable([]),
        tasks: createTable([{ id: 'task-1', text: 'Module 3', projectId: 'proj-5', goalId: 'goal-1' }]),
      };

      const result = await resolvePomodoroTarget(db, 'task:task-1');

      expect(result.projectId).toBe('proj-5');
    });

    test('task target with missing task → default', async () => {
      const db = {
        goals: createTable([]),
        projects: createTable([]),
        tasks: createTable([], async () => null),
      };

      const result = await resolvePomodoroTarget(db, 'task:999');

      expect(result.description).toBe('Pomodoro');
    });
  });
});
