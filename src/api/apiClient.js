const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Ignore JSON parse errors for empty responses.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function buildQuery(query = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') {
      continue;
    }
    params.set(key, value);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

function createEntityClient(entityName) {
  return {
    list: (query) => request(`/${entityName}${buildQuery(query)}`),
    get: (id) => request(`/${entityName}/${id}`),
    create: (payload) =>
      request(`/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    bulkCreate: (rows) =>
      request(`/${entityName}/bulk`, {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
    update: (id, payload) =>
      request(`/${entityName}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    replace: (id, payload) =>
      request(`/${entityName}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    remove: (id) =>
      request(`/${entityName}/${id}`, {
        method: 'DELETE',
      }),
    bulkRemove: (ids) =>
      request(`/${entityName}`, {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      }),
  };
}

export const api = {
  projects: createEntityClient('projects'),
  tasks: createEntityClient('tasks'),
  goals: {
    ...createEntityClient('goals'),
    recalculate: (id) =>
      request(`/goals/${id}/recalculate`, {
        method: 'POST',
      }),
  },
  timeEntries: createEntityClient('timeEntries'),
  events: createEntityClient('events'),
  notes: createEntityClient('notes'),
  folders: createEntityClient('folders'),
  habits: createEntityClient('habits'),
  habit_completions: createEntityClient('habit_completions'),
  ivyLee: createEntityClient('ivyLee'),
  exportData: () => request('/export'),
  importData: (tables) =>
    request('/import', {
      method: 'POST',
      body: JSON.stringify({ tables }),
    }),
  migrateData: (tables) =>
    request('/migrate', {
      method: 'POST',
      body: JSON.stringify({ tables }),
    }),
  clearData: () =>
    request('/clear', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  health: () => request('/health'),
  gcal: {
    getStatus: () => request('/gcal/status'),
    getAuthUrl: () => request('/gcal/auth-url'),
    disconnect: () => request('/gcal/disconnect', { method: 'POST' }),
    sync: () => request('/gcal/sync', { method: 'POST' }),
    updateSettings: (settings) =>
      request('/gcal/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }),
    listCalendars: () => request('/gcal/calendars'),
  },
};
