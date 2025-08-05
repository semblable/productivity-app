import Dexie from 'dexie';

export const db = new Dexie('myLocalPlannerApp');

// Version 2 (legacy)
db.version(2).stores({
  projects: '++id, name, createdAt',
  tasks: '++id, text, projectId, completed, createdAt',
  timeGoals: '++id, description, totalTime, progress, createdAt',
  timeEntries: '++id, description, startTime, endTime, goalId, projectId',
  events: '++id, title, startTime, endTime, rrule, parentId, lastInstance',
  notes: '++id, title, content, createdAt, modifiedAt',
});

// Version 3 – add goalId index for tasks
db.version(3).stores({
  projects: '++id, name, createdAt',
  tasks: '++id, text, projectId, completed, createdAt, goalId',
  timeGoals: '++id, description, totalTime, progress, createdAt',
  timeEntries: '++id, description, startTime, endTime, goalId, projectId',
  events: '++id, title, startTime, endTime, rrule, parentId, lastInstance',
  notes: '++id, title, content, createdAt, modifiedAt',
});

// Version 4 - Refactor Goals
db.version(4).stores({
  tasks: '++id, text, projectId, completed, createdAt, goalId',
  goals: '++id, description, type, target, actual, targetHours, actualHours, progress, createdAt',
  timeGoals: null,
}).upgrade(tx => {
  return tx.table('timeGoals').toArray().then(oldGoals => {
    const newGoals = oldGoals.map(g => ({
      description: g.description,
      type: 'time',
      target: g.targetHours || 0,
      actual: g.actualHours || 0,
      targetHours: g.targetHours || 0,
      actualHours: g.actualHours || 0,
      progress: g.progress || 0,
      createdAt: g.createdAt || new Date(),
    }));
    return tx.table('goals').bulkAdd(newGoals);
  });
});

// Version 5 - Add projectId to goals
db.version(5).stores({
  goals: '++id, description, type, target, actual, targetHours, actualHours, progress, createdAt, projectId',
});

// Version 6 - Add taskId and eventId to time entries
db.version(6).stores({
    timeEntries: '++id, description, startTime, endTime, goalId, projectId, taskId, eventId',
});

// Version 7 - Add Ivy Lee planner table
db.version(7).stores({
  ivyLee: '&date' // Primary key is the date string 'YYYY-MM-DD'
});

// Version 8 - Add tables for Habit Tracking
db.version(8).stores({
  habits: '++id, taskId, name, startDate, streak, bestStreak, lastCompletionDate',
  habit_completions: '++id, habitId, date'
});

// Version 9 - Add streak freeze to habits
db.version(9).stores({
    habits: '++id, taskId, name, startDate, streak, bestStreak, lastCompletionDate, streakFriezes'
}).upgrade(tx => {
    // This upgrade function is optional, but good practice if you need to set a default value.
    // For new fields, Dexie automatically handles it if they can be `undefined`.
    // If you wanted to give everyone 1 free streak freeze to start:
    // return tx.table('habits').toCollection().modify({ streakFriezes: 1 });
});

// Version 10 - Add lastStreakMilestone to habits
db.version(10).stores({
    habits: '++id, taskId, name, startDate, streak, bestStreak, lastCompletionDate, streakFriezes, lastStreakMilestone'
});

// Version 11 - Add projectId to events for easier querying
db.version(11).stores({
    events: '++id, title, startTime, endTime, rrule, parentId, lastInstance, projectId'
});

// Version 12 - Add projectId to habits
db.version(12).stores({
    habits: '++id, taskId, name, startDate, streak, bestStreak, lastCompletionDate, streakFriezes, lastStreakMilestone, projectId'
});

// Version 18 - No schema changes, just to resolve version error.
db.version(18).stores({});

// Version 19 - Add parentId index to tasks to support subtask queries
db.version(19).stores({
  tasks: '++id, text, projectId, completed, createdAt, goalId, parentId'
});

// Version 20 - Add folders table and folderId/order fields to tasks
// Also add 'order' field for manual ordering via drag-and-drop.
db.version(20).stores({
  tasks: '++id, text, projectId, completed, createdAt, goalId, parentId, folderId, order',
  folders: '++id, name, projectId, createdAt, color'
}).upgrade(tx => {
  // Ensure existing task rows have default folderId and order
  return tx.table('tasks').toCollection().modify(task => {
    if (!('folderId' in task)) task.folderId = null;
    if (!('order' in task)) task.order = 0;
  });
});

// No migration needed; goalId defaults to null for existing rows.

// Version 21 - Rename streakFriezes to streakFreezes
// Keep both fields indexed for backward compatibility but migrate data to the new field.
db.version(21).stores({
    habits: '++id, taskId, name, startDate, streak, bestStreak, lastCompletionDate, streakFriezes, streakFreezes, lastStreakMilestone, projectId'
}).upgrade(async (tx) => {
    const habitsTable = tx.table('habits');
    await habitsTable.toCollection().modify(habit => {
        if (habit.streakFriezes != null && habit.streakFreezes == null) {
            habit.streakFreezes = habit.streakFriezes;
        }
    });
});

// Version 22 - Add compound index [habitId+date] to habit_completions for faster look-ups
// No data migration required.
db.version(22).stores({
    habit_completions: '++id, habitId, date, [habitId+date]'
});

// Version 23 - Add parentId to folders for nesting support
// Existing folders default to parentId = null
// compound index not needed yet

db.version(23).stores({
  folders: '++id, name, projectId, parentId, createdAt, color'
}).upgrade(tx => tx.table('folders').toCollection().modify(f => {
  if (!('parentId' in f)) f.parentId = null;
}));

// Version 24 - Add templateId to tasks for recurring task tracking without parentId
// This replaces the parentId approach for recurring task instances
db.version(24).stores({
  tasks: '++id, text, projectId, completed, createdAt, goalId, parentId, folderId, order, templateId'
}).upgrade(tx => tx.table('tasks').toCollection().modify(t => {
  if (!('templateId' in t)) t.templateId = null;
}));

// Version 25 - Add templateId to events for consistency with recurring tasks
db.version(25).stores({
  events: '++id, title, startTime, endTime, rrule, parentId, lastInstance, projectId, templateId'
}).upgrade(tx => tx.table('events').toCollection().modify(e => {
  if (!('templateId' in e)) e.templateId = null;
}));

// --- Compatibility alias ---
// Older components may still reference db.timeGoals. Point it to the new goals table
db.timeGoals = db.table('goals');

export const projectColors = [
  '#FF5252',
  '#FF9800',
  '#4CAF50',
  '#2196F3',
  '#9C27B0',
  '#607D8B',
  '#795548',
  '#E91E63',
];

export const getDefaultProject = async () => {
  const project = await db.projects.toCollection().first();
  if (project) {
    return project;
  }
  return { id: 1, name: 'Default Project', color: '#CCCCCC' };
};