const express = require('express');
const {
  listEntities,
  getEntity,
  createEntity,
  bulkCreateEntities,
  updateEntity,
  deleteEntity,
  bulkDeleteEntities,
} = require('../db');

function createEntityRouter(entityName) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(listEntities(entityName, req.query));
  });

  router.get('/:id', (req, res) => {
    const entity = getEntity(entityName, req.params.id);
    if (!entity) {
      res.status(404).json({ error: `${entityName} entry not found` });
      return;
    }
    res.json(entity);
  });

  router.post('/', (req, res) => {
    const entity = createEntity(entityName, req.body || {});
    res.status(201).json(entity);
  });

  router.post('/bulk', (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const created = bulkCreateEntities(entityName, rows);
    res.status(201).json(created);
  });

  router.put('/:id', (req, res) => {
    const entity = updateEntity(entityName, req.params.id, req.body || {});
    res.json(entity);
  });

  router.patch('/:id', (req, res) => {
    const entity = updateEntity(entityName, req.params.id, req.body || {});
    res.json(entity);
  });

  router.delete('/:id', (req, res) => {
    deleteEntity(entityName, req.params.id);
    res.status(204).end();
  });

  router.delete('/', (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const result = bulkDeleteEntities(entityName, ids);
    res.json({ deleted: result.changes || 0 });
  });

  return router;
}

module.exports = { createEntityRouter };
