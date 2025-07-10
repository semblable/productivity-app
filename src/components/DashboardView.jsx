import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useState, useEffect } from 'react';
import { DataTools } from './DataTools';
import GoalsSummary from './GoalsSummary';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const StatCard = ({ title, value, description }) => (
    <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
);

export const DashboardView = ({ onShowReview = () => {} }) => {
    const projects = useLiveQuery(() => db.projects.toArray(), []);
    const tasks = useLiveQuery(() => db.tasks.toArray(), []);
    const timeEntries = useLiveQuery(() => db.timeEntries.toArray(), []);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    // Listener for theme changes to update chart colors
    useEffect(() => {
        const handleThemeChange = () => {
            setTheme(localStorage.getItem('theme') || 'dark');
        };
        window.addEventListener('theme-change', handleThemeChange);

        return () => {
            window.removeEventListener('theme-change', handleThemeChange);
        };
    }, []);

    if (!projects || !tasks || !timeEntries) {
        return <div className="text-center text-muted-foreground">Loading dashboard data...</div>;
    }

    const projectMap = projects.reduce((map, proj) => {
        map[proj.id] = proj;
        return map;
    }, {});

    // --- Data processing for charts ---
    const totalHoursTracked = timeEntries.reduce((acc, entry) => acc + (entry.duration || 0), 0) / 3600;
    const completedTasks = tasks.filter(t => t.completed).length;

    // Time per project
    const timePerProject = timeEntries.reduce((acc, entry) => {
        const projectName = projectMap[entry.projectId]?.name || 'Unassigned';
        acc[projectName] = (acc[projectName] || 0) + (entry.duration || 0);
        return acc;
    }, {});
    const projectLabels = Object.keys(timePerProject);
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

    // Tasks completed per project
    const tasksPerProject = tasks.reduce((acc, task) => {
        if(task.completed) {
            const projectName = projectMap[task.projectId]?.name || 'Unassigned';
            acc[projectName] = (acc[projectName] || 0) + 1;
        }
        return acc;
    }, {});
    const taskProjectLabels = Object.keys(tasksPerProject);
    const taskProjectColors = taskProjectLabels.map(label => projects.find(p => p.name === label)?.color || '#82ca9d');
    const taskProjectData = {
        labels: taskProjectLabels,
        datasets: [{
            label: 'Tasks Completed',
            data: taskProjectLabels.map(label => tasksPerProject[label]),
            backgroundColor: taskProjectColors,
            borderColor: theme === 'dark' ? '#020817' : '#ffffff',
            borderWidth: 2,
        }]
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
            }
        },
        scales: { 
            y: { ticks: { color: fontColor }, grid: { color: gridColor } }, 
            x: { ticks: { color: fontColor }, grid: { color: gridColor } } 
        },
    };
    
    const pieChartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: fontColor }
            },
            tooltip: {
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                titleColor: fontColor,
                bodyColor: fontColor,
                borderColor: gridColor,
                borderWidth: 1,
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Hours Tracked" value={totalHoursTracked.toFixed(1)} description="Across all projects" />
                <StatCard title="Completed Tasks" value={completedTasks} description="Total tasks marked as done" />
                <StatCard title="Active Projects" value={projects.length} description="Total number of projects" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="font-bold text-lg mb-2 text-card-foreground">Time per Project (Hours)</h3>
                    <Bar options={chartOptions} data={projectData} />
                </div>
                 <div className="space-y-6">
                    <DataTools onShowReview={onShowReview} />
                    <GoalsSummary />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <h3 className="font-bold text-lg mb-2 text-card-foreground">Tasks Completed per Project</h3>
                    <Pie data={taskProjectData} options={pieChartOptions}/>
                </div>
            </div>
        </div>
    );
}; 