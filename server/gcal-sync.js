const { google } = require('googleapis');
const {
  database,
  listEntities,
  getEntity,
  createEntity,
  updateEntity,
} = require('./db');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GCAL_CLIENT_ID = process.env.GCAL_CLIENT_ID || '';
const GCAL_CLIENT_SECRET = process.env.GCAL_CLIENT_SECRET || '';
const GCAL_REDIRECT_URI =
  process.env.GCAL_REDIRECT_URI || 'http://localhost:3001/api/gcal/callback';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// ---------------------------------------------------------------------------
// Helpers — gcal_settings singleton
// ---------------------------------------------------------------------------

function getSettings() {
  const row = database
    .prepare('SELECT * FROM gcal_settings WHERE id = 1')
    .get();
  return row || null;
}

function upsertSettings(fields) {
  const current = getSettings();
  if (!current) {
    // Insert with id = 1
    const cols = ['id', ...Object.keys(fields)];
    const vals = [1, ...Object.values(fields)];
    const placeholders = cols.map(() => '?').join(', ');
    database
      .prepare(
        `INSERT INTO gcal_settings (${cols.join(', ')}) VALUES (${placeholders})`
      )
      .run(...vals);
  } else {
    const entries = Object.entries(fields);
    if (entries.length === 0) return;
    const sets = entries.map(([k]) => `${k} = ?`).join(', ');
    const vals = entries.map(([, v]) => v);
    database
      .prepare(`UPDATE gcal_settings SET ${sets} WHERE id = 1`)
      .run(...vals);
  }
  return getSettings();
}

// ---------------------------------------------------------------------------
// OAuth2 client
// ---------------------------------------------------------------------------

function createOAuth2Client() {
  return new google.auth.OAuth2(
    GCAL_CLIENT_ID,
    GCAL_CLIENT_SECRET,
    GCAL_REDIRECT_URI
  );
}

function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

async function exchangeCode(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  upsertSettings({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    tokenExpiry: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
    enabled: 1,
  });
  return tokens;
}

/**
 * Returns an authenticated OAuth2 client. Auto-refreshes if the token is
 * expired or about to expire (within 5 min).
 */
async function getAuthClient() {
  const settings = getSettings();
  if (!settings || !settings.accessToken) {
    throw new Error('Google Calendar not connected');
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: settings.accessToken,
    refresh_token: settings.refreshToken,
    expiry_date: settings.tokenExpiry
      ? new Date(settings.tokenExpiry).getTime()
      : undefined,
  });

  // Proactively refresh if expiring soon
  const expiresAt = settings.tokenExpiry
    ? new Date(settings.tokenExpiry).getTime()
    : 0;
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() > expiresAt - fiveMinutes) {
    try {
      const { credentials } = await client.refreshAccessToken();
      upsertSettings({
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || settings.refreshToken,
        tokenExpiry: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
      });
      client.setCredentials(credentials);
    } catch (err) {
      console.error('[gcal-sync] Token refresh failed:', err.message);
      throw err;
    }
  }

  return client;
}

// ---------------------------------------------------------------------------
// Field mapping  local <-> Google Calendar
// ---------------------------------------------------------------------------

