const express = require('express');
const { exportAllData, importAllData, clearAllData } = require('../db');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/export', (_req, res) => {
  res.json(exportAllData());
});

router.post('/import', (req, res) => {
  try {
    const tableData = req.body?.tables || req.body?.tableData || {};
    const result = importAllData(tableData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

router.post('/migrate', (req, res) => {
  try {
    const tableData = req.body?.tables || req.body?.tableData || {};
    const result = importAllData(tableData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Migration failed' });
  }
});

router.post('/clear', (_req, res) => {
  clearAllData();
  res.json({ ok: true });
});

module.exports = router;
