jest.mock('../../api/apiClient', () => ({
  api: {
    tasks: {
      bulkCreate: jest.fn(),
    },
  },
}));

import { api } from '../../api/apiClient';
import { bulkAddTasks } from '../bulkAddTasks';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('bulkAddTasks', () => {
  test('does nothing for empty tree', async () => {
    await bulkAddTasks([], 1);
    expect(api.tasks.bulkCreate).not.toHaveBeenCalled();
  });

  test('does nothing for undefined tree', async () => {
    await bulkAddTasks(undefined, 1);
    expect(api.tasks.bulkCreate).not.toHaveBeenCalled();
  });

  test('does nothing for non-array tree', async () => {
    await bulkAddTasks('not-an-array', 1);
    expect(api.tasks.bulkCreate).not.toHaveBeenCalled();
  });

  test('creates flat tasks with correct projectId and folderId', async () => {
    api.tasks.bulkCreate.mockResolvedValue([]);

    await bulkAddTasks([{ text: 'Task A' }, { text: 'Task B' }], 7, 3);

    expect(api.tasks.bulkCreate).toHaveBeenCalledTimes(1);
    const rows = api.tasks.bulkCreate.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({
      text: 'Task A',
      projectId: 7,
      folderId: 3,
      order: 0,
      completed: false,
    }));
    expect(rows[1].order).toBe(1);
  });

  test('preserves nested subtask structure', async () => {
    api.tasks.bulkCreate.mockResolvedValue([]);

    const tree = [
      {
        text: 'Parent',
        children: [
          { text: 'Child 1' },
          { text: 'Child 2', children: [{ text: 'Grandchild' }] },
        ],
      },
    ];

    await bulkAddTasks(tree, 1);

    const rows = api.tasks.bulkCreate.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].subtasks).toHaveLength(2);
    expect(rows[0].subtasks[0].text).toBe('Child 1');
    expect(rows[0].subtasks[1].subtasks).toHaveLength(1);
    expect(rows[0].subtasks[1].subtasks[0].text).toBe('Grandchild');
  });

  test('defaults folderId to null', async () => {
    api.tasks.bulkCreate.mockResolvedValue([]);

    await bulkAddTasks([{ text: 'Task' }], 1);

    const rows = api.tasks.bulkCreate.mock.calls[0][0];
    expect(rows[0].folderId).toBeNull();
  });

  test('handles nodes with missing text gracefully', async () => {
    api.tasks.bulkCreate.mockResolvedValue([]);

    await bulkAddTasks([{}], 1);

    const rows = api.tasks.bulkCreate.mock.calls[0][0];
    expect(rows[0].text).toBe('');
  });
});
