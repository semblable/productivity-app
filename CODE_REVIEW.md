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
1) Data model consistency and naming — COMPLETED
   - Consolidated goals: replaced all `db.timeGoals` usages with `db.goals` and removed the legacy aliasing in `src/db/db.js`.
   - Added a thin repository for goals at `src/db/goals-repository.js` with hooks and typed accessors. Updated `ProjectManager.jsx`, `GoalsSummary.jsx`, `AddEventModal.jsx`, `TimeTracker.jsx`, and `App.js` to use the canonical API.
   - Next step (optional): expand the repository pattern to other entities (projects, tasks, events, timeEntries) to fully shield cloud/local table differences.

2) Cloud/local ID mode hardening — COMPLETED
   - Hardened `normalizeId` to validate numeric inputs in local mode and return null for invalid values; added early warning.
   - Replaced client-side String() equality with DB-side normalized queries where applicable; added `idsEqual`-style comparisons where mapping is needed.
   - Audited and updated usages in: `AddTaskForm.jsx` (folders query), `folder-utils.js` (recursive queries and cascades), `TimeEntryItem.jsx` (saves already normalized), `ProjectManager.jsx` (cascades for tasks/events/folders), `TodoView.jsx` (folders query and comparisons), `GoalsSummary.jsx` (map lookups), `FolderHeader.jsx` (folder tasks query), `GenerateTasksModal.jsx` (folders query), and kept `time-entry-utils.js` using `normalizeId`/`idsEqual`.

3) Recurrence and instance integrity — COMPLETED
   - Standardized event fields to `startTime`/`endTime` throughout modal usage and calendar route handlers: `AddEventModal.jsx` now reads/writes only `startTime`/`endTime`, and `App.js` passes `modalEventData` with these fields for slot/event selections.
   - Added efficient indexes for recurrence and range queries: `events` and `events_cloud` now include `[projectId+startTime]`, `[templateId+startTime]`, and `[parentId+startTime]` (Dexie v28). Updated duplicate-instance checks in `App.js` to use `[templateId+startTime]` and adjusted deletion/split paths in `AddEventModal.jsx` to use `[parentId+startTime]` and range scans.

4) Time tracking double-count and lifecycle — COMPLETED
   - Implemented idempotent session handling without DB schema changes.
   - On timer start (Pomodoro and manual), generate a sessionId (UUID fallback to time+random) and keep it on the in-memory `activeTimer`.
   - On stop/auto-log, dedupe before insert using:
     - a localStorage guard `timeEntryLogged:<sessionId>`; and
     - a soft match on `startTime` + `duration` + `description` + `projectId` + `goalId` + `taskId`.
   - Only one flow writes the entry and rolls up to projects/goals; the other path becomes a no-op with an informational toast.
   - Files: `src/App.js`, `src/components/TimeTracker.jsx`.

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
- [Done] Collapse goal naming: prefer `goals` everywhere; removed the `timeGoals` compatibility alias after updating all usages.
- Add explicit indexes where hot paths exist:
  - `timeEntries`: `[projectId+startTime]`, `[goalId+startTime]` for fast per-project/goal range queries.
  - `events`: `[projectId+startTime]`, `templateId`, `parentId`.
  - `tasks`: `completed`, `[projectId+completed]`, `templateId`.
- Wrap `db` in a small repository module (e.g., `src/db/repository.js`) exporting typed functions. Components then call repository methods rather than raw tables. (Partially done for goals via `src/db/goals-repository.js`; consider expanding to other tables.)
- Seed a default project row during initial open if none exist; return real IDs instead of synthetic objects in `getDefaultProject()`.

### IDs and normalization (`src/db/id-utils.js`)
- Enforce `idsEqual(a, b)` everywhere IDs are compared (particularly where `string|number` types mix).
- Harden `normalizeId` to avoid `Number('123a') => NaN` cases; validate input and surface errors earlier.
- Provide form-level adapters that always pass normalized IDs into DB writes.

### Recurrence and events (`AddEventModal.jsx`, `App.js`)
- [Done] Normalize event data shape passed into the modal. Prefer `startTime`/`endTime` consistently; only convert to/from input-friendly strings at the form boundary.
- [Done] Use compound indexes for instance lookups and range ops; exdate handling now consistently uses `startTime` in ms.
- Next: add unit tests for recurrence generation and DST boundaries.

### Time tracking (`TimeTracker.jsx`, `TimeEntryList.jsx`)
- [Done] Generate a sessionId on timer start and use a localStorage guard + soft dedupe before insert to prevent double-add between Pomodoro auto-log and manual stop. No DB schema changes.
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
- [x] Consolidate `db.timeGoals` to `db.goals`; add `src/db/goals-repository.js` and remove alias in `src/db/db.js`
- [ ] Fix duplicate placeholder rules in `src/index.css`
- [ ] Use `idsEqual()` everywhere IDs are compared; avoid raw `===` with mixed types
- [x] Standardize event data fields in `AddEventModal.jsx` (`startTime`/`endTime` only)
- [ ] Delete project: also delete `timeEntries` with matching `projectId`
- [ ] Replace Moment with date-fns localizer in `CalendarView.jsx`
- [ ] Add `aria-label` to any remaining icon-only buttons
- [ ] Seed a real “Default Project” row on first run; stop returning synthetic default in `getDefaultProject()`
- [ ] Add an index for `timeEntries.[projectId+startTime]`
- [x] Add indexes for `events.[projectId+startTime]`, `events.[templateId+startTime]`, and `events.[parentId+startTime]`
- [ ] Add basic unit tests for `durationToSeconds`, habit streaks, and recurrence

## Risks and migration notes
- Cloud migration: The aliasing to `*_cloud` tables via `cloudIdsMigrated` is powerful but risky. Encapsulate table access behind a repository so UI code never needs to know about physical table names. Provide a migration progress banner and a “rebuild indexes” step post-migration.
- Notifications: Browser SWs cannot reliably schedule far-future alarms. Keep the minute-interval polling as a fallback with careful deduping (use `tag` and persistent markers).
- Recurrence: Be mindful of timezone/DST when comparing instance times; always compare epoch millis and ensure `dtstart` reflects local-date intent for `datetime-local` inputs.

---

If you want, I can implement the P0 items in small PR-sized edits, starting with ID normalization, event data consistency, and project deletion cascades, then move on to performance and calendar localizer changes.