function localToGcalEvent(localEvent) {
  const gcalEvent = {
    summary: localEvent.title,
    start: {
      dateTime: new Date(localEvent.startTime).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: new Date(localEvent.endTime).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  if (localEvent.rrule) {
    // Google Calendar expects recurrence as an array of strings like
    // "RRULE:FREQ=DAILY;..." — our local rrule may or may not have the
    // "RRULE:" prefix. Ensure it does.
    const lines = localEvent.rrule
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith('DTSTART')); // Google API prohibits DTSTART in recurrence

    gcalEvent.recurrence = lines.map((line) => {
      if (
        line.startsWith('RRULE:') ||
        line.startsWith('EXRULE:') ||
        line.startsWith('RDATE:') ||
        line.startsWith('EXDATE:')
      ) {
        return line;
      }
      return `RRULE:${line}`;
    });
  }

  return gcalEvent;
}

function gcalEventToLocal(gcalEvent, defaultProjectId) {
  const start = gcalEvent.start?.dateTime || gcalEvent.start?.date;
  const end = gcalEvent.end?.dateTime || gcalEvent.end?.date;

  let rrule = null;
  if (gcalEvent.recurrence && gcalEvent.recurrence.length > 0) {
    // Join all recurrence lines. Our local system stores the rule as-is.
    rrule = gcalEvent.recurrence.join('\n');
  }

  return {
    title: gcalEvent.summary || '(No title)',
    startTime: start ? new Date(start).toISOString() : null,
    endTime: end ? new Date(end).toISOString() : null,
    rrule,
    gcalEventId: gcalEvent.id,
    lastModifiedAt: gcalEvent.updated
      ? new Date(gcalEvent.updated).toISOString()
      : new Date().toISOString(),
    projectId: defaultProjectId,
  };
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

/**
 * Ensure a "Google Calendar" project exists and return its id.
 */
function ensureGcalProject() {
  const projects = listEntities('projects');
  const existing = projects.find((p) => p.name === 'Google Calendar');
  if (existing) return existing.id;

  const created = createEntity('projects', {
    name: 'Google Calendar',
    color: '#4285F4', // Google blue
    createdAt: new Date().toISOString(),
  });
  return created.id;
}

/**
 * Pull changes from Google Calendar into the local database.
 * Uses incremental sync (syncToken) when available.
 */
async function pullFromGoogle(auth) {
  const settings = getSettings();
  const calendarId = settings?.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth });
  const projectId = ensureGcalProject();

  const params = {
    calendarId,
    singleEvents: false, // keep recurring events as-is
    maxResults: 250,
  };

  if (settings?.syncToken) {
    params.syncToken = settings.syncToken;
  } else {
    // First sync — only pull future events (last 30 days as buffer)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    params.timeMin = thirtyDaysAgo.toISOString();
  }

  let allItems = [];
  let nextPageToken = null;
  let newSyncToken = null;

  try {
    do {
      if (nextPageToken) params.pageToken = nextPageToken;

      const res = await calendar.events.list(params);
      const items = res.data.items || [];
      allItems = allItems.concat(items);
      nextPageToken = res.data.nextPageToken || null;
      newSyncToken = res.data.nextSyncToken || newSyncToken;
    } while (nextPageToken);
  } catch (err) {
    // If syncToken is invalid (410 Gone), do a full re-sync
    if (err.code === 410) {
      console.warn('[gcal-sync] Sync token expired, performing full re-sync');
      upsertSettings({ syncToken: null });
      return pullFromGoogle(auth);
    }
    throw err;
  }

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const gcalEvent of allItems) {
    // Skip cancelled events that we don't have locally
    const existingEvents = listEntities('events', {
      gcalEventId: gcalEvent.id,
    });
    const existing = existingEvents[0] || null;

    if (gcalEvent.status === 'cancelled') {
      if (existing) {
        database
          .prepare('DELETE FROM events WHERE id = ?')
          .run(existing.id);
        deleted++;
      }
      continue;
    }

    const localData = gcalEventToLocal(gcalEvent, projectId);

    if (existing) {
      // Conflict resolution: last-write-wins
      const googleUpdated = new Date(gcalEvent.updated).getTime();
      const localUpdated = existing.lastModifiedAt
        ? new Date(existing.lastModifiedAt).getTime()
        : 0;

      if (googleUpdated > localUpdated) {
        updateEntity('events', existing.id, localData);
        updated++;
      }
      // else: local version is newer, skip (will be pushed later)
    } else {
      createEntity('events', localData);
      created++;
    }
  }

  // Store the new sync token
  if (newSyncToken) {
    upsertSettings({ syncToken: newSyncToken });
  }

  return { created, updated, deleted };
}

/**
 * Push local changes to Google Calendar.
 * Finds events modified since lastSyncAt that either:
 * - Have no gcalEventId (new events to create on Google)
 * - Have a gcalEventId and were modified locally (update on Google)
 */
