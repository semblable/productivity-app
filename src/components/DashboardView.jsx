import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useState, useEffect, useMemo } from 'react';
import { DataTools } from './DataTools';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import GoalsSummary from './GoalsSummary';
import { useProjects, useTasks, useTimeEntries } from '../hooks/useAppData';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const PERIODS = [
    { value: 'week',  label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year',  label: 'Year' },
    { value: 'all',   label: 'All' },
];

const getPeriodStart = (period) => {
    const now = new Date();
    switch (period) {
        case 'week': {
            const d = new Date(now);
            d.setDate(d.getDate() - 6);
            d.setHours(0, 0, 0, 0);
            return d;
        }
        case 'month': {
            const d = new Date(now);
            d.setMonth(d.getMonth() - 1);
            d.setHours(0, 0, 0, 0);
            return d;
        }
        case 'year': {
            const d = new Date(now);
            d.setFullYear(d.getFullYear() - 1);
            d.setHours(0, 0, 0, 0);
            return d;
        }
        default:
            return null;
    }
};

const StatCard = ({ title, value, description }) => (
    <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
);

const PeriodButton = ({ current, value, onClick, children }) => (
    <button
        onClick={() => onClick(value)}
        className={`px-3 py-1 text-sm rounded-md transition-colors ${
            current === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-border text-foreground'
        }`}
    >
        {children}
    </button>
);

export const DashboardView = ({ onShowReview = () => {} }) => {
    const [period, setPeriod] = useState('month');
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    const { data: projects = [] } = useProjects();
    const { data: tasks = [] } = useTasks();
    const { data: timeEntries = [] } = useTimeEntries();

    useEffect(() => {
        const handleThemeChange = () => setTheme(localStorage.getItem('theme') || 'dark');
        window.addEventListener('theme-change', handleThemeChange);
        return () => window.removeEventListener('theme-change', handleThemeChange);
    }, []);

    const periodStart = useMemo(() => getPeriodStart(period), [period]);

    const filteredEntries = useMemo(() => {
        if (!timeEntries) return [];
        if (!periodStart) return timeEntries;
        return timeEntries.filter(e => new Date(e.startTime) >= periodStart);
    }, [timeEntries, periodStart]);

    const filteredTasks = useMemo(() => {
        if (!tasks) return [];
        if (!periodStart) return tasks;
        return tasks.filter(t => new Date(t.createdAt) >= periodStart);
    }, [tasks, periodStart]);

    if (!projects || !tasks || !timeEntries) {
        return <div className="text-center text-muted-foreground">Loading dashboard data...</div>;
    }

    const projectMap = projects.reduce((map, proj) => {
        map[proj.id] = proj;
        return map;
    }, {});

    const totalHoursTracked = filteredEntries.reduce((acc, e) => acc + (e.duration || 0), 0) / 3600;
    const completedTasks = filteredTasks.filter(t => t.completed).length;

    // Time per project — only include entries whose project still exists
    const timePerProject = filteredEntries.reduce((acc, entry) => {
        const project = projectMap[entry.projectId];
        if (!project) return acc;
        acc[project.name] = (acc[project.name] || 0) + (entry.duration || 0);
        return acc;
    }, {});
    // Drop any labels with 0 seconds (shouldn't happen now, but guard anyway)
    const projectLabels = Object.keys(timePerProject).filter(l => timePerProject[l] > 0);
    const projectColors = projectLabels.map(label => projects.find(p => p.name === label)?.color || '#8884d8');
    const projectData = {
        labels: projectLabels,
        datasets: [{
            label: 'Hours Tracked',
            data: projectLabels.map(label => (timePerProject[label] / 3600).toFixed(2)),
            backgroundColor: projectColors,
            borderColor: projectColors,
            borderWidth: 1,
        }],
    };

    // Tasks completed per project — only include tasks whose project still exists
    const tasksPerProject = filteredTasks.reduce((acc, task) => {
        if (!task.completed) return acc;
        const project = projectMap[task.projectId];
        if (!project) return acc;
        acc[project.name] = (acc[project.name] || 0) + 1;
        return acc;
    }, {});
    const taskProjectLabels = Object.keys(tasksPerProject).filter(l => tasksPerProject[l] > 0);
    const taskProjectColors = taskProjectLabels.map(label => projects.find(p => p.name === label)?.color || '#82ca9d');
    const taskProjectData = {
        labels: taskProjectLabels,
        datasets: [{
            label: 'Tasks Completed',
            data: taskProjectLabels.map(label => tasksPerProject[label]),
            backgroundColor: taskProjectColors,
            borderColor: theme === 'dark' ? '#020817' : '#ffffff',
            borderWidth: 2,
        }],
    };

    const fontColor = theme === 'dark' ? '#e2e8f0' : '#334155';
    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: false },
            tooltip: {
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                titleColor: fontColor,
                bodyColor: fontColor,
                borderColor: gridColor,
                borderWidth: 1,
            },
        },
        scales: {
            y: { ticks: { color: fontColor }, grid: { color: gridColor } },
            x: { ticks: { color: fontColor }, grid: { color: gridColor } },
        },
    };

    const pieChartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top', labels: { color: fontColor } },
            tooltip: {
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                titleColor: fontColor,
                bodyColor: fontColor,
                borderColor: gridColor,
                borderWidth: 1,
            },
        },
    };

    const periodDescriptions = {
        week:  'Last 7 days',
        month: 'Last 30 days',
        year:  'Last 12 months',
        all:   'All time',
    };

    return (
        <div className="space-y-6">
            {/* Period selector */}
            <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg w-fit">
                {PERIODS.map(p => (
                    <PeriodButton key={p.value} current={period} value={p.value} onClick={setPeriod}>
                        {p.label}
                    </PeriodButton>
                ))}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Hours Tracked"
                    value={totalHoursTracked.toFixed(1)}
                    description={periodDescriptions[period]}
                />
                <StatCard
                    title="Completed Tasks"
                    value={completedTasks}
                    description={`Created & done — ${periodDescriptions[period]}`}
                />
                <StatCard
                    title="Active Projects"
                    value={projects.length}
                    description="Total number of projects"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="font-bold text-lg mb-2 text-card-foreground">
                        Time per Project (Hours) — {periodDescriptions[period]}
                    </h3>
                    {projectLabels.length > 0
                        ? <Bar options={chartOptions} data={projectData} />
                        : <p className="text-muted-foreground text-sm py-8 text-center">No time entries in this period.</p>
                    }
                </div>
                <div className="space-y-6">
                    <DataTools onShowReview={onShowReview} />
                    <GoogleCalendarSettings />
                    <GoalsSummary />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="font-bold text-lg mb-2 text-card-foreground">
                        Tasks Completed per Project — {periodDescriptions[period]}
                    </h3>
                    {taskProjectLabels.length > 0
                        ? <Pie data={taskProjectData} options={pieChartOptions} />
                        : <p className="text-muted-foreground text-sm py-8 text-center">No completed tasks in this period.</p>
                    }
                </div>
            </div>
        </div>
    );
};
