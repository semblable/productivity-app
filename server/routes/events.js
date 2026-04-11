const express = require('express');
const { createEntityRouter } = require('./createEntityRouter');
const { getEntity } = require('../db');
const { google } = require('googleapis');
const { getAuthClient, getSettings } = require('../gcal-sync');

const router = express.Router();

// Intercept DELETE to remove from Google Calendar before we erase it locally
router.delete('/:id', async (req, res, next) => {
  const event = getEntity('events', req.params.id);
  
  if (event && event.gcalEventId) {
    try {
      const auth = await getAuthClient();
      const calendar = google.calendar({ version: 'v3', auth });
      const settings = getSettings();
      
      await calendar.events.delete({
        calendarId: settings?.calendarId || 'primary',
        eventId: event.gcalEventId,
      });
      console.log(`[gcal-sync] Intentionally deleted event ${event.gcalEventId} from Google Calendar`);
    } catch (err) {
      // 404 means it's already gone on Google, which is fine.
      if (err.code !== 404) {
        console.error('[gcal-sync] Failed to delete event on Google:', err.message);
      }
    }
  }
  next();
});

router.delete('/', async (req, res, next) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  
  for (const id of ids) {
    const event = getEntity('events', id);
    if (event && event.gcalEventId) {
      try {
        const auth = await getAuthClient();
        const calendar = google.calendar({ version: 'v3', auth });
        const settings = getSettings();
        
        await calendar.events.delete({
          calendarId: settings?.calendarId || 'primary',
          eventId: event.gcalEventId,
        });
        console.log(`[gcal-sync] Intentionally bulk-deleted event ${event.gcalEventId} from Google Calendar`);
      } catch (err) {
        if (err.code !== 404) {
          console.error(`[gcal-sync] Failed to bulk-delete event ${event.gcalEventId} on Google:`, err.message);
        }
      }
    }
  }
  next();
});

// Mount the generic CRUD router for all other operations (and the actual local delete)
router.use('/', createEntityRouter('events'));

module.exports = router;
