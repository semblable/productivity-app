import React, { useState, useEffect } from 'react';
import { X, Book, Target, Calendar, Clock, CheckSquare, Brain, Zap, BarChart3, FileText, Repeat, Settings, Keyboard, Plus, Sparkles } from 'lucide-react';

const UserGuide = ({ isOpen, onClose }) => {
    const [activeSection, setActiveSection] = useState('overview');
    const [searchTerm, setSearchTerm] = useState('');

    const sections = [
        { id: 'overview', title: 'Getting Started', icon: Book },
        { id: 'dashboard', title: 'Dashboard', icon: BarChart3 },
        { id: 'todo', title: 'To-Do Lists', icon: CheckSquare },
        { id: 'focus', title: 'Today\'s Focus (Ivy Lee)', icon: Target },
        { id: 'habits', title: 'Habit Tracking', icon: Repeat },
        { id: 'time', title: 'Time Management', icon: Clock },
        { id: 'calendar', title: 'Calendar & Planning', icon: Calendar },
        { id: 'notes', title: 'Notes', icon: FileText },
        { id: 'ai', title: 'AI Features', icon: Brain },
        { id: 'goals', title: 'Goals & Targets', icon: Target },
        { id: 'projects', title: 'Project Management', icon: Settings },
        { id: 'shortcuts', title: 'Keyboard Shortcuts', icon: Keyboard },
    ];

    const features = {
        overview: {
            title: 'Welcome to Productivity Hub',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Productivity Hub is your all-in-one productivity companion designed to help you manage tasks, 
                        track habits, focus on important work, and analyze your productivity patterns.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Quick Start Tips:</h4>
                        <ul className="space-y-1 text-blue-800 dark:text-blue-200 text-sm">
                            <li>• Start by creating a project in the sidebar</li>
                            <li>• Add some tasks to your to-do list</li>
                            <li>• Set up habits you want to track</li>
                            <li>• Use the Ivy Lee method for daily focus</li>
                            <li>• Track your time to understand productivity patterns</li>
                        </ul>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="border border-border p-4 rounded-lg">
                            <Zap className="h-6 w-6 text-yellow-500 mb-2" />
                            <h4 className="font-semibold mb-1">Notifications</h4>
                            <p className="text-sm text-muted-foreground">
                                Enable notifications in the top-right corner to get reminders for tasks and events.
                            </p>
                        </div>
                        <div className="border border-border p-4 rounded-lg">
                            <Settings className="h-6 w-6 text-blue-500 mb-2" />
                            <h4 className="font-semibold mb-1">Theme Toggle</h4>
                            <p className="text-sm text-muted-foreground">
                                Switch between light and dark themes using the toggle in the header.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        dashboard: {
            title: 'Dashboard Overview',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Your dashboard provides a comprehensive overview of your productivity metrics and progress.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📊 Statistics Cards</h4>
                            <p className="text-sm text-muted-foreground">
                                View total hours tracked, completed tasks, and active projects at a glance.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📈 Time per Project Chart</h4>
                            <p className="text-sm text-muted-foreground">
                                Visual breakdown of time spent on each project with color-coded bars.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🥧 Task Completion Chart</h4>
                            <p className="text-sm text-muted-foreground">
                                Pie chart showing task completion distribution across projects.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🛠️ Data Tools</h4>
                            <p className="text-sm text-muted-foreground">
                                Export data, view weekly reviews, and analyze productivity patterns.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🎯 Goals Summary</h4>
                            <p className="text-sm text-muted-foreground">
                                Track progress on your time-based goals and targets.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        todo: {
            title: 'To-Do List Management',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Organize and manage your tasks with powerful features for productivity.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">➕ Adding Tasks</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Use the form at the top to create tasks. You can set:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• A due date, priority, and project.</li>
                                <li>• A recurring schedule (daily, weekly, etc.).</li>
                                <li>• If a task is recurring, you can also check "Track as a habit" to add it to your Habits view.</li>
                                <li>• Link the task to a task-based Goal for automatic progress tracking.</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📋 Managing Tasks</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Your task list is automatically sorted by priority and then grouped by due date.
                            </p>
                             <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• **Sub-Tasks:** Click the <Plus size={12} className="inline-block" /> icon on a task to expand it and add sub-tasks for more detailed tracking.</li>
                                <li>• **AI Slicer:** For complex tasks, an AI <Sparkles size={12} className="inline-block" /> icon will appear. Click it to automatically break the main task down into actionable sub-tasks. This is perfect for turning a big idea into a concrete plan.</li>
                                <li>• **Focus Mode:** Click the <Zap size={12} className="inline-block" /> icon to enter a distraction-free view for that specific task.</li>
                                <li>• **Filtering:** Use the controls above the list to search by name, filter by project, or hide completed tasks.</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🔄 Recurring Tasks</h4>
                            <p className="text-sm text-muted-foreground">
                                Set up tasks that repeat daily, weekly, or monthly. The app automatically creates the next instance for you after the due date passes.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        focus: {
            title: 'Today\'s Focus (Ivy Lee Method)',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        The Ivy Lee method helps you focus on the 6 most important tasks each day.
                    </p>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">How it works:</h4>
                        <ol className="space-y-1 text-green-800 dark:text-green-200 text-sm">
                            <li>1. Plan your top 6 tasks for tomorrow before ending today</li>
                            <li>2. Prioritize them in order of importance</li>
                            <li>3. Start with task #1 and work until complete</li>
                            <li>4. Move to task #2, and so on</li>
                            <li>5. Unfinished tasks move to tomorrow's list</li>
                        </ol>
                    </div>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📋 Daily Planning</h4>
                            <p className="text-sm text-muted-foreground">
                                Create your daily plan by selecting up to 6 tasks and arranging them by priority.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🎯 Focus Execution</h4>
                            <p className="text-sm text-muted-foreground">
                                Work through tasks in order, checking them off as you complete each one.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📊 Progress Tracking</h4>
                            <p className="text-sm text-muted-foreground">
                                View your daily completion rates and maintain focus streaks.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        habits: {
            title: 'Habit Tracking',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Build and maintain positive habits with visual tracking and streak monitoring.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">➕ Creating Habits</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Add new habits with:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• Custom names and descriptions</li>
                                <li>• Target frequency (daily, weekly, etc.)</li>
                                <li>• Color coding for organization</li>
                                <li>• Optional reminders</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📅 Habit Calendar</h4>
                            <p className="text-sm text-muted-foreground">
                                Visual heatmap showing your consistency over time. Click on dates to mark habit completion.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🔥 Streak Tracking</h4>
                            <p className="text-sm text-muted-foreground">
                                Monitor current streaks and track your longest streaks for motivation.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📊 Analytics</h4>
                            <p className="text-sm text-muted-foreground">
                                View completion rates, streak statistics, and habit performance over time.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        time: {
            title: 'Time Management',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Track time, use Pomodoro technique, and analyze your productivity patterns.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">⏱️ Time Tracker</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Manual time tracking with:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• Start/stop timers for projects</li>
                                <li>• Manual time entry</li>
                                <li>• Project and task categorization</li>
                                <li>• Time goal integration</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🍅 Pomodoro Timer</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Structured work sessions:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• 25-minute focus sessions</li>
                                <li>• 5-minute short breaks</li>
                                <li>• 15-30 minute long breaks</li>
                                <li>• Audio notifications</li>
                                <li>• Session tracking and statistics</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🎯 Time Goals</h4>
                            <p className="text-sm text-muted-foreground">
                                Set weekly or monthly time targets for projects and track progress automatically.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📈 Time Analytics</h4>
                            <p className="text-sm text-muted-foreground">
                                View detailed breakdowns of time allocation across projects and identify productivity patterns.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        calendar: {
            title: 'Calendar & Time Planning',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Schedule events, plan your time, and visualize your commitments.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📅 Calendar Views</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Multiple view options:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• Month view for overview</li>
                                <li>• Week view for detailed planning</li>
                                <li>• Day view for hour-by-hour scheduling</li>
                                <li>• Agenda view for upcoming events</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📝 Event Creation & Management</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Click on a time slot or an existing event to open the event modal. You can:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• Set a title, start time, and end time.</li>
                                <li>• Assign the event to a project.</li>
                                <li>• Set up a recurring schedule (daily, weekly, custom, etc.).</li>
                                <li>• For recurring events, you can choose to edit a single instance, the entire series, or split the series into two.</li>
                                <li>• Start a time tracker directly from a calendar event.</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🔄 Advanced Recurrence</h4>
                            <p className="text-sm text-muted-foreground">
                                Use the "Custom..." option in the recurrence dropdown to set up detailed schedules, such as repeating an event every 2 weeks on Mondays and Wednesdays, or on the last Friday of the month.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🎨 Color Coding</h4>
                            <p className="text-sm text-muted-foreground">
                                Events inherit colors from their associated projects for easy visual organization.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        notes: {
            title: 'Notes & Documentation',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Capture ideas, meeting notes, and documentation with an auto-saving editor.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📝 Editor Features</h4>
                             <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• **Auto-Saving:** Notes save automatically as you type.</li>
                                <li>• **View & Edit Modes:** Toggle between a clean reading view and a markdown editor.</li>
                                <li>• **List:** Notes are sorted by the most recently modified.</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🤖 AI Note Conversion</h4>
                            <p className="text-sm text-muted-foreground">
                                Click the <Brain size={12} className="inline-block" /> **Convert to Tasks** button to use AI to parse your note and automatically create structured tasks from its content.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🗂️ Organization</h4>
                            <p className="text-sm text-muted-foreground">
                                While notes are not directly tied to projects, you can use markdown headings and search to keep them organized.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        ai: {
            title: 'AI-Powered Features',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Leverage AI to accelerate your workflow and break down work.
                    </p>
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
                        <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🤖 Gemini AI Inside</h4>
                        <p className="text-purple-800 dark:text-purple-200 text-sm">
                            This app uses Google's Gemini AI for its intelligent features.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">✨ AI Task Slicer</h4>
                            <p className="text-sm text-muted-foreground">
                                In the To-Do list, click the <Sparkles size={12} className="inline-block" /> icon on any task. The AI will analyze the task and generate a checklist of smaller, actionable sub-tasks. This helps you get started on large or daunting tasks.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🔄 AI Note Converter</h4>
                            <p className="text-sm text-muted-foreground">
                                In the Notes view, use the <Brain size={12} className="inline-block" /> **Convert to Tasks** button. The AI will read your note, identify potential action items, and create a structured list of tasks in your To-Do view, assigned to the project of your choice.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🤖 AI Task Generation</h4>
                            <p className="text-sm text-muted-foreground">
                                In the To-Do list, click the **Generate Tasks** button. Describe a goal or objective, and the AI will brainstorm a list of relevant tasks for you, which you can then add to your list.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        goals: {
            title: 'Setting & Tracking Goals',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Set measurable goals for your projects to stay motivated and track your progress effectively.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🎯 Two Types of Goals</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                You can set two kinds of goals from the Goals view or the Project Management modal:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                                <li>
                                    <strong className="text-foreground">Time-Based Goals:</strong> Set a target number of hours to dedicate to a project within a specific timeframe (e.g., 10 hours this week). Progress is automatically updated as you log time using the Time Tracker or start a timer from a calendar event associated with the project.
                                </li>
                                <li>
                                    <strong className="text-foreground">Task-Based Goals:</strong> Set a target to complete a certain number of tasks within a project. To make progress, you must first link individual tasks to the goal from the To-Do view. As you complete these linked tasks, your goal progress will update automatically.
                                </li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📊 Monitoring Progress</h4>
                            <p className="text-sm text-muted-foreground">
                                Track all your active goals in the Goals view. The Dashboard also features a Goals Summary card for a quick overview of your progress at a glance.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        projects: {
            title: 'Project Management',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Organize your work into projects, and set measurable goals to track your progress.
                    </p>
                    <div className="space-y-3">
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📁 Project Creation</h4>
                            <p className="text-sm text-muted-foreground">
                                Create projects with a name and a color. Projects act as containers for tasks, events, and goals, helping you organize everything.
                            </p>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">🎯 Goal Setting</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                You can set two types of goals for your projects:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                                <li>• **Time-Based Goals:** Set a target number of hours to complete by a deadline. Progress is updated automatically when you use the Time Tracker for that project.</li>
                                <li>• **Task-Based Goals:** Set a target to complete a certain number of tasks. Progress is updated automatically as you complete tasks linked to this goal.</li>
                            </ul>
                        </div>
                        <div className="border border-border p-3 rounded-lg">
                            <h4 className="font-semibold mb-2">📊 Progress & Management</h4>
                            <p className="text-sm text-muted-foreground">
                                View progress bars for all goals in the sidebar. You can edit or delete projects and goals. Deleting a project will also permanently remove all associated tasks and calendar events.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        shortcuts: {
            title: 'Keyboard Shortcuts',
            content: (
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Use these handy shortcuts to navigate and act faster:
                    </p>
                    <div className="border border-border p-3 rounded-lg space-y-2 text-sm text-muted-foreground">
                        <div><span className="font-mono bg-muted px-1 py-0.5 rounded">Ctrl&nbsp;+&nbsp;.</span> – Create a new task</div>
                        <div><span className="font-mono bg-muted px-1 py-0.5 rounded">Ctrl&nbsp;+&nbsp;,</span> – Quick add note</div>
                        <div><span className="font-mono bg-muted px-1 py-0.5 rounded">T&nbsp;then&nbsp;P</span> – Open Pomodoro timer</div>
                        <div><span className="font-mono bg-muted px-1 py-0.5 rounded">T&nbsp;then&nbsp;I</span> – Jump to Ivy&nbsp;Lee view</div>
                        <div><span className="font-mono bg-muted px-1 py-0.5 rounded">/</span> – Focus search field (where available)</div>
                    </div>
                </div>
            )
        }
    };

    // Filtered sections according to search
    const displaySections = sections.filter(sec => sec.title.toLowerCase().includes(searchTerm.toLowerCase()));

    // Ensure activeSection stays in filtered list
    useEffect(() => {
        if (!displaySections.find(s => s.id === activeSection)) {
            setActiveSection(displaySections[0]?.id || 'overview');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[90vh] flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-1/3 bg-secondary border-r border-border p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-foreground">User Guide</h2>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-accent rounded-md transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    {/* Search Input */}
                    <div className="mb-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search topics…"
                            className="w-full rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <nav className="space-y-2">
                        {displaySections.map((section) => {
                            const Icon = section.icon;
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors ${
                                        activeSection === section.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'hover:bg-accent text-muted-foreground hover:text-accent-foreground'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="text-sm font-medium">{section.title}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-2xl">
                        <h1 className="text-2xl font-bold text-foreground mb-6">
                            {features[activeSection]?.title}
                        </h1>
                        {features[activeSection]?.content}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserGuide;