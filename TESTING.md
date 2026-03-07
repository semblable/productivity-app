# Testing Guide and Coverage Plan

This document summarizes the current testing setup, existing tests, the latest coverage snapshot, and a prioritized plan to expand coverage across unit, integration, and end-to-end (E2E) layers.

## Current setup

- Test runner: Create React App (CRA) `react-scripts test` (Jest + React Testing Library)
- Environment bootstrap: `src/setupTests.js`
  - `@testing-library/jest-dom`

  - Stable `crypto.randomUUID` polyfill
  - Basic `Notification` mock with permission granted by default
  - `matchMedia` and `scrollTo` no-ops

Commands
- Run all tests with coverage (non-watch):
  ```bash
  npm test -- --coverage --watchAll=false
  ```
- Recommended CI script (to add in package.json):
  ```json
  {
    "scripts": {
      "test:ci": "cross-env CI=true react-scripts test --coverage --watchAll=false"
    }
  }
  ```

## Current tests in repo

- App smoke test (with `AppRoutes` mocked)
  - `src/App.test.js`
- Utilities
  - `src/utils/__tests__/duration.test.js`
  - `src/utils/__tests__/folderDisplay.test.js`
  - `src/db/__tests__/id-utils.test.js`

What they cover
- `duration` parsing/formatting happy paths and invalid inputs
- `folderDisplay` hierarchical path rendering and sort order
- `id-utils` numeric vs cloud ID normalization and `idsEqual`
- App renders header and boots without importing heavy ESM modules during the test

## Coverage snapshot (latest)

Overall (from most recent run):
- Statements: 8.34%
- Branches: 4.03%
- Functions: 6.00%
- Lines: 8.65%

Highlights
- `src/utils`: ~85–90% covered (unit tests exist)
- Many components, hooks, and DB helpers have little or no coverage yet

Targets
- Milestone 1: 60% statements / 50% branches / 60% functions / 60% lines
- Milestone 2: 80% statements / 70% branches / 80% functions / 80% lines

## Test utilities (to add)

Create `src/test/test-utils.jsx` to standardize rendering with providers and easy DB reset:
```jsx
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import { api } from '../api/apiClient';

export async function resetMocks() {
  jest.clearAllMocks();
}

export function renderWithProviders(ui, { route = '/', wrapperProps = {} } = {}) {
  const Wrapper = ({ children }) => (
    <MemoryRouter initialEntries={[route]}>
      <AppProvider {...wrapperProps}>{children}</AppProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper });
}
```

## Mocking guidance

- Heavy/ESM-only libs (for example `react-markdown`, big calendar libs): mock per test to keep CRA/Jest transforms simple
  ```js
  jest.mock('react-markdown', () => (props) => <div>{props.children}</div>);
  ```
- Toasts: keep side effects visible without portals
  ```js
  jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() }, Toaster: () => null }));
  ```
- `RecurrenceModal`: provide a stub with an exposed `onSave('RRULE:...')` to drive flows

## Prioritized future tests

### 1) Unit tests (low effort, high impact)
- `src/db/time-entry-utils.js`
  - `logTimeToGoal`: increments hours, clamps progress, triggers Notification when crossing 100%
  - `logTimeToProjectGoals`: updates multiple goals; excludes `goalToExclude`
- `src/context/AppContext.js`
  - Initial state reads `activeTimer` from `localStorage`
  - Selection helpers: `addSelectedTask`, `removeSelectedTask`, `toggleTaskSelection`, `clearSelection`
- `src/hooks/useNotifications.js`
  - `scheduleNotification`/`cancelScheduledNotification` and prefix cancel
  - With fake timers, scan tasks/events within 15-minute window, set localStorage flags, and avoid duplicates

### 2) Component integration tests
- `src/components/AddTaskForm.jsx`
  - Validation (empty text)
  - Adds task with due date, project, goal, folder; habit path when recurrence is set (mock `RecurrenceModal`)
- `src/components/TodoView.jsx`
  - Search filter, project filter, folder filter, show/hide completed
  - Multi-select: Ctrl/Cmd+A selects visible; Escape clears
  - Grouping: by project then folder; root/child folder rendering
- `src/components/ProjectManager.jsx`
  - Add project (duplicate name error)
  - Add goal (validations, computed progress)
  - Edit project/goal
  - Delete project: cascades (tasks/events/folders/time entries) and cancels notifications (mock hooks)
- `src/components/AddEventModal.jsx`
  - Create event with preset recurrence; custom recurrence flow
  - Edit recurring: update one / following / all (rrule updates + instance deletes)
  - Delete recurring: one / following / all (cleanup time entries + cancel notifications)
  - Start tracking triggers scheduling of end notification and callback
- `src/components/TimeTracker.jsx`
  - Manual Log validates and saves; rolls up to project goals
  - Start/Stop timer creates time entry, rolls up to project goals, excludes active goal to avoid double count
  - Last used project read/write via localStorage
  - Auto-start from `initialEvent` when no active timer
- `src/AppRoutes.jsx`
  - Redirect `/` -> `/tracker` when `activeTimer` set; otherwise `/dashboard`

Notes
- Prefer API client mocks backed by test data arrays for realistic flows
- For DnD in `TodoView`, defer complex pointer interactions; instead assert API side effects (or cover via extracted utility in future refactor)

### 3) E2E tests (Playwright suggested)
- Flows
  - Create project -> add tasks with folder -> verify grouped rendering
  - Create recurring event -> see generated instances -> edit/delete one vs all
  - Start Pomodoro and ensure time auto-logs on stop (mock SW messages where needed)
  - Track time manually and via goal; goal progress bars update
  - Habit creation from recurring task and streak updates (basic)
- Data isolation: use a separate browser context/user data dir per test; clear API database between E2E tests

## Test data & lifecycle patterns

- Use `resetMocks()` before each test that hits the API client
- Seed helpers (to add): `seedProjects`, `seedTasks`, `seedEvents`, `seedGoals` returning created IDs
- Prefer deterministic timestamps (use fake timers or inject clocks) to avoid flakiness

## Milestones & acceptance criteria

- Milestone 1
  - Unit coverage for `time-entry-utils`, `AppContext`, and `useNotifications`
  - Basic integrations for `AddTaskForm`, `ProjectManager`, `TimeTracker`
  - Overall coverage >= 60% statements / 50% branches
- Milestone 2
  - Broader integrations for `AddEventModal` and `TodoView`
  - Start E2E for critical flows
  - Overall coverage >= 80% statements / 70% branches

## How to run

- Local: `npm test -- --coverage --watchAll=false`
- Optional CI: add `test:ci` script and run in your pipeline; upload `coverage/` as an artifact


