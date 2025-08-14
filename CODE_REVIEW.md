## Codebase Review and Improvement Plan

### Scope
- Reviewed app shell and routing: `src/index.js`, `src/App.js`, `src/AppRoutes.jsx`
- Global state: `src/context/AppContext.js`
- Data layer and migrations: `src/db/db.js` (+ utils in `src/db/*`)
- Hooks and integrations: `src/hooks/*`, `src/api/geminiClient.js`
- Core features: to-do, projects/goals, calendar/events, time tracking, pomodoro, habits, notes (all files in `src/components/*`)
- Styling/build: Tailwind configs, `index.css`, CRA scripts, service worker

### Strengths
- Clear feature breadth with good separation by view (to-do, calendar, tracker, habits, notes)
- Offline-first IndexedDB model with forward-looking Dexie Cloud migration path
- Thoughtful UX touches (keyboard shortcuts, theme toggle, assistive toasts, datalist suggestions)
- Recurrence handling for tasks/events and robust time-tracking integration
- AI hooks isolated behind `api/geminiClient.js` and `hooks/useGeminiTaskify.js`

### Top priorities (P0)
1) Data model consistency and naming
   - Multiple references to goals via `db.goals` and `db.timeGoals` aliases. Consolidate to a single canonical table/API and remove aliasing once migration is complete.
   - Add typed accessors (or thin service layer) to shield components from table name differences (local vs cloud). Files: `src/db/db.js`, `ProjectManager.jsx`, `GoalsSummary.jsx`, `TimeTrackerView.jsx`.

2) Cloud/local ID mode hardening
   - `normalizeId` switches string/number based on `localStorage.cloudIdsMigrated`. Centralize comparisons with `idsEqual` and consistently normalize inputs at boundaries (form inputs, route params). Audit usages in: `AddTaskForm.jsx`, `folder-utils.js`, `time-entry-utils.js`, `TimeEntryItem.jsx`, `ProjectManager.jsx`.

3) Recurrence and instance integrity
   - Ensure consistent field usage across event objects: some code reads `eventData.start`/`end` while others read `startTime`/`endTime`. Standardize in `AddEventModal.jsx` and route handlers setting `modalEventData` in `App.js`.
   - Add an index strategy for `templateId`, `parentId`, and time fields to speed duplicates checks and between queries. Files: `src/db/db.js`, `AddEventModal.jsx`, `App.js` (handleRecurrence).

4) Time tracking double-count and lifecycle
   - The global Pomodoro-to-TimeEntry logging in `App.js` and local tracker logging can overlap. Guard against double-add with idempotent keys (e.g., timer session UUID) or a last-write check before insert. Files: `src/App.js`, `TimeTracker.jsx`.

5) Notifications architecture
   - `useNotifications` runs in-page timers and stores flags in `localStorage`. Consider moving scheduling/dedup to the service worker (where feasible) and making lead time configurable. Files: `src/hooks/useNotifications.js`, `public/service-worker.js`.

6) Performance under scale
   - `useLiveQuery(() => table.toArray())` appears frequently and will not scale. Prefer indexed queries, ranges, limits, and projection where possible (e.g., `where('completed').equals(0)`, `limit`, `offset`). Files: `TodoView.jsx`, `CalendarView.jsx`, `TimeEntryList.jsx`, `HabitsView.jsx`.

### High-impact improvements (P1)
- Replace Moment in `CalendarView.jsx` with the date-fns localizer to shrink bundle and reduce legacy dependency.
- Introduce a repository/service layer to abstract raw Dexie access and hide cloud/local table differences. This makes migrations and testing easier.
- Add small, focused tests: recurrence generation, duration parsing, habit streak logic, time-entry filtering by range. Files: `src/utils/duration.js`, `src/db/habit-utils.js`, `App.js` (handleRecurrence), `TimeEntryList.jsx`.
- Tighten deletion cascades: deleting a project currently removes events/tasks but may leave `timeEntries` with matching `projectId`. Ensure all associated time entries are deleted as well. File: `ProjectManager.jsx`.
- Create or seed a default project row instead of returning a synthetic object from `getDefaultProject()` to avoid dangling references.

### Quality/UX polish (P2)
- Accessibility: ensure all icon-only buttons have `aria-label` and keyboard handlers; many do, but some rely only on tooltips.
- Large DOM hit during drag-select in `TodoView.jsx`: throttled to ~60fps but still queries all task nodes per mousemove. Consider a stronger throttle, virtualization, or only computing intersections on animation frames.
- Consistent date handling: ensure all form inputs use localized formatting helpers to avoid timezone shifts; several helpers exist, unify them.
- Tailwind CSS: there are duplicate placeholder rules in `index.css` (L61–L75 repeat), consolidate to one.
- Hide unfinished routes (e.g., `GoalsView.jsx`) or implement the view to reduce dead ends in navigation.

## Area-by-area recommendations

### Data layer and migrations (`src/db/db.js`)
- Collapse goal naming: prefer `goals` everywhere; keep `timeGoals` alias only for compatibility, and plan a removal window.
- Add explicit indexes where hot paths exist:
  - `timeEntries`: `[projectId+startTime]`, `[goalId+startTime]` for fast per-project/goal range queries.
  - `events`: `[projectId+startTime]`, `templateId`, `parentId`.
  - `tasks`: `completed`, `[projectId+completed]`, `templateId`.
- Wrap `db` in a small repository module (e.g., `src/db/repository.js`) exporting typed functions. Components then call repository methods rather than raw tables.
- Seed a default project row during initial open if none exist; return real IDs instead of synthetic objects in `getDefaultProject()`.

