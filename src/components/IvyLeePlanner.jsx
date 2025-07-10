import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { format, addDays } from 'date-fns';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';

const SortableTask = ({ task }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'grab',
    };

    return (
        <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md shadow-sm">
            {task.text}
        </li>
    );
};

const IvyLeePlanner = ({ onPlanCreated }) => {
  // Fetch tasks once and post-filter so that the "tomorrow" logic can run on the client
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const tasks = useLiveQuery(async () => {
    // 1. Get all uncompleted tasks
    const allTasks = await db.tasks.filter(task => !task.completed).toArray();

    // 2. Keep only those that are relevant for the Ivy-Lee plan for tomorrow:
    //    • Exclude the template (parent) rows of recurring tasks (those still holding an rrule and no parentId).
    //    • If a task has a dueDate, include it only when that dueDate is exactly tomorrow.
    //    • Tasks without a dueDate (back-log tasks) are always eligible so that users can still pick them.
    return allTasks.filter(t => {
      // Skip the recurring template (parent) items
      if (t.rrule && !t.parentId) return false;

      if (t.dueDate) {
        return format(new Date(t.dueDate), 'yyyy-MM-dd') === tomorrowStr;
      }

      // No dueDate means the task is unscheduled → allow selection
      return true;
    });
  }, [tomorrowStr], []);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [planLoaded, setPlanLoaded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!tasks) {
        return; // Wait for the main task list to load
    }

    if (!planLoaded) {
        const loadPlan = async () => {
            const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
            const existingPlan = await db.ivyLee.get(tomorrow);

            if (existingPlan?.tasks) {
                const plannedTaskIds = new Map(existingPlan.tasks.map(t => [t.id, t.rank]));
                const tasksFromPlan = tasks
                    .filter(t => plannedTaskIds.has(t.id))
                    .sort((a, b) => plannedTaskIds.get(a.id) - plannedTaskIds.get(b.id));

                setSelectedTasks(tasksFromPlan);
            }
            setPlanLoaded(true); // Ensure we only load the plan once
        };
        loadPlan();
    } else {
        // After initial load, this ensures the selection stays in sync if a task is deleted elsewhere
        const taskIds = new Set(tasks.map(t => t.id));
        setSelectedTasks(currentSelected => currentSelected.filter(st => taskIds.has(st.id)));
    }
  }, [tasks, planLoaded]);

  const handleToggleTask = (task) => {
    if (selectedTasks.find(t => t.id === task.id)) {
      setSelectedTasks(selectedTasks.filter(t => t.id !== task.id));
    } else {
      if (selectedTasks.length < 6) {
        setSelectedTasks([...selectedTasks, task]);
      } else {
        alert('You can only select up to 6 tasks.');
      }
    }
  };

  const handleAddTask = async () => {
    if (newTask.trim() === '') return;
    const taskId = await db.tasks.add({
      text: newTask,
      completed: 0,
      createdAt: new Date(),
    });
    const task = await db.tasks.get(taskId);
    if (selectedTasks.length < 6) {
      setSelectedTasks([...selectedTasks, task]);
    }
    setNewTask('');
  };

  const handleSavePlan = async () => {
    if (selectedTasks.length === 0) {
      alert('Please select at least one task.');
      return;
    }
    
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    const plan = {
      date: tomorrow,
      tasks: selectedTasks.map((task, index) => ({
        id: task.id,
        title: task.text,
        rank: index + 1,
        completed: false
      }))
    };

    await db.ivyLee.put(plan);
    alert("Tomorrow's plan has been saved!");
    if(onPlanCreated) onPlanCreated();
  };

  function handleDragEnd(event) {
    const {active, over} = event;
    
    if (active.id !== over.id) {
      setSelectedTasks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Plan Your 6 Tasks for Tomorrow</h2>
      <p className="mb-4">Select up to 6 tasks from your list or add new ones. The order of selection will be the order for tomorrow.</p>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Your Uncompleted Tasks</h3>
        {tasks.length > 0 ? (
          <div className="flex flex-col mt-2 border rounded p-2 max-h-60 overflow-y-auto">
            {tasks.map(task => (
              <label key={task.id} className="inline-flex items-center mt-2 p-2 hover:bg-gray-100 rounded">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-blue-600"
                  checked={selectedTasks.some(t => t.id === task.id)}
                  onChange={() => handleToggleTask(task)}
                />
                <span className="ml-3 text-gray-700">{task.text}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="mt-2 p-4 text-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">You have no uncompleted tasks.</p>
            <p className="text-sm text-gray-400 mt-1">Add tasks in the "Todo List" view or create one below.</p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold">Add a new task for the plan</h3>
        <div className="flex">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            className="border rounded-l px-4 py-2 w-full"
            placeholder="New task description"
          />
          <button onClick={handleAddTask} className="bg-blue-500 text-white px-4 rounded-r">Add</button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Selected for Tomorrow (drag to reorder)</h3>
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={selectedTasks}
                strategy={verticalListSortingStrategy}
            >
                <ul className="list-decimal list-inside space-y-2 mt-2">
                    {selectedTasks.map(task => <SortableTask key={task.id} task={task} />)}
                </ul>
            </SortableContext>
        </DndContext>
      </div>

      <button
        onClick={handleSavePlan}
        className="mt-6 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      >
        Save Plan for Tomorrow
      </button>
    </div>
  );
};

export default IvyLeePlanner; 