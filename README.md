# Productivity App

## Description
Personal productivity application for task management, goal tracking, and time optimization. Combines calendar scheduling, pomodoro technique, note-taking, and project management in a single offline-capable interface.

## Features
- **Dashboard**: Overview of tasks, events, and productivity metrics
- **Calendar Integration**: Schedule and manage events with daily/weekly views
- **Pomodoro Timer**: Focus sessions with configurable work/break intervals
- **Task Management**: Create, prioritize, and track todo items
- **Project Organization**: Group tasks into projects with progress tracking
- **Task Folders**:
  - Create folders within projects to group related tasks.
  - Drag-and-drop tasks to move them between folders or to reorder them.
  - Folders display progress bars and completion counts.
  - Delete folders with an option to either delete the tasks within them or move them to "Ungrouped."
- **Time Tracking**: Log and categorize time spent on activities
- **Notes System**: Markdown-enabled note taking with categorization
- **Weekly Reviews**: Reflection and planning tools
- **Dark/Light Mode**: Theme toggle for preferred viewing
- **Offline Support**: Local data persistence using IndexedDB
- **Notifications**: Browser alerts for timers and reminders

## Installation
1. Clone the repository:
```bash
git clone https://github.com/semblable/productivity-app.git
```
2. Navigate to project directory:
```bash
cd productivity-app
```
3. Install dependencies:
```bash
npm install
```
4. Start development server:
```bash
npm start
```

## Usage
### Basic Workflow
1. **Dashboard**: Landing page showing upcoming tasks and calendar events
2. **Tasks**:
   - Add new tasks with due dates/priorities
   - Organize tasks into projects
   - Mark tasks as complete
3. **Calendar**:
   - Switch between day/week/month views
   - Drag-and-drop event scheduling
4. **Focus Mode**:
   - Start pomodoro timer (25min work / 5min break)
   - Track completed focus sessions
5. **Time Tracking**:
   - Manually log time entries
   - Associate time with projects/tasks
6. **Notes**:
   - Create markdown-formatted notes
   - Organize with tags/projects

## Technology Stack
- **Frontend**: React 18
- **Styling**: Tailwind CSS
- **Local Database**: Dexie.js (IndexedDB)
- **Routing**: React Router
- **State Management**: React Context
- **Icons**: SVG-based custom components
- **Notifications**: Web Notifications API
- **Build Tools**: Create React App (react-scripts) + PostCSS

## Refactoring
- **Routing**: The routing logic has been extracted from the main `App` component into a dedicated `AppRoutes.jsx` component for better separation of concerns.
- **State Management**: Global application state is now managed with React Context, eliminating prop drilling and improving data flow predictability.
- **Component Decomposition**: The main `App` component has been refactored to be a simple container for the `AppLayout` and `AppProvider`, with the `AppLayout` handling the main page structure and the `AppProvider` managing the application state.

## Future Roadmap
- [ ] Mobile application (React Native)
- [ ] Cross-device sync via cloud service
- [x] Pomodoro timer with configurable intervals and notifications
- [ ] Time tracking reports and exports
- [ ] Integration with external calendars (Google Calendar, Outlook)
- [ ] Habit tracking system
- [ ] Customizable dashboard widgets
