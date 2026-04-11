const express = require('express');
const { createEntityRouter } = require('./createEntityRouter');
const { getEntity, listEntities, updateEntity } = require('../db');

const router = express.Router();

router.post('/:id/recalculate', (req, res) => {
  const goalId = req.params.id;
  const goal = getEntity('goals', goalId);

  if (!goal) {
    res.status(404).json({ error: 'goals entry not found' });
    return;
  }

  const entries = listEntities('timeEntries', { goalId });
  const totalSeconds = entries.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
  const actualHours = totalSeconds / 3600;
  const progress = goal.targetHours > 0
    ? Math.min(100, Math.round((actualHours / goal.targetHours) * 100))
    : 0;

  res.json(updateEntity('goals', goalId, { actualHours, progress }));
});

router.use('/', createEntityRouter('goals'));

module.exports = router;
