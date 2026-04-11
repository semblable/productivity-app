# My Local Planner

Local-first productivity app for tasks, calendar, habits, time tracking, notes, and weekly reviews. Powered by a local SQLite database provided by the companion NodeJS backend, with optional Gemini-powered task generation.

## Features
- Tasks with projects and nested folders (drag-and-drop ordering)
- Calendar with recurring events and event tracking
- Pomodoro focus timer with notifications (service worker)
- Time tracking with task/project association
- Markdown notes with preview and AI task generation (optional)
- Habits with streaks and heatmap view
- Weekly review checklist
- Light/Dark theme
- Local persistence (SQLite via REST API)

## Setup
1) Install dependencies
```bash
npm install
```
2) (Optional) Create a `.env` file at the project root and add any of the following:
```ini
# Gemini task generation (optional)
REACT_APP_GEMINI_API_KEY=your_api_key_here
```
3) Start the app in development mode
```bash
npm start
```
This will start both the backend server and frontend client concurrently.

4) Start the app in production mode
```bash
npm run build
npm run start:prod
```
## Start on Windows startup (optional)

If you want the app to launch automatically when you log in to Windows:

1) Build the production bundle once
```bash
npm run build
```
2) Register startup entry
```bash
npm run startup:install
```
3) Remove it anytime
```bash
npm run startup:remove
```

The startup entry launches the built app from `build` on port `4173` and opens your browser to `/dashboard`.

Optional features:

- “⚡ Generate Tasks” in Notes appears when `REACT_APP_GEMINI_API_KEY` is set

## Troubleshooting

If you encounter a `504 Gateway Timeout` error or data fails to load after starting the app, there may be a Node.js version mismatch with the SQLite dependency. To fix this, stop the app and rebuild the dependency:

```bash
npm rebuild better-sqlite3
```
Then start the app again.

## License
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
