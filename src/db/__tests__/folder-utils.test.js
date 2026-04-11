jest.mock('../../api/apiClient', () => ({
  api: {
    folders: {
      create: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      bulkRemove: jest.fn(),
    },
    tasks: {
      list: jest.fn(),
      update: jest.fn(),
      bulkRemove: jest.fn(),
    },
  },
}));

import { api } from '../../api/apiClient';
import {
  createFolder,
  renameFolder,
  deleteFolder,
  getFoldersForProject,
} from '../folder-utils';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createFolder ────────────────────────────────────────────────────
describe('createFolder', () => {
  test('calls api.folders.create with correct payload', async () => {
    api.folders.create.mockResolvedValue({ id: 42 });

    const id = await createFolder({ name: 'Stuff', projectId: 1, color: '#FF0000' });

    expect(api.folders.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Stuff',
      projectId: 1,
      parentId: null,
      color: '#FF0000',
    }));
    expect(id).toBe(42);
  });

  test('passes parentId when provided', async () => {
    api.folders.create.mockResolvedValue({ id: 43 });

    await createFolder({ name: 'Child', projectId: 1, parentId: 5 });

    expect(api.folders.create).toHaveBeenCalledWith(expect.objectContaining({
      parentId: 5,
    }));
  });

  test('defaults undefined projectId to null', async () => {
    api.folders.create.mockResolvedValue({ id: 44 });

    await createFolder({ name: 'Loose' });

    expect(api.folders.create).toHaveBeenCalledWith(expect.objectContaining({
      projectId: null,
      parentId: null,
    }));
  });
});

// ── renameFolder ────────────────────────────────────────────────────
describe('renameFolder', () => {
  test('calls api.folders.update with name', async () => {
    api.folders.update.mockResolvedValue({});

    await renameFolder(1, 'New Name');

    expect(api.folders.update).toHaveBeenCalledWith(1, { name: 'New Name' });
  });
});

// ── deleteFolder ────────────────────────────────────────────────────
describe('deleteFolder', () => {
  test('does nothing for null id', async () => {
    await deleteFolder(null);
    expect(api.folders.list).not.toHaveBeenCalled();
  });

  test('cascade=true deletes tasks in all child folders', async () => {
    api.folders.list.mockResolvedValue([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
    ]);
    api.tasks.list
      .mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }])  // folder 1
      .mockResolvedValueOnce([{ id: 't3' }]);                // folder 2
    api.tasks.bulkRemove.mockResolvedValue(undefined);
    api.folders.bulkRemove.mockResolvedValue(undefined);

    await deleteFolder(1, { cascade: true });

    expect(api.tasks.bulkRemove).toHaveBeenCalledWith(['t1', 't2']);
    expect(api.tasks.bulkRemove).toHaveBeenCalledWith(['t3']);
    expect(api.folders.bulkRemove).toHaveBeenCalledWith([1, 2]);
  });

  test('cascade=false unlinks tasks (sets folderId to null)', async () => {
    api.folders.list.mockResolvedValue([
      { id: 1, parentId: null },
    ]);
    api.tasks.list.mockResolvedValue([{ id: 't1' }]);
    api.tasks.update.mockResolvedValue(undefined);
    api.folders.bulkRemove.mockResolvedValue(undefined);

    await deleteFolder(1, { cascade: false });

    expect(api.tasks.update).toHaveBeenCalledWith('t1', { folderId: null });
    expect(api.tasks.bulkRemove).not.toHaveBeenCalled();
  });

  test('handles folder with no children and no tasks', async () => {
    api.folders.list.mockResolvedValue([{ id: 5, parentId: null }]);
    api.tasks.list.mockResolvedValue([]);
    api.folders.bulkRemove.mockResolvedValue(undefined);

    await deleteFolder(5);

    expect(api.folders.bulkRemove).toHaveBeenCalledWith([5]);
  });
});

// ── getFoldersForProject ────────────────────────────────────────────
describe('getFoldersForProject', () => {
  test('passes projectId to query', async () => {
    api.folders.list.mockResolvedValue([]);

    await getFoldersForProject(7);

    expect(api.folders.list).toHaveBeenCalledWith({ projectId: 7 });
  });

  test('passes "null" string when projectId is null', async () => {
    api.folders.list.mockResolvedValue([]);

    await getFoldersForProject(null);

    expect(api.folders.list).toHaveBeenCalledWith({ projectId: 'null' });
  });
});
