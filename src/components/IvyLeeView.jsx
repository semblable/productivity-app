import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { format } from 'date-fns';

const IvyLeeView = ({ openPlanner }) => {
  const [todaysPlan, setTodaysPlan] = useState(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchTodaysPlan = async () => {
      const plan = await db.ivyLee.get(today);
      if (plan && plan.tasks) {
        setTodaysPlan(plan);
        const firstUncompletedIndex = plan.tasks.findIndex(t => !t.completed);
        setCurrentTaskIndex(firstUncompletedIndex !== -1 ? firstUncompletedIndex : plan.tasks.length);
      }
      setLoading(false);
    };

    fetchTodaysPlan();
  }, [today]);

  const handleCompleteTask = async () => {
    if (!todaysPlan) return;

    const updatedTasks = [...todaysPlan.tasks];
    updatedTasks[currentTaskIndex].completed = true;

    const updatedPlan = { ...todaysPlan, tasks: updatedTasks };
    await db.ivyLee.put(updatedPlan);
    setTodaysPlan(updatedPlan);

    const nextTaskIndex = updatedTasks.findIndex(t => !t.completed);
    if (nextTaskIndex !== -1) {
      setCurrentTaskIndex(nextTaskIndex);
    } else {
      // All tasks completed
      setCurrentTaskIndex(todaysPlan.tasks.length);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!todaysPlan || todaysPlan.tasks.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Today's Focus</h2>
        <p>You haven't planned your six tasks for today.</p>
        <p>Plan for tomorrow evening!</p>
        {openPlanner && (
          <button
            onClick={openPlanner}
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Plan Tomorrow's Tasks
          </button>
        )}
      </div>
    );
  }

  const currentTask = todaysPlan.tasks[currentTaskIndex];
  const allTasksCompleted = currentTaskIndex >= todaysPlan.tasks.length;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Today's Focus</h1>
      {allTasksCompleted ? (
        <div className="text-center p-6 bg-green-100 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-green-800">Congratulations!</h2>
          <p className="text-green-600 mt-2">You've completed all your tasks for today. Well done!</p>
          {openPlanner && (
            <button
              onClick={openPlanner}
              className="mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full text-lg"
            >
              Plan Tomorrow's Tasks
            </button>
          )}
        </div>
      ) : (
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <p className="text-sm font-semibold text-gray-500 mb-2">Task {currentTaskIndex + 1} of {todaysPlan.tasks.length}</p>
          <h2 className="text-4xl font-bold mb-6 text-gray-800">{currentTask.title}</h2>
          <button
            onClick={handleCompleteTask}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full text-lg"
          >
            Mark as Complete
          </button>
        </div>
      )}
    </div>
  );
};

export default IvyLeeView; 