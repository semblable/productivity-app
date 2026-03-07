import { api } from '../api/apiClient';
import toast from 'react-hot-toast';
import { format, differenceInCalendarDays, subDays } from 'date-fns';

async function _recalculateAndUpdateHabit(habitId) {
    const habit = await api.habits.get(habitId);
    if (!habit) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completions = await api.habit_completions.list({
        habitId: habit.id,
        _orderBy: 'date ASC',
    });

    const completionDates = completions.map(c => new Date(c.date + 'T00:00:00')).sort((a, b) => b - a);

    let currentStreak = 0;
    if (completionDates.length > 0) {
        const latestCompletion = completionDates[0];
        // Streak can only exist if the last completion was today or yesterday
        if (differenceInCalendarDays(today, latestCompletion) <= 1) {
            currentStreak = 1;
            for (let i = 0; i < completionDates.length - 1; i++) {
                const day1 = completionDates[i];
                const day2 = completionDates[i + 1];
                if (differenceInCalendarDays(day1, day2) === 1) {
                    currentStreak++;
                } else {
                    break; // Gap in dates
                }
            }
        }
    }

    const newBestStreak = Math.max(habit.bestStreak || 0, currentStreak);
    const lastCompletionDate = completionDates.length > 0 ? completionDates[0] : null;

    // Award streak freezes - this logic can be kept simple as it only depends on current streak
    const milestone = Math.floor(currentStreak / 14);
    let newFreezes = habit.streakFreezes || 0;
    let newMilestone = habit.lastStreakMilestone || 0;
    if (milestone > 0 && milestone > newMilestone) {
        const awardedFriezes = milestone - newMilestone;
        newFreezes += awardedFriezes;
        newMilestone = milestone;
        toast.success(`You earned ${awardedFriezes} streak freeze(s)!`);
    }

    await api.habits.update(habit.id, {
        streak: currentStreak,
        bestStreak: newBestStreak,
        lastCompletionDate: lastCompletionDate,
        streakFreezes: newFreezes, // This part might need more complex logic if freezes can be spent
        lastStreakMilestone: newMilestone
    });

    return currentStreak;
}

export const updateHabit = async (taskId) => {
    if (!taskId) return;
    const [habit] = await api.habits.list({ taskId, _limit: 1 });
    if (!habit) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = format(today, 'yyyy-MM-dd');

    const [todaysCompletion] = await api.habit_completions.list({
        habitId: habit.id,
        date: todayStr,
        _limit: 1,
    });

    if (todaysCompletion) {
        return;
    }

    await api.habit_completions.create({
        habitId: habit.id,
        date: todayStr,
        completedAt: new Date()
    });

    const newStreak = await _recalculateAndUpdateHabit(habit.id);

    toast.success(`'${habit.name}' habit streak updated to ${newStreak} days! 🔥`);
};

export const uncompleteHabitToday = async (habitId) => {
    const habit = await api.habits.get(habitId);
    if (!habit) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const [todaysCompletion] = await api.habit_completions.list({
        habitId: habit.id,
        date: todayStr,
        _limit: 1,
    });

    if (todaysCompletion) {
        await api.habit_completions.remove(todaysCompletion.id);
        const newStreak = await _recalculateAndUpdateHabit(habitId);
        toast.success(`Un-marked '${habit.name}' for today. Current streak: ${newStreak} days.`);
    }
};

export const deleteHabit = async (habitId, taskId) => {
    if (!habitId) return;
    const completions = await api.habit_completions.list({ habitId });
    if (completions.length > 0) {
        await api.habit_completions.bulkRemove(completions.map((completion) => completion.id));
    }

    await api.habits.remove(habitId);

    if (taskId) {
        await api.tasks.remove(taskId);
    }
};

export const updateHabitName = async (habitId, newName, newProjectId) => {
    const habit = await api.habits.get(habitId);
    if (!habit) {
        return;
    }

    await api.habits.update(habitId, {
        name: newName,
        projectId: newProjectId
    });

    if (habit.taskId) {
        await api.tasks.update(habit.taskId, {
            text: newName,
            projectId: newProjectId
        });
    }
};

export const checkBrokenStreaks = async () => {
    const habits = await api.habits.list();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const habit of habits) {
        if (!habit.lastCompletionDate) continue; // Never completed, streak is 0 anyway

        const lastCompletion = new Date(habit.lastCompletionDate);
        lastCompletion.setHours(0, 0, 0, 0);

        const missedDays = differenceInCalendarDays(today, lastCompletion) - 1;

        if (missedDays > 0) {
            if (habit.streakFreezes >= missedDays) {
                // Have enough freezes for all missed days
                for (let i = 1; i <= missedDays; i++) {
                    const missedDateStr = format(subDays(today, missedDays - i + 1), 'yyyy-MM-dd');
                    await api.habit_completions.create({
                        habitId: habit.id,
                        date: missedDateStr,
                        completedAt: new Date().toISOString()
                    });
                }

                await api.habits.update(habit.id, {
                    streakFreezes: habit.streakFreezes - missedDays,
                    lastCompletionDate: subDays(today, 1) // To "use" the freeze
                });
                toast.info(`Used ${missedDays} streak freeze(s) to save your '${habit.name}' streak!`);
            } else {
                // Not enough freezes, streak breaks
                if (habit.streak > 0) {
                    await api.habits.update(habit.id, { streak: 0 });
                    toast.error(`Streak for '${habit.name}' was broken.`);
                }
            }
        }
    }
}; 