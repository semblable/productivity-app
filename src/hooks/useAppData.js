import { useQuery } from '@tanstack/react-query';
import { api } from '../api/apiClient';
import { queryKeys } from '../api/queryKeys';

const emptyArray = [];

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => api.projects.list(),
    initialData: emptyArray,
  });
}

export function useProject(projectId) {
  return useQuery({
    queryKey: [...queryKeys.projects, projectId],
    queryFn: () => api.projects.get(projectId),
    enabled: projectId != null && projectId !== '',
  });
}

export function useTasks(query) {
  return useQuery({
    queryKey: [...queryKeys.tasks, query || {}],
    queryFn: () => api.tasks.list(query),
    initialData: emptyArray,
  });
}

export function useTask(taskId) {
  return useQuery({
    queryKey: [...queryKeys.tasks, taskId],
    queryFn: () => api.tasks.get(taskId),
    enabled: taskId != null && taskId !== '',
  });
}

export function useGoals(query) {
  return useQuery({
    queryKey: [...queryKeys.goals, query || {}],
    queryFn: () => api.goals.list(query),
    initialData: emptyArray,
  });
}

export function useGoal(goalId) {
  return useQuery({
    queryKey: [...queryKeys.goals, goalId],
    queryFn: () => api.goals.get(goalId),
    enabled: goalId != null && goalId !== '',
  });
}

export function useTimeEntries(query) {
  return useQuery({
    queryKey: [...queryKeys.timeEntries, query || {}],
    queryFn: () => api.timeEntries.list(query),
    initialData: emptyArray,
  });
}

export function useEvents(query) {
  return useQuery({
    queryKey: [...queryKeys.events, query || {}],
    queryFn: () => api.events.list(query),
    initialData: emptyArray,
  });
}

export function useEvent(eventId) {
  return useQuery({
    queryKey: [...queryKeys.events, eventId],
    queryFn: () => api.events.get(eventId),
    enabled: eventId != null && eventId !== '',
  });
}

export function useNotes() {
  return useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => api.notes.list({ _orderBy: 'modifiedAt DESC' }),
    initialData: emptyArray,
  });
}

export function useFolders(query) {
  return useQuery({
    queryKey: [...queryKeys.folders, query || {}],
    queryFn: () => api.folders.list(query),
    initialData: emptyArray,
  });
}

export function useFolder(folderId) {
  return useQuery({
    queryKey: [...queryKeys.folders, folderId],
    queryFn: () => api.folders.get(folderId),
    enabled: folderId != null && folderId !== '',
  });
}

export function useHabits(query) {
  return useQuery({
    queryKey: [...queryKeys.habits, query || {}],
    queryFn: () => api.habits.list(query),
    initialData: emptyArray,
  });
}

export function useHabit(habitId) {
  return useQuery({
    queryKey: [...queryKeys.habits, habitId],
    queryFn: () => api.habits.get(habitId),
    enabled: habitId != null && habitId !== '',
  });
}

export function useHabitCompletions(query) {
  return useQuery({
    queryKey: [...queryKeys.habitCompletions, query || {}],
    queryFn: () => api.habit_completions.list(query),
    initialData: emptyArray,
  });
}

export function useIvyLee(query) {
  return useQuery({
    queryKey: [...queryKeys.ivyLee, query || {}],
    queryFn: () => api.ivyLee.list(query),
    initialData: emptyArray,
  });
}
