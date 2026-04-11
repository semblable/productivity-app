import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../api/apiClient', () => ({
  api: {
    projects: { list: jest.fn().mockResolvedValue([]) },
    tasks: { list: jest.fn().mockResolvedValue([]), get: jest.fn() },
    goals: { list: jest.fn().mockResolvedValue([]), get: jest.fn() },
    timeEntries: { list: jest.fn().mockResolvedValue([]) },
    events: { list: jest.fn().mockResolvedValue([]), get: jest.fn() },
    notes: { list: jest.fn().mockResolvedValue([]) },
    folders: { list: jest.fn().mockResolvedValue([]), get: jest.fn() },
    habits: { list: jest.fn().mockResolvedValue([]), get: jest.fn() },
    habit_completions: { list: jest.fn().mockResolvedValue([]) },
    ivyLee: { list: jest.fn().mockResolvedValue([]) },
  },
}));

import { api } from '../../api/apiClient';
import {
  useProjects,
  useProject,
  useTasks,
  useGoals,
  useTimeEntries,
  useEvents,
  useNotes,
  useFolders,
  useHabits,
  useHabitCompletions,
  useIvyLee,
} from '../useAppData';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAppData hooks', () => {
  test('useProjects returns initial empty array', () => {
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useTasks returns initial empty array', () => {
    const { result } = renderHook(() => useTasks(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useGoals returns initial empty array', () => {
    const { result } = renderHook(() => useGoals(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useTimeEntries returns initial empty array', () => {
    const { result } = renderHook(() => useTimeEntries(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useEvents returns initial empty array', () => {
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useNotes returns initial empty array', () => {
    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useFolders returns initial empty array', () => {
    const { result } = renderHook(() => useFolders(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useHabits returns initial empty array', () => {
    const { result } = renderHook(() => useHabits(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useHabitCompletions returns initial empty array', () => {
    const { result } = renderHook(() => useHabitCompletions(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useIvyLee returns initial empty array', () => {
    const { result } = renderHook(() => useIvyLee(), { wrapper: createWrapper() });
    expect(result.current.data).toEqual([]);
  });

  test('useProject with null id does not fetch', () => {
    const { result } = renderHook(() => useProject(null), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });

  test('useProject with empty string does not fetch', () => {
    const { result } = renderHook(() => useProject(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});