async function pushToGoogle(auth) {
  const settings = getSettings();
  const calendarId = settings?.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth });
  const lastSync = settings?.lastSyncAt || '1970-01-01T00:00:00.000Z';

  // Get all local events (we'll filter in JS since SQLite doesn't have
  // great date comparison on TEXT columns in all cases)
  const allEvents = listEntities('events');

  let created = 0;
  let updated = 0;

  for (const event of allEvents) {
    // Skip child instances of recurring events (templateId / parentId set)
    if (event.templateId || event.parentId) continue;

    // Skip events that were originally pulled from Google and not modified locally
    const modifiedAt = event.lastModifiedAt
      ? new Date(event.lastModifiedAt).getTime()
      : 0;
    const lastSyncTime = new Date(lastSync).getTime();

    if (event.gcalEventId) {
      // Existing on Google — only push if modified locally since last sync
      if (modifiedAt > lastSyncTime) {
        try {
          const gcalEvent = localToGcalEvent(event);
          await calendar.events.update({
            calendarId,
            eventId: event.gcalEventId,
            requestBody: gcalEvent,
          });
          updated++;
        } catch (err) {
          if (err.code === 404) {
            // Event was deleted on Google — re-create
            try {
              const gcalEvent = localToGcalEvent(event);
              const res = await calendar.events.insert({
                calendarId,
                requestBody: gcalEvent,
              });
              updateEntity('events', event.id, {
                gcalEventId: res.data.id,
                lastModifiedAt: new Date().toISOString(),
              });
              created++;
            } catch (innerErr) {
              console.error(
                '[gcal-sync] Failed to re-create event on Google:',
                innerErr.message
              );
            }
          } else {
            console.error(
              '[gcal-sync] Failed to update event on Google:',
              err.message
            );
          }
        }
      }
    } else {
      // New local event — create on Google
      // Only push events that have valid start/end times
      if (!event.startTime || !event.endTime) continue;

      try {
        const gcalEvent = localToGcalEvent(event);
        const res = await calendar.events.insert({
          calendarId,
          requestBody: gcalEvent,
        });
        updateEntity('events', event.id, {
          gcalEventId: res.data.id,
          lastModifiedAt: new Date().toISOString(),
        });
        created++;
      } catch (err) {
        console.error(
          '[gcal-sync] Failed to create event on Google:',
          err.message
        );
      }
    }
  }

  return { created, updated };
}

/**
 * Run a full sync cycle: pull from Google then push local changes.
 */
async function runSync() {
  const settings = getSettings();
  if (!settings || !settings.enabled || !settings.accessToken) {
    return { skipped: true, reason: 'Not connected or disabled' };
  }

  console.log('[gcal-sync] Starting sync...');
  const startTime = Date.now();

  try {
    const auth = await getAuthClient();
    const pullResult = await pullFromGoogle(auth);
    const pushResult = await pushToGoogle(auth);

    upsertSettings({ lastSyncAt: new Date().toISOString() });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[gcal-sync] Sync completed in ${duration}s — ` +
        `Pulled: +${pullResult.created}/~${pullResult.updated}/-${pullResult.deleted} | ` +
        `Pushed: +${pushResult.created}/~${pushResult.updated}`
    );

    return {
      success: true,
      pull: pullResult,
      push: pushResult,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    console.error('[gcal-sync] Sync failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Periodic sync
// ---------------------------------------------------------------------------

let syncInterval = null;

function startPeriodicSync(intervalMs = 60 * 1000) {
  stopPeriodicSync();
  const settings = getSettings();
  if (!settings || !settings.enabled || !settings.accessToken) {
    console.log('[gcal-sync] Periodic sync not started — not connected');
    return;
  }

  console.log(
    `[gcal-sync] Starting periodic sync every ${intervalMs / 1000}s`
  );

  // Run once immediately, then on interval
  runSync().catch((err) =>
    console.error('[gcal-sync] Initial sync error:', err.message)
  );

  syncInterval = setInterval(() => {
    runSync().catch((err) =>
      console.error('[gcal-sync] Periodic sync error:', err.message)
    );
  }, intervalMs);
}

function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function isConfigured() {
  return !!(GCAL_CLIENT_ID && GCAL_CLIENT_SECRET);
}

module.exports = {
  isConfigured,
  getSettings,
  upsertSettings,
  getAuthUrl,
  exchangeCode,
  getAuthClient,
  runSync,
  startPeriodicSync,
  stopPeriodicSync,
  ensureGcalProject,
};
