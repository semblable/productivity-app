jest.mock('../../api/apiClient', () => ({
  api: {
    habits: {
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
    habit_completions: {
      list: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      bulkRemove: jest.fn(),
    },
    tasks: {
      remove: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { api } from '../../api/apiClient';
import toast from 'react-hot-toast';
import {
  updateHabit,
  uncompleteHabitToday,
  deleteHabit,
  updateHabitName,
  checkBrokenStreaks,
} from '../habit-utils';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── updateHabit ─────────────────────────────────────────────────────
describe('updateHabit', () => {
  test('does nothing for null taskId', async () => {
    await updateHabit(null);
    expect(api.habits.list).not.toHaveBeenCalled();
  });

  test('does nothing when no habit linked to task', async () => {
    api.habits.list.mockResolvedValue([]);
    await updateHabit('task-1');
    expect(api.habit_completions.create).not.toHaveBeenCalled();
  });

  test('skips if already completed today', async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    api.habits.list.mockResolvedValue([{ id: 'h1', taskId: 't1' }]);
    api.habit_completions.list.mockResolvedValue([{ id: 'c1', habitId: 'h1', date: todayStr }]);

    await updateHabit('t1');
    expect(api.habit_completions.create).not.toHaveBeenCalled();
  });

  test('creates completion and recalculates streak', async () => {
    const habit = { id: 'h1', taskId: 't1', bestStreak: 0, streakFreezes: 0, lastStreakMilestone: 0 };
    api.habits.list.mockResolvedValue([habit]);
    // First call: check today's completion (none exists)
    api.habit_completions.list
      .mockResolvedValueOnce([])                      // no completion today
      .mockResolvedValueOnce([{ date: new Date().toISOString().split('T')[0] }]); // recalc: today's completion
    api.habits.get.mockResolvedValue(habit);
    api.habits.update.mockResolvedValue(habit);
    api.habit_completions.create.mockResolvedValue({});

    await updateHabit('t1');

    expect(api.habit_completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ habitId: 'h1' }),
    );
    expect(toast.success).toHaveBeenCalled();
  });
});

// ── uncompleteHabitToday ─────────────────────────────────────────────
describe('uncompleteHabitToday', () => {
  test('removes today completion and recalculates', async () => {
    const habit = { id: 'h1', name: 'Read', bestStreak: 5, streakFreezes: 0, lastStreakMilestone: 0 };
    api.habits.get.mockResolvedValue(habit);
    api.habit_completions.list
      .mockResolvedValueOnce([{ id: 'c1' }])  // today's completion
      .mockResolvedValueOnce([]);              // recalc: no completions
    api.habit_completions.remove.mockResolvedValue(undefined);
    api.habits.update.mockResolvedValue(habit);

    await uncompleteHabitToday('h1');

    expect(api.habit_completions.remove).toHaveBeenCalledWith('c1');
    expect(toast.success).toHaveBeenCalled();
  });

  test('does nothing when habit not found', async () => {
    api.habits.get.mockResolvedValue(null);
    await uncompleteHabitToday('h1');
    expect(api.habit_completions.list).not.toHaveBeenCalled();
  });
});

// ── deleteHabit ─────────────────────────────────────────────────────
describe('deleteHabit', () => {
  test('does nothing for null habitId', async () => {
    await deleteHabit(null);
    expect(api.habits.remove).not.toHaveBeenCalled();
  });

  test('removes habit and completions', async () => {
    api.habit_completions.list.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    api.habit_completions.bulkRemove.mockResolvedValue(undefined);
    api.habits.remove.mockResolvedValue(undefined);

    await deleteHabit('h1');

    expect(api.habit_completions.bulkRemove).toHaveBeenCalledWith(['c1', 'c2']);
    expect(api.habits.remove).toHaveBeenCalledWith('h1');
  });

  test('also removes linked task when taskId provided', async () => {
    api.habit_completions.list.mockResolvedValue([]);
    api.habits.remove.mockResolvedValue(undefined);
    api.tasks.remove.mockResolvedValue(undefined);

    await deleteHabit('h1', 't1');

    expect(api.tasks.remove).toHaveBeenCalledWith('t1');
  });

  test('does not remove task when no taskId', async () => {
    api.habit_completions.list.mockResolvedValue([]);
    api.habits.remove.mockResolvedValue(undefined);

    await deleteHabit('h1');

    expect(api.tasks.remove).not.toHaveBeenCalled();
  });
});

// ── updateHabitName ─────────────────────────────────────────────────
describe('updateHabitName', () => {
  test('updates habit name and linked task', async () => {
    const habit = { id: 'h1', taskId: 't1' };
    api.habits.get.mockResolvedValue(habit);
    api.habits.update.mockResolvedValue(undefined);
    api.tasks.update.mockResolvedValue(undefined);

    await updateHabitName('h1', 'New Name', 'proj-2');

    expect(api.habits.update).toHaveBeenCalledWith('h1', { name: 'New Name', projectId: 'proj-2' });
    expect(api.tasks.update).toHaveBeenCalledWith('t1', { text: 'New Name', projectId: 'proj-2' });
  });

  test('does nothing when habit not found', async () => {
    api.habits.get.mockResolvedValue(null);
    await updateHabitName('h1', 'New Name');
    expect(api.habits.update).not.toHaveBeenCalled();
  });

  test('skips task update when habit has no taskId', async () => {
    const habit = { id: 'h1', taskId: null };
    api.habits.get.mockResolvedValue(habit);
    api.habits.update.mockResolvedValue(undefined);

    await updateHabitName('h1', 'New Name');

    expect(api.tasks.update).not.toHaveBeenCalled();
  });
});

// ── checkBrokenStreaks ──────────────────────────────────────────────
describe('checkBrokenStreaks', () => {
  test('skips habits with no lastCompletionDate', async () => {
    api.habits.list.mockResolvedValue([{ id: 'h1', lastCompletionDate: null, streak: 0 }]);
    await checkBrokenStreaks();
    expect(api.habits.update).not.toHaveBeenCalled();
  });

  test('breaks streak when no freezes available', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);

    api.habits.list.mockResolvedValue([{
      id: 'h1',
      name: 'Exercise',
      streak: 5,
      streakFreezes: 0,
      lastCompletionDate: yesterday.toISOString(),
    }]);
    api.habits.update.mockResolvedValue(undefined);

    await checkBrokenStreaks();

    expect(api.habits.update).toHaveBeenCalledWith('h1', { streak: 0 });
    expect(toast.error).toHaveBeenCalled();
  });

  test('uses freeze when available', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2); // missed 1 day

    api.habits.list.mockResolvedValue([{
      id: 'h1',
      name: 'Meditate',
      streak: 10,
      streakFreezes: 1,
      lastCompletionDate: yesterday.toISOString(),
    }]);
    api.habits.update.mockResolvedValue(undefined);
    api.habit_completions.create.mockResolvedValue(undefined);

    await checkBrokenStreaks();

    expect(api.habit_completions.create).toHaveBeenCalled();
    expect(api.habits.update).toHaveBeenCalledWith('h1', expect.objectContaining({
      streakFreezes: 0,
    }));
    expect(toast.info).toHaveBeenCalled();
  });

  test('does not break streak if it is already 0', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    api.habits.list.mockResolvedValue([{
      id: 'h1',
      name: 'Run',
      streak: 0,
      streakFreezes: 0,
      lastCompletionDate: threeDaysAgo.toISOString(),
    }]);

    await checkBrokenStreaks();

    expect(api.habits.update).not.toHaveBeenCalled();
  });
});
