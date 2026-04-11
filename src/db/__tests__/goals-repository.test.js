jest.mock('../../api/apiClient', () => ({
  api: {
    goals: {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      bulkRemove: jest.fn(),
    },
  },
}));

// Mock useAppData to avoid pulling in react-query
jest.mock('../../hooks/useAppData', () => ({
  useGoals: jest.fn(() => ({ data: [] })),
}));

import { api } from '../../api/apiClient';
import {
  listGoals,
  getGoalById,
  listGoalsByProjectId,
  createGoal,
  updateGoal,
  deleteGoal,
  deleteGoalsByProjectId,
} from '../goals-repository';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('goals-repository', () => {
  test('listGoals calls api.goals.list', async () => {
    api.goals.list.mockResolvedValue([{ id: 1 }]);
    const result = await listGoals();
    expect(api.goals.list).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  test('getGoalById calls api.goals.get', async () => {
    api.goals.get.mockResolvedValue({ id: 1 });
    const result = await getGoalById(1);
    expect(api.goals.get).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1 });
  });

  test('listGoalsByProjectId calls list with projectId', async () => {
    api.goals.list.mockResolvedValue([]);
    await listGoalsByProjectId(5);
    expect(api.goals.list).toHaveBeenCalledWith({ projectId: 5 });
  });

  test('listGoalsByProjectId passes "null" string when null', async () => {
    api.goals.list.mockResolvedValue([]);
    await listGoalsByProjectId(null);
    expect(api.goals.list).toHaveBeenCalledWith({ projectId: 'null' });
  });

  test('createGoal calls api.goals.create', async () => {
    api.goals.create.mockResolvedValue({ id: 1 });
    const goal = { description: 'Test' };
    const result = await createGoal(goal);
    expect(api.goals.create).toHaveBeenCalledWith(goal);
    expect(result).toEqual({ id: 1 });
  });

  test('updateGoal calls api.goals.update', async () => {
    api.goals.update.mockResolvedValue({ id: 1 });
    await updateGoal(1, { description: 'Updated' });
    expect(api.goals.update).toHaveBeenCalledWith(1, { description: 'Updated' });
  });

  test('deleteGoal calls api.goals.remove', async () => {
    api.goals.remove.mockResolvedValue(undefined);
    await deleteGoal(1);
    expect(api.goals.remove).toHaveBeenCalledWith(1);
  });

  test('deleteGoalsByProjectId bulk removes goals', async () => {
    api.goals.list.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    api.goals.bulkRemove.mockResolvedValue(undefined);

    await deleteGoalsByProjectId(5);

    expect(api.goals.bulkRemove).toHaveBeenCalledWith([1, 2]);
  });

  test('deleteGoalsByProjectId does nothing when no goals found', async () => {
    api.goals.list.mockResolvedValue([]);

    const result = await deleteGoalsByProjectId(5);

    expect(api.goals.bulkRemove).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
