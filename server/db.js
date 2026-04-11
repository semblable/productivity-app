const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'todo.sqlite');

const ENTITY_CONFIG = {
  projects: {
    table: 'projects',
    idField: 'id',
    columns: ['id', 'name', 'color', 'createdAt'],
    jsonFields: [],
    dateFields: ['createdAt'],
  },
  tasks: {
    table: 'tasks',
    idField: 'id',
    columns: ['id', 'text', 'projectId', 'completed', 'createdAt', 'dueDate', 'priority', 'goalId', 'parentId', 'folderId', 'order', 'templateId', 'rrule', 'subtasks'],
    jsonFields: ['subtasks'],
    dateFields: ['createdAt', 'dueDate'],
  },
  goals: {
    table: 'goals',
    idField: 'id',
    columns: ['id', 'description', 'type', 'target', 'actual', 'targetHours', 'actualHours', 'progress', 'createdAt', 'projectId', 'deadline', 'startDate', 'scheduleDays'],
    jsonFields: ['scheduleDays'],
    dateFields: ['createdAt', 'deadline', 'startDate'],
  },
  timeEntries: {
    table: 'timeEntries',
    idField: 'id',
    columns: ['id', 'description', 'startTime', 'endTime', 'duration', 'goalId', 'projectId', 'taskId', 'eventId', 'sessionId'],
    jsonFields: [],
    dateFields: ['startTime', 'endTime'],
  },
  events: {
    table: 'events',
    idField: 'id',
    columns: ['id', 'title', 'startTime', 'endTime', 'rrule', 'parentId', 'lastInstance', 'projectId', 'templateId', 'gcalEventId', 'lastModifiedAt'],
    jsonFields: [],
    dateFields: ['startTime', 'endTime', 'lastInstance', 'lastModifiedAt'],
  },
  notes: {
    table: 'notes',
    idField: 'id',
    columns: ['id', 'title', 'content', 'createdAt', 'modifiedAt'],
    jsonFields: [],
    dateFields: ['createdAt', 'modifiedAt'],
  },
  folders: {
    table: 'folders',
    idField: 'id',
    columns: ['id', 'name', 'projectId', 'parentId', 'createdAt', 'color'],
    jsonFields: [],
    dateFields: ['createdAt'],
  },
  habits: {
    table: 'habits',
    idField: 'id',
    columns: ['id', 'taskId', 'name', 'startDate', 'streak', 'bestStreak', 'lastCompletionDate', 'streakFreezes', 'lastStreakMilestone', 'projectId'],
    jsonFields: [],
    dateFields: ['startDate', 'lastCompletionDate'],
  },
  habit_completions: {
    table: 'habit_completions',
    idField: 'id',
    columns: ['id', 'habitId', 'date', 'completedAt'],
    jsonFields: [],
    dateFields: ['completedAt'],
  },
  ivyLee: {
    table: 'ivyLee',
    idField: 'date',
    columns: ['date', 'tasks'],
    jsonFields: ['tasks'],
    dateFields: [],
  },
  gcal_settings: {
    table: 'gcal_settings',
    idField: 'id',
    columns: ['id', 'accessToken', 'refreshToken', 'tokenExpiry', 'syncToken', 'calendarId', 'lastSyncAt', 'enabled'],
    jsonFields: [],
    dateFields: ['tokenExpiry', 'lastSyncAt'],
  },
};

const TABLE_NAMES = Object.keys(ENTITY_CONFIG);

const database = new Database(DB_PATH);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = OFF');

function serializeField(value, field, config) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (config.jsonFields.includes(field)) {
    return JSON.stringify(value);
  }

  if (config.dateFields.includes(field)) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value;
}

function deserializeField(value, field, config) {
  if (value == null) {
    return value;
  }

  if (config.jsonFields.includes(field)) {
    try {
      return JSON.parse(value);
    } catch {
      return config.table === 'ivyLee' ? [] : null;
    }
  }

  return value;
}

function serializeRow(entityName, row) {
  const config = ENTITY_CONFIG[entityName];
  const sourceRow = entityName === 'habits' && row
    ? {
        ...row,
        streakFreezes: row.streakFreezes ?? row.streakFriezes ?? row.streakFreezes,
      }
    : row;
  const serialized = {};

  for (const [key, value] of Object.entries(sourceRow || {})) {
    if (!config.columns.includes(key)) {
      continue;
    }
    serialized[key] = serializeField(value, key, config);
  }

  return serialized;
}

