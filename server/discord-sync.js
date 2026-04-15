const {
  listEntities,
  getEntity,
  createEntity,
  updateEntity,
} = require('./db');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FIREBASE_DB_URL = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
const FIREBASE_DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || '';
const DISCORD_SYNC_SECRET = process.env.DISCORD_SYNC_SECRET || '';
const STALE_COMMAND_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMER_TITLE = process.env.DISCORD_TIMER_DEFAULT_TITLE || 'Discord timer';

let pollTimer = null;
let syncTimer = null;
let activeTimer = null;
const SYNC_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Firebase REST helpers
// ---------------------------------------------------------------------------

function isConfigured() {
  return !!(FIREBASE_DB_URL && FIREBASE_DB_SECRET);
}

async function fbGet(path) {
  const url = `${FIREBASE_DB_URL}/${path}.json?auth=${FIREBASE_DB_SECRET}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firebase GET ${path}: ${res.status}`);
  return res.json();
}

async function fbSet(path, data) {
  const url = `${FIREBASE_DB_URL}/${path}.json?auth=${FIREBASE_DB_SECRET}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase PUT ${path}: ${res.status}`);
  return res.json();
}

async function fbPatch(path, data) {
  const url = `${FIREBASE_DB_URL}/${path}.json?auth=${FIREBASE_DB_SECRET}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase PATCH ${path}: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Name resolution helpers
// ---------------------------------------------------------------------------

function resolveProject(name) {
  if (!name) return null;
  const projects = listEntities('projects');
  const lower = name.toLowerCase();

  const exact = projects.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact;

  const matches = projects
    .filter((p) => p.name.toLowerCase().includes(lower))
    .sort((a, b) => a.name.length - b.name.length);

  return matches[0] || null;
}

function resolveGoal(name, projectId) {
  if (!name) return null;
  const query = projectId ? { projectId } : {};
  const goals = listEntities('goals', query);
  const lower = name.toLowerCase();

  const exact = goals.find((g) => g.description.toLowerCase() === lower);
  if (exact) return exact;

  const matches = goals
    .filter((g) => g.description.toLowerCase().includes(lower))
    .sort((a, b) => a.description.length - b.description.length);

  return matches[0] || null;
}

function availableNames(entityName, field) {
  const entities = listEntities(entityName);
  return entities.map((e) => e[field]).slice(0, 10).join(', ');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

async function writeResult(cmdId, result) {
  await fbSet(`discord-sync/command-results/${cmdId}`, {
    ...result,
    timestamp: Date.now(),
  });
}

async function updateTimerState(state) {
  await fbSet('discord-sync/timer-state', {
    ...state,
    lastUpdated: Date.now(),
  });
}

function updateGoalProgress(goalId) {
  const goal = getEntity('goals', goalId);
  if (!goal) return;
  const entries = listEntities('timeEntries', { goalId: String(goalId) });
  const totalSeconds = entries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
  const actualHours = totalSeconds / 3600;
  const progress = goal.targetHours > 0
    ? Math.min(100, Math.round((actualHours / goal.targetHours) * 100))
    : 0;
  updateEntity('goals', goalId, { actualHours, progress });
}

// ---------------------------------------------------------------------------
// Projects & goals sync to Firebase (so bot can read them offline)
// ---------------------------------------------------------------------------

let lastProjectCount = -1;
let lastGoalCount = -1;

async function syncProjectsAndGoals() {
  try {
    const projects = listEntities('projects');
    const goals = listEntities('goals');

    await fbSet('discord-sync/projects', projects.map(p => ({
      id: p.id,
      name: p.name,
    })));

    await fbSet('discord-sync/goals', goals.map(g => ({
      id: g.id,
      description: g.description,
      projectId: g.projectId || null,
      targetHours: g.targetHours || null,
    })));

    // Only log when counts change to reduce noise
    if (projects.length !== lastProjectCount || goals.length !== lastGoalCount) {
      console.log(`[discord-sync] Synced ${projects.length} projects, ${goals.length} goals to Firebase`);
      lastProjectCount = projects.length;
      lastGoalCount = goals.length;
    }
  } catch (err) {
    console.error('[discord-sync] Projects/goals sync error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Pending entries sync (bot writes these when server is offline)
// ---------------------------------------------------------------------------

async function syncPendingEntries() {
  try {
    const pending = await fbGet('discord-sync/pending-entries');
    if (!pending) return;

    for (const [id, entry] of Object.entries(pending)) {
      if (!entry) continue;

      // Deduplicate by sessionId
      const existing = listEntities('timeEntries').find(
        (e) => e.sessionId && e.sessionId === entry.sessionId
      );
      if (existing) {
        await fbSet(`discord-sync/pending-entries/${id}`, null);
        console.log(`[discord-sync] Skipped duplicate pending entry: ${entry.sessionId}`);
        continue;
      }

      createEntity('timeEntries', {
        description: entry.description,
        startTime: entry.startTime,
        endTime: entry.endTime,
        duration: entry.duration,
        projectId: entry.projectId || null,
        goalId: entry.goalId || null,
        sessionId: entry.sessionId,
      });

      if (entry.goalId) {
        updateGoalProgress(entry.goalId);
      }

      await fbSet(`discord-sync/pending-entries/${id}`, null);
      console.log(`[discord-sync] Synced pending entry: "${entry.description}" (${formatDuration(entry.duration)})`);
    }
  } catch (err) {
    console.error('[discord-sync] Pending entries sync error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleStart(cmdId, cmd) {
  if (activeTimer) {
    await writeResult(cmdId, {
      success: false,
      message: `Timer already running: "${activeTimer.description}". Stop it first.`,
    });
    return;
  }

  const project = resolveProject(cmd.project);
  const goal = resolveGoal(cmd.goal, project?.id);

  if (cmd.project && !project) {
    await writeResult(cmdId, {
      success: false,
      message: `Project "${cmd.project}" not found. Available: ${availableNames('projects', 'name') || '(none)'}`,
    });
    return;
  }

  if (cmd.goal && !goal) {
    await writeResult(cmdId, {
      success: false,
      message: `Goal "${cmd.goal}" not found. Available: ${availableNames('goals', 'description') || '(none)'}`,
    });
    return;
  }

  const now = Date.now();
  activeTimer = {
    description: cmd.description || DEFAULT_TIMER_TITLE,
    projectId: project?.id || null,
    projectName: project?.name || null,
    goalId: goal?.id || null,
    goalName: goal?.description || null,
    startTime: now,
    sessionId: `discord-${now}-${Math.random().toString(36).slice(2, 8)}`,
  };

  await updateTimerState({
    active: true,
    description: activeTimer.description,
    projectName: activeTimer.projectName,
    goalName: activeTimer.goalName,
    projectId: activeTimer.projectId,
    goalId: activeTimer.goalId,
    startTime: activeTimer.startTime,
    sessionId: activeTimer.sessionId,
    origin: 'discord',
  });

  let msg = `Timer started: "${activeTimer.description}"`;
  if (activeTimer.projectName) msg += ` | Project: ${activeTimer.projectName}`;
  if (activeTimer.goalName) msg += ` | Goal: ${activeTimer.goalName}`;

  await writeResult(cmdId, { success: true, message: msg });
  console.log(`[discord-sync] ${msg}`);
}

async function handleStop(cmdId) {
  if (!activeTimer) {
    await writeResult(cmdId, {
      success: false,
      message: 'No timer is currently running.',
    });
    return;
  }

  const now = Date.now();
  const durationSec = Math.round((now - activeTimer.startTime) / 1000);

  const entry = createEntity('timeEntries', {
    description: activeTimer.description,
    startTime: new Date(activeTimer.startTime).toISOString(),
    endTime: new Date(now).toISOString(),
    duration: durationSec,
    projectId: activeTimer.projectId,
    goalId: activeTimer.goalId,
    sessionId: activeTimer.sessionId,
  });

  if (activeTimer.goalId) {
    updateGoalProgress(activeTimer.goalId);
  }

  let msg = `Timer stopped: "${activeTimer.description}" | Duration: ${formatDuration(durationSec)}`;
  if (activeTimer.goalName) msg += ` | Logged to goal "${activeTimer.goalName}"`;

  await updateTimerState({ active: false });
  activeTimer = null;

  await writeResult(cmdId, { success: true, message: msg, duration: durationSec, entryId: entry.id });
  console.log(`[discord-sync] ${msg}`);
}

async function handleStatus(cmdId) {
  if (!activeTimer) {
    await writeResult(cmdId, {
      success: true,
      message: 'No timer running.',
      active: false,
    });
    return;
  }

  const elapsed = Math.round((Date.now() - activeTimer.startTime) / 1000);
  let msg = `Timer running: "${activeTimer.description}" | ${formatDuration(elapsed)}`;
  if (activeTimer.projectName) msg += ` | Project: ${activeTimer.projectName}`;
  if (activeTimer.goalName) msg += ` | Goal: ${activeTimer.goalName}`;

  await writeResult(cmdId, {
    success: true,
    message: msg,
    active: true,
    elapsed,
    description: activeTimer.description,
    projectName: activeTimer.projectName,
    goalName: activeTimer.goalName,
  });
}

async function handleProjects(cmdId) {
  const names = availableNames('projects', 'name');
  await writeResult(cmdId, {
    success: true,
    message: names ? `Available projects: ${names}` : 'No projects found.',
  });
}

async function handleGoals(cmdId, cmd) {
  const project = cmd.project ? resolveProject(cmd.project) : null;
  const query = project ? { projectId: project.id } : {};
  const goals = listEntities('goals', query);
  const names = goals.map((g) => g.description).slice(0, 15).join(', ');
  await writeResult(cmdId, {
    success: true,
    message: names ? `Available goals: ${names}` : 'No goals found.',
  });
}

// ---------------------------------------------------------------------------
// Command router
// ---------------------------------------------------------------------------

async function handleCommand(cmdId, cmd) {
  if (!cmd || cmd.processed) return;

  if (cmd.timestamp && Date.now() - cmd.timestamp > STALE_COMMAND_MS) {
    await fbPatch(`discord-sync/commands/${cmdId}`, { processed: true });
    await writeResult(cmdId, { success: false, message: 'Command expired (too old).' });
    return;
  }

  await fbPatch(`discord-sync/commands/${cmdId}`, { processed: true });

  if (cmd.secret !== DISCORD_SYNC_SECRET) {
    await writeResult(cmdId, { success: false, message: 'Unauthorized.' });
    return;
  }

  switch (cmd.type) {
    case 'start':  await handleStart(cmdId, cmd); break;
    case 'stop':   await handleStop(cmdId); break;
    case 'status': await handleStatus(cmdId); break;
    case 'projects': await handleProjects(cmdId); break;
    case 'goals':  await handleGoals(cmdId, cmd); break;
    default:
      await writeResult(cmdId, { success: false, message: `Unknown command type: ${cmd.type}` });
  }
}

// ---------------------------------------------------------------------------
// Polling loop
// ---------------------------------------------------------------------------

async function syncTimerState() {
  try {
    const state = await fbGet('discord-sync/timer-state');
    if (!state) return;

    if (state.active && !activeTimer) {
      // Bot started a timer directly — adopt it
      activeTimer = {
        description: state.description || DEFAULT_TIMER_TITLE,
        projectId: state.projectId || null,
        projectName: state.projectName || null,
        goalId: state.goalId || null,
        goalName: state.goalName || null,
        startTime: state.startTime,
        sessionId: state.sessionId || `discord-adopted-${Date.now()}`,
        origin: state.origin || 'discord',
      };
      const elapsed = Math.round((Date.now() - activeTimer.startTime) / 1000);
      console.log(`[discord-sync] Adopted remote timer: "${activeTimer.description}" (${formatDuration(elapsed)} elapsed)`);
    } else if (!state.active && activeTimer) {
      // Bot stopped the timer directly — clear local state and sync entries
      console.log(`[discord-sync] Remote timer stopped: "${activeTimer.description}"`);
      activeTimer = null;
      await syncPendingEntries();
    }
  } catch (err) {
    console.error('[discord-sync] Timer state sync error:', err.message);
  }
}

async function pollCommands() {
  try {
    // Sync timer state from Firebase (handles bot direct writes)
    await syncTimerState();

    const commands = await fbGet(
      'discord-sync/commands'
    );

    if (!commands) return;

    for (const [cmdId, cmd] of Object.entries(commands)) {
      if (cmd && !cmd.processed) {
        await handleCommand(cmdId, cmd);
      }
    }
  } catch (err) {
    console.error('[discord-sync] Poll error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Startup & shutdown
// ---------------------------------------------------------------------------

async function startSync() {
  if (!isConfigured()) {
    console.log('[discord-sync] Not configured — skipping');
    return;
  }

  // Restore timer state from Firebase on startup
  try {
    const state = await fbGet('discord-sync/timer-state');
    if (state && state.active) {
      activeTimer = {
        description: state.description || DEFAULT_TIMER_TITLE,
        projectId: state.projectId || null,
        projectName: state.projectName || null,
        goalId: state.goalId || null,
        goalName: state.goalName || null,
        startTime: state.startTime,
        sessionId: state.sessionId || `discord-restored-${Date.now()}`,
        origin: state.origin || 'discord',
      };
      const elapsed = Math.round((Date.now() - activeTimer.startTime) / 1000);
      console.log(`[discord-sync] Restored active timer: "${activeTimer.description}" (${formatDuration(elapsed)} elapsed)`);
    }
  } catch (err) {
    console.error('[discord-sync] Failed to restore timer state:', err.message);
  }

  // Sync any entries created while server was offline
  await syncPendingEntries();

  // Sync projects & goals so bot can read them without the server
  await syncProjectsAndGoals();

  // Process any queued commands immediately
  await pollCommands();

  // Start polling for commands + timer state
  pollTimer = setInterval(pollCommands, POLL_INTERVAL_MS);

  // Periodic sync (pending entries + projects/goals to Firebase)
  syncTimer = setInterval(async () => {
    await syncPendingEntries();
    await syncProjectsAndGoals();
  }, SYNC_INTERVAL_MS);

  console.log('[discord-sync] Listening for Discord timer commands');
}

function stopSync() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Express routes (for browser UI)
// ---------------------------------------------------------------------------

function createRouter() {
  const express = require('express');
  const router = express.Router();

  // GET /api/discord-timer — browser polls this to show Discord timer in the UI
  router.get('/', (req, res) => {
    if (!activeTimer) {
      return res.json({ active: false });
    }
    const elapsed = Math.round((Date.now() - activeTimer.startTime) / 1000);
    res.json({
      active: true,
      description: activeTimer.description,
      projectId: activeTimer.projectId,
      projectName: activeTimer.projectName,
      goalId: activeTimer.goalId,
      goalName: activeTimer.goalName,
      startTime: activeTimer.startTime,
      sessionId: activeTimer.sessionId,
      elapsed,
    });
  });

  // POST /api/discord-timer/start — browser syncs its timer to Firebase (conflict prevention)
  router.post('/start', async (req, res) => {
    const { description, projectId, projectName, goalId, goalName, startTime, sessionId } = req.body;
    try {
      activeTimer = {
        description: description || DEFAULT_TIMER_TITLE,
        projectId: projectId || null,
        projectName: projectName || null,
        goalId: goalId || null,
        goalName: goalName || null,
        startTime: startTime || Date.now(),
        sessionId: sessionId || `browser-${Date.now()}`,
        origin: 'browser',
      };
      await updateTimerState({
        active: true,
        description: activeTimer.description,
        projectName: activeTimer.projectName,
        goalName: activeTimer.goalName,
        projectId: activeTimer.projectId,
        goalId: activeTimer.goalId,
        startTime: activeTimer.startTime,
        sessionId: activeTimer.sessionId,
        origin: 'browser',
      });
      res.json({ success: true });
    } catch (err) {
      console.error('[discord-sync] Failed to sync browser timer to Firebase:', err.message);
      res.json({ success: false });
    }
  });

  // POST /api/discord-timer/clear — clear Firebase timer state without creating an entry
  // Used by the browser when it stops its own timer (entry already saved to SQLite)
  router.post('/clear', async (req, res) => {
    activeTimer = null;
    try { await updateTimerState({ active: false }); } catch {}
    res.json({ success: true });
  });

  // POST /api/discord-timer/stop — stop the Discord timer from the browser
  router.post('/stop', async (req, res) => {
    if (!activeTimer) {
      return res.status(404).json({ error: 'No Discord timer running.' });
    }

    const now = Date.now();
    const durationSec = Math.round((now - activeTimer.startTime) / 1000);

    const entry = createEntity('timeEntries', {
      description: activeTimer.description,
      startTime: new Date(activeTimer.startTime).toISOString(),
      endTime: new Date(now).toISOString(),
      duration: durationSec,
      projectId: activeTimer.projectId,
      goalId: activeTimer.goalId,
      sessionId: activeTimer.sessionId,
    });

    if (activeTimer.goalId) {
      updateGoalProgress(activeTimer.goalId);
    }

    const msg = `Timer stopped: "${activeTimer.description}" | Duration: ${formatDuration(durationSec)}`;
    console.log(`[discord-sync] ${msg} (stopped from browser)`);

    try { await updateTimerState({ active: false }); } catch {}
    activeTimer = null;

    res.json({ success: true, message: msg, duration: durationSec, entryId: entry.id });
  });

  return router;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  isConfigured,
  startSync,
  stopSync,
  createRouter,
};
