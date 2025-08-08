## Proposed Improvements (Prioritized)

This document lists recommended improvements beyond the critical fixes already applied.

### High Priority

- **Normalize IDs for cloud/local compatibility**
  - Use `normalizeId` / `normalizeNullableId` and `idsEqual` from `src/db/id-utils.js` instead of `Number(...)` casts in DB queries/updates.
  - Targets: `src/db/time-entry-utils.js`, `src/components/AddTaskForm.jsx`, `src/components/TaskItem.jsx`, `src/components/TimeTracker.jsx`, `src/components/TimeEntryItem.jsx`, DnD folder moves in `src/components/TodoView.jsx`.

- **Unify toast library**
  - Standardize on `react-hot-toast` (lighter/modern) and remove `react-toastify` usage/`ToastContainer`.
  - Update imports and call sites across components (`TaskItem`, `AddTaskForm`, `DataTools`, etc.).

- **Service Worker improvements**
  - Add `notificationclick` handler to focus/open the app.
  - Reduce verbose logging; guard `sendStatus` frequency (already checks diff) and ensure intervals are cleared.
  - Add offline caching (Workbox or minimal cache-first for app shell) to make PWA usable offline.

- **Replace Moment with date-fns localizer in calendar**
  - Remove `moment` dependency; use `date-fns` localizer for `react-big-calendar` to shrink bundle.

- **Route-level code splitting**
  - Lazy-load heavy routes (`DashboardView` with Chart.js, `CalendarView`, `NotesView`, `PomodoroView`) via `React.lazy`/`Suspense`.

- **Sanitize Markdown rendering**
  - Add `rehype-sanitize` to `NotesView` to prevent XSS from pasted content.

- **Centralize goal progress updates**
  - Ensure only `TimeTracker` updates time-based goals. Keep routes/components dumb; remove duplicates.

### Medium Priority

- **Improve DataTools UX**
  - Show progress UI during import/migrate (modal with steps).
  - Optionally move heavy import/migration to a Web Worker.
  - After import/migration, clear SW caches to prevent stale assets.

- **Notifications**
  - Debounce/check more keys to avoid duplicate notifications across tabs.
  - Add settings to configure lead time (default 15 minutes) and enable/disable categories.

- **Charts optimization**
  - Register only the Chart.js elements actually used; or switch to lighter alternatives for small charts.

### Low Priority / DX

- **Testing**
  - Add unit tests for `durationToSeconds` and `formatDuration`.
  - Add integration test for `TimeTracker` start/stop and time entry creation.

- **Linting/Formatting**
  - Add ESLint rules for hooks and imports; add Prettier config. Ensure CI checks.

- **Type Safety**
  - Gradual TypeScript adoption for DB models and key component props to catch ID/string/number mismatches early.

- **Build System**
  - Consider migrating from CRA to Vite for faster dev builds and smaller production bundles.
  - Add bundle analysis script.

### Security

- **AI API key handling**
  - Proxy Gemini API calls via a simple backend/serverless function to keep the key secret and enforce quotas.
  - Add rate-limiting and server-side response validation where possible.

### Nice-to-Have UX

- **Multi-select affordance**
  - Show a brief tip when enabling Multi-select in `TodoView` (ESC to cancel, Ctrl+A to select visible).

- **Templates view**
  - Provide a small admin view for recurring templates (tasks/events with `rrule` and no `templateId`).

- **Theme**
  - Wrap theme logic in a small `ThemeProvider` instead of custom event; keep `localStorage` persistence.

---

If you want, I can tackle these in small PRs starting with ID normalization and calendar/moment removal.


