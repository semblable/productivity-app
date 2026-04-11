// Test the API client utility functions and entity client factory

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

// We need to import fresh each time since the module uses fetch at call time
// Use dynamic import pattern via jest.isolateModules
const loadModule = () => {
  let mod;
  jest.isolateModules(() => {
    mod = require('../apiClient');
  });
  return mod;
};

describe('apiClient', () => {
  describe('request (via entity methods)', () => {
    test('list() makes GET request and returns JSON', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      });

      const { api } = loadModule();
      const result = await api.projects.list();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
      expect(result).toEqual(mockData);
    });

    test('get() makes GET request with id', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1 }),
      });

      const { api } = loadModule();
      await api.projects.get(1);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects/1',
        expect.any(Object),
      );
    });

    test('create() makes POST request with body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 1, name: 'New' }),
      });

      const { api } = loadModule();
      await api.projects.create({ name: 'New' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New' }),
        }),
      );
    });

    test('update() makes PATCH request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1, name: 'Updated' }),
      });

      const { api } = loadModule();
      await api.projects.update(1, { name: 'Updated' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated' }),
        }),
      );
    });

    test('replace() makes PUT request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1 }),
      });

      const { api } = loadModule();
      await api.projects.replace(1, { name: 'Full' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects/1',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    test('remove() makes DELETE request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      const { api } = loadModule();
      const result = await api.projects.remove(1);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/projects/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(result).toBeNull(); // 204 returns null
    });

    test('bulkCreate() POSTs to /bulk endpoint', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve([]),
      });

      const { api } = loadModule();
      await api.tasks.bulkCreate([{ text: 'A' }, { text: 'B' }]);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tasks/bulk',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ rows: [{ text: 'A' }, { text: 'B' }] }),
        }),
      );
    });

    test('bulkRemove() DELETEs with ids body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ deleted: 2 }),
      });

      const { api } = loadModule();
      await api.tasks.bulkRemove([1, 2]);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tasks',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ ids: [1, 2] }),
        }),
      );
    });

    test('error response throws with server message', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad input' }),
      });

      const { api } = loadModule();
      await expect(api.projects.create({})).rejects.toThrow('Bad input');
    });

    test('error response throws generic message when JSON parse fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      });

      const { api } = loadModule();
      await expect(api.projects.list()).rejects.toThrow('Request failed (500)');
    });

    test('list() with query params builds URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      const { api } = loadModule();
      await api.tasks.list({ projectId: 5, _orderBy: 'createdAt DESC' });

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('projectId=5');
      expect(calledUrl).toContain('_orderBy=');
    });

    test('list() with null/empty query values are filtered', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      const { api } = loadModule();
      await api.tasks.list({ projectId: null, text: '' });

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toBe('/api/tasks');
    });
  });

  describe('special api methods', () => {
    test('goals.recalculate makes POST', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const { api } = loadModule();
      await api.goals.recalculate(5);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/goals/5/recalculate',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    test('exportData calls /export', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tables: {} }),
      });

      const { api } = loadModule();
      await api.exportData();

      expect(global.fetch).toHaveBeenCalledWith('/api/export', expect.any(Object));
    });

    test('health calls /health', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });

      const { api } = loadModule();
      const result = await api.health();
      expect(result).toEqual({ ok: true });
    });

    test('clearData calls /clear with POST', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });

      const { api } = loadModule();
      await api.clearData();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/clear',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    test('importData calls /import with POST', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const { api } = loadModule();
      await api.importData({ projects: [] });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/import',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tables: { projects: [] } }),
        }),
      );
    });
  });

  describe('entity clients exist for all entities', () => {
    const entities = [
      'projects', 'tasks', 'goals', 'timeEntries',
      'events', 'notes', 'folders', 'habits',
      'habit_completions', 'ivyLee',
    ];

    test.each(entities)('api.%s has list/get/create/update/remove', (entity) => {
      const { api } = loadModule();
      expect(typeof api[entity].list).toBe('function');
      expect(typeof api[entity].get).toBe('function');
      expect(typeof api[entity].create).toBe('function');
      expect(typeof api[entity].update).toBe('function');
      expect(typeof api[entity].remove).toBe('function');
    });
  });
});
