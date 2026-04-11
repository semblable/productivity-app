/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddHabitForm } from '../AddHabitForm';

// Mock the hook specifically
jest.mock('../../hooks/useAppData', () => {
  return {
    useProjects: jest.fn().mockReturnValue({ data: [{ id: 'proj-1', name: 'Work' }], isLoading: false }),
    useHabitCompletions: jest.fn().mockReturnValue({ data: [], isLoading: false }),
    useTimeEntries: jest.fn().mockReturnValue({ data: [], isLoading: false }),
  };
});

jest.mock('../../api/apiClient', () => ({
  api: {
    tasks: {
      create: jest.fn(),
    },
    habits: {
      create: jest.fn(),
    },
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { useProjects } from '../../hooks/useAppData';
import { api } from '../../api/apiClient';

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
  // Ensure default return values
  useProjects.mockReturnValue({ data: [{ id: 'proj-1', name: 'Work' }], isLoading: false });
});

describe('AddHabitForm', () => {
  test('renders input and Add Habit button', () => {
    render(<AddHabitForm onHabitAdded={() => {}} />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText(/Name your new daily habit/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Habit/i)).toBeInTheDocument();
  });

  test('submitting with valid data calls API', async () => {
    api.tasks.create.mockResolvedValue({ id: 'task-1' });
    api.habits.create.mockResolvedValue({ id: 'habit-1' });

    render(<AddHabitForm onHabitAdded={() => {}} />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/Name your new daily habit/i);
    fireEvent.change(input, { target: { value: 'Drink water' } });
    fireEvent.click(screen.getByText(/Add Habit/i));

    await waitFor(() => {
      expect(api.tasks.create).toHaveBeenCalled();
      expect(api.habits.create).toHaveBeenCalled();
    });
  });
});
