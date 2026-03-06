# Codebase Problems Inventory

Date: 2026-03-01

## Priority 0 (P0)

- Pomodoro target resolution does not normalize IDs in local mode.
  - `src/App.js` reads `pomodoroSelectedTarget` and uses string IDs directly in `db.goals.get`, `db.projects.get`, `db.tasks.get` (`src/App.js:109`).
  - `PomodoroView` options use string IDs in select values (`src/components/PomodoroView.jsx:248-255`).
  - In local mode (numeric PKs), `db.get("1")` may fail because it expects `1`, so selected targets can resolve to `null`.

## Priority 1 (P1)

- Multi-select drag rectangle parsing breaks in cloud mode.
  - Task DOM IDs are parsed with `parseInt` in `TodoView` (`src/components/TodoView.jsx:127`), assuming numeric IDs.
  - Cloud mode uses string IDs, so dragged multi-select never selects UUID-backed tasks (`src/components/TaskItem.jsx:200`, `src/components/TodoView.jsx:127-133`).

- Task reorder logic mixes string/numeric IDs.
  - `TodoView` finds target task by string comparison, then does strict equality with a string over ID for index lookup (`src/components/TodoView.jsx:276`, `src/components/TodoView.jsx:284`).
  - In numeric ID mode this can fail, producing incorrect reorder behavior.

- Project deletion does not cascade all project-scoped time entries.
  - `ProjectManager.deleteProject()` deletes project tasks/events/goals/folders and removes event-linked time entries, but does not delete `timeEntries` directly tied to `projectId` without `eventId` (`src/components/ProjectManager.jsx:223-252`).
  - Orphaned time entries remain after project deletion.

## Priority 2 (P2)

- Synthetic default project object can create dangling references.
  - `getDefaultProject()` returns `{ id: 1, name: 'Default Project', color: '#CCCCCC' }` when no project exists (`src/db/db.js:214-220`).
  - Timer flows then select this synthetic ID even if no persistent row exists (`src/components/TimeTracker.jsx:30-33`, `src/components/TimeTracker.jsx:108-110`).

- Calendar still depends on Moment localizer.
  - `CalendarView` imports `moment` and `momentLocalizer` (`src/components/CalendarView.jsx:1-2`).
  - This adds unnecessary legacy dependency and larger bundle surface compared to date-fns-based localizers.

- Duplicate placeholder CSS rule definitions.
  - `input::placeholder, textarea::placeholder` is declared twice in `src/index.css` (`src/index.css:66-75`).
  - The first declaration is immediately overridden.

- Icon-only buttons without explicit labels in several components.
  - Buttons in `FolderHeader`, `ProjectManager`, and `TaskItem` rely only on icon content, with no `aria-label`.
  - Examples: `src/components/FolderHeader.jsx:55-77`, `src/components/ProjectManager.jsx:447-451`, `src/components/TaskItem.jsx:340-361`.

## Additional observations

- `src/db/time-entry-utils.js` and `src/components/TimeEntryItem.jsx` already attempt to normalize IDs in key update paths and may need alignment with broader ID normalization consistency work.

## Actionable fixes

### 1) Normalize Pomodoro selection IDs (P0)
- Owner: Core app/runtime owner
- Files:
  - `src/App.js`
  - `src/components/PomodoroView.jsx`
  - (optional helper) `src/db/id-utils.js`
- What to change:
  - Parse `pomodoroSelectedTarget` IDs through `normalizeId` or `idsEqual`-safe matching before any `get` calls.
  - Keep target ID values string-safe in storage, but hydrate to DB key type per mode.
- Effort: Small (quick, single-file code change in `App.js` with optional guard helper).
- Verification:
  - In local mode, selecting a goal/project/task in Pomodoro logs time against the correct entity.
  - In cloud mode, selected UUID targets still resolve correctly.

### 2) Fix cloud/legacy-safe multi-select and reorder IDs (P1)
- Owner: Frontend interaction owner
- Files:
  - `src/components/TodoView.jsx`
  - `src/components/TaskItem.jsx`
- What to change:
  - Replace `parseInt(...)` task-id parsing in drag-select with string-safe ID handling.
  - Use a shared normalized ID strategy when comparing IDs in drag/drop reorder (`String`-normalize both sides or `idsEqual` helper).
- Effort: Small (targeted edits in `TodoView.jsx`).
- Verification:
  - Drag-selection works for UUID-backed tasks.
  - Drag reorder remains correct in numeric mode.

### 3) Complete project deletion cascade for time entries (P1)
- Owner: Data integrity owner
- Files:
  - `src/components/ProjectManager.jsx`
  - (if needed) `src/db/time-entry-utils.js` consistency helpers
- What to change:
  - On project deletion, additionally delete `timeEntries` where `projectId` equals deleted project id.
  - Keep current event-linked cleanup logic intact.
- Effort: Small.
- Verification:
  - After deleting a project, no orphaned time entries remain for that project.

### 4) Seed and persist a real default project (P2)
- Owner: Data model owner
- Files:
  - `src/db/db.js`
  - `src/components/TimeTracker.jsx` (cleanup fallback assumptions)
- What to change:
  - Replace synthetic default object fallback with creation/read of a persisted "Default Project" row.
  - Prefer using that stored row ID in all fallback paths.
- Effort: Medium (migration-safe initialization path + tests/validation behavior).
- Verification:
  - No timer entry writes to non-existent project IDs on fresh install.

### 5) Calendar modernization and cleanup (P2)
- Owner: UI/perf owner
- Files:
  - `src/components/CalendarView.jsx`
  - `package.json` (if dependencies are updated)
- What to change:
  - Replace `momentLocalizer` with a date-fns-based localizer variant supported by `react-big-calendar`.
  - Remove `moment` dependency if no longer needed.
- Effort: Medium.
- Verification:
  - Calendar renders unchanged functionally with reduced date dependency footprint.

### 6) Accessibility labels for icon-only controls (P2)
- Owner: Accessibility owner
- Files:
  - `src/components/FolderHeader.jsx`
  - `src/components/ProjectManager.jsx`
  - `src/components/TaskItem.jsx`
  - (and any remaining icon-only buttons found by scan)
- What to change:
  - Add descriptive `aria-label` and/or visible text to all icon-only action buttons.
  - Keep existing visual design, add only accessibility annotations.
- Effort: Small to medium (depends on sweep breadth).
- Verification:
  - Screen-reader users can identify action intent from button labels.

### 7) Style simplification (P2)
- Owner: UI/stylesheet owner
- Files:
  - `src/index.css`
- What to change:
  - Keep one canonical `input::placeholder, textarea::placeholder` rule and remove duplicated block.
  - Standardize token usage to one approach (`hsl(var(...))`).
- Effort: Very small.
- Verification:
  - Placeholder contrast/opacity unchanged from intended design.


