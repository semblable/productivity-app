jest.mock('../../api/apiClient', () => ({
  api: {
    goals: {
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      recalculate: jest.fn(),
    },
    timeEntries: {
      list: jest.fn(),
    },
  },
}));

import { api } from '../../api/apiClient';
import {
  recalculateGoalHours,
  logTimeToProjectGoals,
  logTimeToGoal,
} from '../time-entry-utils';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── recalculateGoalHours ────────────────────────────────────────────
describe('recalculateGoalHours', () => {
  test('does nothing for null goalId', async () => {
    await recalculateGoalHours(null);
    expect(api.goals.recalculate).not.toHaveBeenCalled();
  });

  test('calls api.goals.recalculate', async () => {
    api.goals.recalculate.mockResolvedValue({});
    await recalculateGoalHours('g1');
    expect(api.goals.recalculate).toHaveBeenCalledWith('g1');
  });

  test('re-throws on API error', async () => {
    api.goals.recalculate.mockRejectedValue(new Error('Server error'));
    await expect(recalculateGoalHours('g1')).rejects.toThrow('Server error');
  });
});

// ── logTimeToProjectGoals ──────────────────────────────────────────
describe('logTimeToProjectGoals', () => {
  test('does nothing for null projectId', async () => {
    await logTimeToProjectGoals(null, 3600);
    expect(api.goals.list).not.toHaveBeenCalled();
  });

  test('does nothing for zero duration', async () => {
    await logTimeToProjectGoals('p1', 0);
    expect(api.goals.list).not.toHaveBeenCalled();
  });

  test('does nothing for non-finite duration', async () => {
    await logTimeToProjectGoals('p1', NaN);
    expect(api.goals.list).not.toHaveBeenCalled();
  });

  test('updates linked goals with positive duration', async () => {
    api.goals.list.mockResolvedValue([
      { id: 'g1', actualHours: 2, targetHours: 10 },
    ]);
    api.goals.update.mockResolvedValue({});

    await logTimeToProjectGoals('p1', 3600); // 1 hour

    expect(api.goals.update).toHaveBeenCalledWith('g1', {
      actualHours: 3,
      progress: 30,
    });
  });

  test('excludes specified goalId from updates', async () => {
    api.goals.list.mockResolvedValue([
      { id: 'g1', actualHours: 0, targetHours: 10 },
      { id: 'g2', actualHours: 0, targetHours: 10 },
    ]);
    api.goals.update.mockResolvedValue({});

    await logTimeToProjectGoals('p1', 3600, 'g1');

    expect(api.goals.update).toHaveBeenCalledTimes(1);
    expect(api.goals.update).toHaveBeenCalledWith('g2', expect.any(Object));
  });

  test('never drops actualHours below 0 on negative duration', async () => {
    api.goals.list.mockResolvedValue([
      { id: 'g1', actualHours: 0.1, targetHours: 10 },
    ]);
    api.goals.update.mockResolvedValue({});

    await logTimeToProjectGoals('p1', -7200); // -2 hours

    expect(api.goals.update).toHaveBeenCalledWith('g1', {
      actualHours: 0,
      progress: 0,
    });
  });

  test('does nothing when no goals linked to project', async () => {
    api.goals.list.mockResolvedValue([]);
    await logTimeToProjectGoals('p1', 3600);
    expect(api.goals.update).not.toHaveBeenCalled();
  });
});

// ── logTimeToGoal ──────────────────────────────────────────────────
describe('logTimeToGoal', () => {
  test('does nothing for null goalId', async () => {
    await logTimeToGoal(null, 3600);
    expect(api.goals.get).not.toHaveBeenCalled();
  });

  test('does nothing for zero duration', async () => {
    await logTimeToGoal('g1', 0);
    expect(api.goals.get).not.toHaveBeenCalled();
  });

  test('increments actualHours and calculates progress', async () => {
    api.goals.get.mockResolvedValue({ id: 'g1', actualHours: 5, targetHours: 10, progress: 50 });
    api.goals.update.mockResolvedValue({});

    await logTimeToGoal('g1', 3600); // +1 hour

    expect(api.goals.update).toHaveBeenCalledWith('g1', {
      actualHours: 6,
      progress: 60,
    });
  });

  test('caps progress at 100', async () => {
    api.goals.get.mockResolvedValue({ id: 'g1', actualHours: 9.5, targetHours: 10, progress: 95 });
    api.goals.update.mockResolvedValue({});

    await logTimeToGoal('g1', 7200); // +2 hours → 11.5h / 10h

    expect(api.goals.update).toHaveBeenCalledWith('g1', {
      actualHours: 11.5,
      progress: 100,
    });
  });

  test('does nothing when goal not found', async () => {
    api.goals.get.mockResolvedValue(null);

    await logTimeToGoal('g1', 3600);

    expect(api.goals.update).not.toHaveBeenCalled();
  });

  test('handles 0 targetHours (progress = 0)', async () => {
    api.goals.get.mockResolvedValue({ id: 'g1', actualHours: 0, targetHours: 0, progress: 0 });
    api.goals.update.mockResolvedValue({});

    await logTimeToGoal('g1', 3600);

    expect(api.goals.update).toHaveBeenCalledWith('g1', {
      actualHours: 1,
      progress: 0,
    });
  });
});