### IDs and normalization (`src/db/id-utils.js`)
- Enforce `idsEqual(a, b)` everywhere IDs are compared (particularly where `string|number` types mix).
- Harden `normalizeId` to avoid `Number('123a') => NaN` cases; validate input and surface errors earlier.
- Provide form-level adapters that always pass normalized IDs into DB writes.

### Recurrence and events (`AddEventModal.jsx`, `App.js`)
- Normalize event data shape passed into the modal. Prefer `startTime`/`endTime` consistently; only convert to/from input-friendly strings at the form boundary.
- In instance editing/deleting for recurring events, extract shared rrule set logic to helpers and add unit tests. Validate that exdate handling uses the same instant (ms) comparison consistently (`start` vs `startTime`).
- Index `templateId` and verify duplicate-instance prevention for long rules (e.g., yearly) under DST.

### Time tracking (`TimeTracker.jsx`, `TimeEntryList.jsx`)
- Assign a session UUID to each timer start and store it on the resulting `timeEntries` row to prevent double-add from concurrent flows (Pomodoro auto-log + manual stop).
- Persist “last used project” safely: validate that the stored ID still exists; if not, fall back gracefully.
- For “All Time” view, paginate by date ranges or add “Load more” by months instead of a hard `limit` to keep queries index-friendly.

### Notifications (`useNotifications.js`, `public/service-worker.js`)
- Move due-soon logic into the SW if possible (note: SWs cannot rely on long `setTimeout` when inactive). If staying in-page, make lead time configurable and debounce notifications per task/event via the `tag` option.
- Provide a simple settings UI to enable/disable task vs event reminders and adjust lead time.
- Use `navigator.serviceWorker.getRegistration()` to show notifications via SW for better background delivery.

### Habits and goals (`habit-utils.js`, `TaskItem.jsx`)
- Unify freeze fields: both `streakFriezes` (legacy) and `streakFreezes` exist. Keep migration, but ensure writes always target the canonical `streakFreezes` and reads fall back only when needed.
- Recalculate task-based goal progress with debounced or transactional updates when many tasks toggle quickly.

### Calendar (`CalendarView.jsx`)
- Replace Moment localizer with date-fns localizer supported by `react-big-calendar` to reduce bundle size and unify date libs (you already use date-fns elsewhere).
- Build a light “project color” legend to aid readability.

### To‑Do, folders, DnD (`TodoView.jsx`, `SortableTaskList.jsx`, `FolderHeader.jsx`)
- Virtualize long lists (e.g., `react-virtualized`/`@tanstack/react-virtual`) to keep DOM small.
- Consider using a drag handle to reduce accidental drags and improve a11y.
- Extract multi-select drag box logic to a hook and reduce DOM queries; cache node rects on layout changes rather than computing each mousemove.

### Notes and AI (`NotesView.jsx`, `AIConvertButton.jsx`, `GenerateTasksModal.jsx`, `api/geminiClient.js`)
- Validate `REACT_APP_GEMINI_API_KEY` availability at feature entry points and provide a user-facing setup hint (README has it; surface in UI too).
- In `geminiClient`, when JSON parse fails, also try braces `{}` path if tasks may return objects; keep `safeJSONParse` robust and covered by tests.
- Consider server proxy for the Gemini API to hide API keys in production if you ever deploy beyond local.

### Build, DX, and testing
- Migrate from CRA to Vite for faster dev/build, smaller bundles, and modern SW support (optional but high ROI).
- Add Prettier and stricter ESLint rules (no-floating-promises, exhaustive-deps where appropriate). Add a lint script and CI gate.
- Add Vitest/Jest unit tests for:
  - `durationToSeconds` edge cases (e.g., `"1:2"`, `"00:60:00"`, negative values)
  - Recurrence instance creation over DST boundaries
  - Habit streak freeze award/spend logic
  - Time range filtering/pagination in `TimeEntryList`

## Quick wins checklist
- [ ] Fix duplicate placeholder rules in `src/index.css`
- [ ] Use `idsEqual()` everywhere IDs are compared; avoid raw `===` with mixed types
- [ ] Standardize event data fields in `AddEventModal.jsx` (`startTime`/`endTime` only)
- [ ] Delete project: also delete `timeEntries` with matching `projectId`
- [ ] Replace Moment with date-fns localizer in `CalendarView.jsx`
- [ ] Add `aria-label` to any remaining icon-only buttons
- [ ] Seed a real “Default Project” row on first run; stop returning synthetic default in `getDefaultProject()`
- [ ] Add an index for `timeEntries.[projectId+startTime]` and `events.templateId`
- [ ] Add basic unit tests for `durationToSeconds`, habit streaks, and recurrence

## Risks and migration notes
- Cloud migration: The aliasing to `*_cloud` tables via `cloudIdsMigrated` is powerful but risky. Encapsulate table access behind a repository so UI code never needs to know about physical table names. Provide a migration progress banner and a “rebuild indexes” step post-migration.
- Notifications: Browser SWs cannot reliably schedule far-future alarms. Keep the minute-interval polling as a fallback with careful deduping (use `tag` and persistent markers).
- Recurrence: Be mindful of timezone/DST when comparing instance times; always compare epoch millis and ensure `dtstart` reflects local-date intent for `datetime-local` inputs.

---

If you want, I can implement the P0 items in small PR-sized edits, starting with ID normalization, event data consistency, and project deletion cascades, then move on to performance and calendar localizer changes.


