import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import HabitCalendar from './HabitCalendar';
import './HabitCalendar.css';
import { AddHabitForm } from './AddHabitForm';
import { PlusCircle, MoreVertical, Edit, Trash2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteHabit, updateHabitName, updateHabit, uncompleteHabitToday } from '../db/habit-utils';
import { format } from 'date-fns';

const EditHabitForm = ({ habit, onUpdate, onCancel, allProjects }) => {
    const [name, setName] = useState(habit.name);
    const [projectId, setProjectId] = useState(habit.projectId || '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Habit name cannot be empty.");
            return;
        }
        await updateHabitName(habit.id, name.trim(), projectId ? Number(projectId) : null);
        toast.success("Habit updated!");
        onUpdate();
    };

    return (
        <form onSubmit={handleSubmit} className="p-4">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded-md bg-secondary border border-border text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                autoFocus
            />
            <select 
                value={projectId} 
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full mt-2 p-2 rounded-md bg-secondary border border-border text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            >
                <option value="">No Project</option>
                {allProjects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={onCancel} className="px-3 py-1 rounded-md hover:bg-muted">Cancel</button>
                <button type="submit" className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90">Save</button>
            </div>
        </form>
    )
}

const HabitItem = ({ habit, allProjects }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const menuRef = useRef(null);

    const isCompletedToday = useLiveQuery(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        return db.habit_completions
            .where({ habitId: habit.id, date: todayStr })
            .first();
    }, [habit.id]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef]);

    const handleToggleComplete = async () => {
        try {
            if (isCompletedToday) {
                await uncompleteHabitToday(habit.id);
            } else {
                await updateHabit(habit.taskId);
            }
        } catch (error) {
            toast.error("Failed to update habit completion.");
            console.error(error);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete the habit "${habit.name}"? This also deletes the associated recurring task and all completion history.`)) {
            try {
                await deleteHabit(habit.id, habit.taskId);
                toast.success("Habit deleted.");
            } catch (error) {
                toast.error("Failed to delete habit.");
                console.error(error);
            }
        }
        setShowMenu(false);
    };

    const handleEdit = () => {
        setIsEditing(true);
        setShowMenu(false);
    };

    if (isEditing) {
        return (
             <div className="bg-card border border-border p-4 rounded-lg shadow-sm">
                <EditHabitForm 
                    habit={habit} 
                    allProjects={allProjects}
                    onUpdate={() => setIsEditing(false)}
                    onCancel={() => setIsEditing(false)}
                />
            </div>
        )
    }

    return (
        <div className="bg-card border border-border p-4 rounded-lg shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-lg font-semibold">{habit.name}</h2>
                    <p className="text-sm text-muted-foreground">Best Streak: {habit.bestStreak || 0} days</p>
                    <p className="text-xs text-muted-foreground mt-1">Freezes: {(habit.streakFreezes ?? habit.streakFriezes) || 0} ❄️</p>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="text-right">
                        <p className="text-3xl font-bold text-primary">{habit.streak || 0} 🔥</p>
                        <p className="text-sm text-muted-foreground">Current Streak</p>
                    </div>
                    <button 
                        onClick={handleToggleComplete}
                        className={`p-2 rounded-full transition-colors ${
                            isCompletedToday 
                                ? 'bg-green-500/20 text-green-500' 
                                : 'hover:bg-primary/10 text-primary'
                        }`}
                        aria-label={isCompletedToday ? 'Un-mark habit as complete' : 'Mark habit as complete'}
                    >
                        <CheckCircle size={24} />
                    </button>
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-muted">
                            <MoreVertical size={20} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-md shadow-lg z-10">
                                <ul className="py-1">
                                    <li>
                                        <button onClick={handleEdit} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2">
                                            <Edit size={14} /> Edit Name
                                        </button>
                                    </li>
                                    <li>
                                        <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
                                            <Trash2 size={14} /> Delete Habit
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <HabitCalendar habitId={habit.id} />
        </div>
    );
};

const HabitsView = () => {
  const habits = useLiveQuery(() => db.habits.orderBy('name').toArray(), []);
  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="p-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Habit Tracker</h1>
            <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-4 py-2 rounded-md shadow-sm transition-transform hover:scale-105"
            >
                <PlusCircle size={16} />
                <span>{showAddForm ? 'Cancel' : 'New Habit'}</span>
            </button>
        </div>

        {showAddForm && <AddHabitForm onHabitAdded={() => setShowAddForm(false)} />}
      
      <div className="space-y-6 mt-4">
        {habits && habits.length > 0 ? (
          habits.map(habit => (
            <HabitItem key={habit.id} habit={habit} allProjects={projects} />
          ))
        ) : (
          !showAddForm && (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed border-border rounded-lg mt-8">
                <h3 className="text-xl font-semibold">No Habits Yet</h3>
                <p className="text-base mt-2">"We are what we repeatedly do."</p>
                <p className="text-sm mt-4">Click "New Habit" to start building a new positive routine.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default HabitsView; 