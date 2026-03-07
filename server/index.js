const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

require('./db');

const adminRouter = require('./routes/admin');
const projectsRouter = require('./routes/projects');
const tasksRouter = require('./routes/tasks');
const goalsRouter = require('./routes/goals');
const timeEntriesRouter = require('./routes/timeEntries');
const eventsRouter = require('./routes/events');
const notesRouter = require('./routes/notes');
const foldersRouter = require('./routes/folders');
const habitsRouter = require('./routes/habits');
const habitCompletionsRouter = require('./routes/habit_completions');
const ivyLeeRouter = require('./routes/ivyLee');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', adminRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/timeEntries', timeEntriesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/habit_completions', habitCompletionsRouter);
app.use('/api/ivyLee', ivyLeeRouter);

const buildDir = path.join(__dirname, '..', 'build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
      res.sendFile(path.join(buildDir, 'index.html'));
    } else {
      next();
    }
  });
}

app.listen(PORT, () => {
  console.log(`SQLite API listening on http://localhost:${PORT}`);
});
