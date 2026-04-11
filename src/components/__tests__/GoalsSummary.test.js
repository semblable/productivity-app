/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GoalsSummary from '../GoalsSummary';

// Mock specific repository and hook values
jest.mock('../../db/goals-repository', () => ({
  useGoals: jest.fn(),
}));

jest.mock('../../hooks/useAppData', () => ({
  useProjects: jest.fn(),
  useTimeEntries: jest.fn(),
}));

import { useGoals } from '../../db/goals-repository';
import { useProjects, useTimeEntries } from '../../hooks/useAppData';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  // Set default successful hook returns to avoid 'cannot read data of undefined'
  useProjects.mockReturnValue({ data: [{ id: 'proj-1', name: 'Work', color: '#3b82f6' }], isLoading: false });
  useTimeEntries.mockReturnValue({ data: [], isLoading: false });
});

describe('GoalsSummary', () => {
  test('shows "No goals set yet." when goals array is empty', () => {
    useGoals.mockReturnValue([]);

    render(<GoalsSummary />, { wrapper: createWrapper() });

    expect(screen.getByText(/No goals set yet/i)).toBeInTheDocument();
  });

  test('shows "Loading goals..." when goals is null/undefined', () => {
    useGoals.mockReturnValue(null);

    render(<GoalsSummary />, { wrapper: createWrapper() });

    expect(screen.getByText(/Loading goals/i)).toBeInTheDocument();
  });

  test('renders goal descriptions and progress', () => {
    useGoals.mockReturnValue([
      {
        id: 'g1',
        description: 'Learn React',
        targetHours: 20,
        projectId: 'proj-1',
        deadline: '2025-12-31',
        startDate: '2025-01-01',
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
      },
    ]);

    useTimeEntries.mockReturnValue({
      data: [
        { goalId: 'g1', duration: 36000 }, // 10 hours
      ],
      isLoading: false
    });

    render(<GoalsSummary />, { wrapper: createWrapper() });

    expect(screen.getByText(/Learn React/i)).toBeInTheDocument();
    expect(screen.getByText(/50%/i)).toBeInTheDocument();
  });

  test('renders multiple goals', () => {
    useGoals.mockReturnValue([
      { id: 'g1', description: 'Goal A', targetHours: 10, projectId: 'proj-1' },
      { id: 'g2', description: 'Goal B', targetHours: 5, projectId: 'proj-1' },
    ]);

    render(<GoalsSummary />, { wrapper: createWrapper() });

    expect(screen.getByText(/Goal A/i)).toBeInTheDocument();
    expect(screen.getByText(/Goal B/i)).toBeInTheDocument();
  });
});
