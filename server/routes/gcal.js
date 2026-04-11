const express = require('express');
const {
  isConfigured,
  getSettings,
  upsertSettings,
  getAuthUrl,
  exchangeCode,
  getAuthClient,
  runSync,
  startPeriodicSync,
  stopPeriodicSync,
} = require('../gcal-sync');
const { google } = require('googleapis');

const router = express.Router();

// GET /api/gcal/status — connection status and sync info
router.get('/status', (req, res) => {
  const configured = isConfigured();
  const settings = getSettings();

  res.json({
    configured,
    connected: !!(settings && settings.enabled && settings.accessToken),
    calendarId: settings?.calendarId || 'primary',
    lastSyncAt: settings?.lastSyncAt || null,
    enabled: !!(settings && settings.enabled),
  });
});

// GET /api/gcal/auth-url — returns the Google OAuth consent URL
router.get('/auth-url', (req, res) => {
  if (!isConfigured()) {
    return res.status(400).json({
      error:
        'Google Calendar API credentials not configured. Set GCAL_CLIENT_ID and GCAL_CLIENT_SECRET in .env',
    });
  }

  const url = getAuthUrl();
  res.json({ url });
});

// GET /api/gcal/callback — OAuth callback handler
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?gcal=error&message=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/?gcal=error&message=No+authorization+code+received');
  }

  try {
    await exchangeCode(code);

    // Start periodic sync now that we're connected
    startPeriodicSync();

    // Redirect back to app planner page with success indicator
    res.redirect('/planner?gcal=connected');
  } catch (err) {
    console.error('[gcal] OAuth callback error:', err.message);
    res.redirect(
      '/?gcal=error&message=' + encodeURIComponent(err.message)
    );
  }
});

// POST /api/gcal/disconnect — clear tokens and disable sync
router.post('/disconnect', (req, res) => {
  stopPeriodicSync();
  upsertSettings({
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    syncToken: null,
    lastSyncAt: null,
    enabled: 0,
  });
  res.json({ disconnected: true });
});

// POST /api/gcal/sync — trigger an immediate sync
router.post('/sync', async (req, res) => {
  try {
    const result = await runSync();
    res.json(result);
  } catch (err) {
    console.error('[gcal] Manual sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/gcal/settings — update sync settings
router.patch('/settings', (req, res) => {
  const { calendarId } = req.body || {};
  const updates = {};

  if (calendarId !== undefined) {
    updates.calendarId = calendarId;
    // Reset syncToken when calendar changes so we do a full re-pull
    updates.syncToken = null;
  }

  if (Object.keys(updates).length > 0) {
    upsertSettings(updates);
  }

  const settings = getSettings();
  res.json({
    calendarId: settings?.calendarId || 'primary',
    lastSyncAt: settings?.lastSyncAt || null,
    enabled: !!(settings && settings.enabled),
  });
});

// GET /api/gcal/calendars — list available calendars for the user
router.get('/calendars', async (req, res) => {
  try {
    const auth = await getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const result = await calendar.calendarList.list();
    const calendars = (result.data.items || []).map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
    }));
    res.json(calendars);
  } catch (err) {
    console.error('[gcal] Failed to list calendars:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