function deserializeRow(entityName, row) {
  if (!row) {
    return row;
  }

  const config = ENTITY_CONFIG[entityName];
  const deserialized = {};

  for (const [key, value] of Object.entries(row)) {
    deserialized[key] = deserializeField(value, key, config);
  }

  if (entityName === 'habits') {
    deserialized.streakFreezes = deserialized.streakFreezes ?? row.streakFriezes ?? 0;
    delete deserialized.streakFriezes;
  }

  return deserialized;
}

function createPlaceholders(columns) {
  return columns.map(() => '?').join(', ');
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function qualifiedTable(entityName) {
  return quoteIdentifier(ENTITY_CONFIG[entityName].table);
}

function qualifiedColumn(column) {
  return quoteIdentifier(column);
}

function normalizeOrderBy(entityName, rawOrderBy) {
  const config = ENTITY_CONFIG[entityName];
  const fallback = `${qualifiedColumn(config.idField)} DESC`;

  if (!rawOrderBy || typeof rawOrderBy !== 'string') {
    return fallback;
  }

  const trimmed = rawOrderBy.trim();
  const match = trimmed.match(/^([A-Za-z0-9_]+)(?:\s+(ASC|DESC))?$/i);
  if (!match) {
    return fallback;
  }

  const [, column, directionRaw] = match;
  if (!config.columns.includes(column)) {
    return fallback;
  }

  const direction = (directionRaw || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return `${qualifiedColumn(column)} ${direction}`;
}

function listEntities(entityName, query = {}) {
  const config = ENTITY_CONFIG[entityName];
  const clauses = [];
  const params = [];
  let orderBy = `${qualifiedColumn(config.idField)} DESC`;
  let limit = null;

  for (const [key, rawValue] of Object.entries(query || {})) {
    if (rawValue == null || rawValue === '') {
      continue;
    }

    if (key === '_orderBy') {
      orderBy = normalizeOrderBy(entityName, rawValue);
      continue;
    }

    if (key === '_limit') {
      limit = Number(rawValue);
      continue;
    }

    if (key.endsWith('_gte')) {
      const column = key.slice(0, -4);
      if (!config.columns.includes(column)) {
        continue;
      }
      clauses.push(`${qualifiedColumn(column)} >= ?`);
      params.push(rawValue);
      continue;
    }

    if (key.endsWith('_lte')) {
      const column = key.slice(0, -4);
      if (!config.columns.includes(column)) {
        continue;
      }
      clauses.push(`${qualifiedColumn(column)} <= ?`);
      params.push(rawValue);
      continue;
    }

    if (key.endsWith('_in')) {
      const column = key.slice(0, -3);
      if (!config.columns.includes(column)) {
        continue;
      }
      const values = String(rawValue)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (values.length > 0) {
        clauses.push(`${qualifiedColumn(column)} IN (${createPlaceholders(values)})`);
        params.push(...values);
      }
      continue;
    }

    if (!config.columns.includes(key)) {
      continue;
    }

    clauses.push(`${qualifiedColumn(key)} IS ?`);
    params.push(rawValue === 'null' ? null : rawValue);
  }

  let sql = `SELECT * FROM ${qualifiedTable(entityName)}`;
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }
  sql += ` ORDER BY ${orderBy}`;
  if (Number.isFinite(limit) && limit > 0) {
    sql += ` LIMIT ${limit}`;
  }

  return database.prepare(sql).all(...params).map((row) => deserializeRow(entityName, row));
}

function getEntity(entityName, id) {
  const config = ENTITY_CONFIG[entityName];
  const row = database
    .prepare(`SELECT * FROM ${qualifiedTable(entityName)} WHERE ${qualifiedColumn(config.idField)} = ?`)
    .get(id);
  return deserializeRow(entityName, row);
}

function createEntity(entityName, payload) {
  const config = ENTITY_CONFIG[entityName];
  const serialized = serializeRow(entityName, payload);
  const columns = Object.keys(serialized).filter(
    (column) => !(column === config.idField && serialized[column] == null)
  );

  if (columns.length === 0) {
    const info = database.prepare(`INSERT INTO ${qualifiedTable(entityName)} DEFAULT VALUES`).run();
    return getEntity(entityName, info.lastInsertRowid);
  }

  const values = columns.map((column) => serialized[column]);
  const sql = `INSERT INTO ${qualifiedTable(entityName)} (${columns.map(qualifiedColumn).join(', ')}) VALUES (${createPlaceholders(columns)})`;
  const info = database.prepare(sql).run(...values);
  const entityId = serialized[config.idField] ?? info.lastInsertRowid;
  return getEntity(entityName, entityId);
}

function bulkCreateEntities(entityName, rows = []) {
  const insert = database.transaction((items) => items.map((row) => createEntity(entityName, row)));
  return insert(rows);
}

function updateEntity(entityName, id, payload) {
  const config = ENTITY_CONFIG[entityName];
  const serialized = serializeRow(entityName, payload);
  const columns = Object.keys(serialized).filter((column) => column !== config.idField);

  if (columns.length === 0) {
    return getEntity(entityName, id);
  }

  const assignments = columns.map((column) => `${qualifiedColumn(column)} = ?`).join(', ');
  const values = columns.map((column) => serialized[column]);
  database
    .prepare(`UPDATE ${qualifiedTable(entityName)} SET ${assignments} WHERE ${qualifiedColumn(config.idField)} = ?`)
    .run(...values, id);
  return getEntity(entityName, id);
}

function deleteEntity(entityName, id) {
  const config = ENTITY_CONFIG[entityName];
  return database.prepare(`DELETE FROM ${qualifiedTable(entityName)} WHERE ${qualifiedColumn(config.idField)} = ?`).run(id);
}

function bulkDeleteEntities(entityName, ids = []) {
  const config = ENTITY_CONFIG[entityName];
  if (!Array.isArray(ids) || ids.length === 0) {
    return { changes: 0 };
  }

  return database
    .prepare(`DELETE FROM ${qualifiedTable(entityName)} WHERE ${qualifiedColumn(config.idField)} IN (${createPlaceholders(ids)})`)
    .run(...ids);
}

function exportAllData() {
  const tables = {};

  for (const tableName of TABLE_NAMES) {
    tables[tableName] = listEntities(tableName, { _orderBy: `${ENTITY_CONFIG[tableName].idField} ASC` });
  }

  return {
    exportedAt: new Date().toISOString(),
    tables,
  };
}

function clearAllData() {
  const clear = database.transaction(() => {
    for (const tableName of [...TABLE_NAMES].reverse()) {
      database.prepare(`DELETE FROM ${qualifiedTable(tableName)}`).run();
    }
  });

  clear();
}

function importAllData(tableData = {}) {
  const importTransaction = database.transaction((tables) => {
    clearAllData();

    for (const tableName of TABLE_NAMES) {
      const rows = Array.isArray(tables[tableName]) ? tables[tableName] : [];
      if (rows.length > 0) {
        bulkCreateEntities(tableName, rows);
      }
    }
  });

  importTransaction(tableData);
  return exportAllData();
}

function initializeDatabase() {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      projectId INTEGER,
      completed INTEGER DEFAULT 0,
      createdAt TEXT,
      dueDate TEXT,
      priority INTEGER DEFAULT 0,
      goalId INTEGER,
      parentId INTEGER,
      folderId INTEGER,
      "order" REAL DEFAULT 0,
      templateId INTEGER,
      rrule TEXT,
      subtasks TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      type TEXT DEFAULT 'time',
      target REAL,
      actual REAL,
      targetHours REAL,
      actualHours REAL,
      progress REAL,
      createdAt TEXT,
      projectId INTEGER,
      deadline TEXT,
      startDate TEXT,
      scheduleDays TEXT
    );

    CREATE TABLE IF NOT EXISTS timeEntries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      startTime TEXT,
      endTime TEXT,
      duration INTEGER,
      goalId INTEGER,
      projectId INTEGER,
      taskId INTEGER,
      eventId INTEGER,
      sessionId TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      startTime TEXT,
      endTime TEXT,
      rrule TEXT,
      parentId INTEGER,
      lastInstance TEXT,
      projectId INTEGER,
      templateId INTEGER
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      createdAt TEXT,
      modifiedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      projectId INTEGER,
      parentId INTEGER,
      createdAt TEXT,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId INTEGER,
      name TEXT NOT NULL,
      startDate TEXT,
      streak INTEGER DEFAULT 0,
      bestStreak INTEGER DEFAULT 0,
      lastCompletionDate TEXT,
      streakFreezes INTEGER DEFAULT 0,
      lastStreakMilestone INTEGER DEFAULT 0,
      projectId INTEGER
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habitId INTEGER,
      date TEXT NOT NULL,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS ivyLee (
      date TEXT PRIMARY KEY,
      tasks TEXT
    );

    CREATE TABLE IF NOT EXISTS gcal_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      accessToken TEXT,
      refreshToken TEXT,
      tokenExpiry TEXT,
      syncToken TEXT,
      calendarId TEXT DEFAULT 'primary',
      lastSyncAt TEXT,
      enabled INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId);
    CREATE INDEX IF NOT EXISTS idx_tasks_goalId ON tasks(goalId);
    CREATE INDEX IF NOT EXISTS idx_tasks_parentId ON tasks(parentId);
    CREATE INDEX IF NOT EXISTS idx_tasks_folderId ON tasks(folderId);
    CREATE INDEX IF NOT EXISTS idx_tasks_templateId ON tasks(templateId);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt);

    CREATE INDEX IF NOT EXISTS idx_goals_projectId ON goals(projectId);
    CREATE INDEX IF NOT EXISTS idx_timeEntries_goalId ON timeEntries(goalId);
    CREATE INDEX IF NOT EXISTS idx_timeEntries_projectId ON timeEntries(projectId);
    CREATE INDEX IF NOT EXISTS idx_timeEntries_taskId ON timeEntries(taskId);
    CREATE INDEX IF NOT EXISTS idx_timeEntries_eventId ON timeEntries(eventId);
    CREATE INDEX IF NOT EXISTS idx_timeEntries_startTime ON timeEntries(startTime);
    CREATE INDEX IF NOT EXISTS idx_timeEntries_endTime ON timeEntries(endTime);

    CREATE INDEX IF NOT EXISTS idx_events_projectId ON events(projectId);
    CREATE INDEX IF NOT EXISTS idx_events_templateId ON events(templateId);
    CREATE INDEX IF NOT EXISTS idx_events_parentId ON events(parentId);
    CREATE INDEX IF NOT EXISTS idx_events_projectId_startTime ON events(projectId, startTime);
    CREATE INDEX IF NOT EXISTS idx_events_templateId_startTime ON events(templateId, startTime);
    CREATE INDEX IF NOT EXISTS idx_events_parentId_startTime ON events(parentId, startTime);

    CREATE INDEX IF NOT EXISTS idx_folders_projectId ON folders(projectId);
    CREATE INDEX IF NOT EXISTS idx_folders_parentId ON folders(parentId);
    CREATE INDEX IF NOT EXISTS idx_habits_projectId ON habits(projectId);
    CREATE INDEX IF NOT EXISTS idx_habits_taskId ON habits(taskId);
    CREATE INDEX IF NOT EXISTS idx_habitCompletions_habitId ON habit_completions(habitId);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_habitCompletions_habitId_date ON habit_completions(habitId, date);
  `);
}

function runDataMigrations() {
  const habitColumns = database.prepare(`PRAGMA table_info(${quoteIdentifier('habits')})`).all();
  const habitColumnNames = new Set(habitColumns.map((column) => column.name));

  if (habitColumnNames.has('streakFriezes')) {
    database.exec(`
      UPDATE habits
      SET streakFreezes = COALESCE(NULLIF(streakFreezes, 0), streakFriezes, 0)
      WHERE streakFriezes IS NOT NULL;
    `);
  }

  // Add gcalEventId and lastModifiedAt columns to events if missing
  const eventColumns = database.prepare(`PRAGMA table_info(${quoteIdentifier('events')})`).all();
  const eventColumnNames = new Set(eventColumns.map((column) => column.name));

  if (!eventColumnNames.has('gcalEventId')) {
    database.exec(`ALTER TABLE events ADD COLUMN gcalEventId TEXT`);
    database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_events_gcalEventId ON events(gcalEventId)`);
  }

  if (!eventColumnNames.has('lastModifiedAt')) {
    database.exec(`ALTER TABLE events ADD COLUMN lastModifiedAt TEXT`);
  }
}

initializeDatabase();
runDataMigrations();

module.exports = {
  DB_PATH,
  ENTITY_CONFIG,
  TABLE_NAMES,
  database,
  listEntities,
  getEntity,
  createEntity,
  bulkCreateEntities,
  updateEntity,
  deleteEntity,
  bulkDeleteEntities,
  exportAllData,
  clearAllData,
  importAllData,
  serializeRow,
  deserializeRow,
};
