/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddTaskForm } from '../AddTaskForm';

jest.mock('../../api/apiClient', () => ({
  api: {
    tasks: {
      create: jest.fn(),
    },
    goals: {
      get: jest.fn(),
    },
  },
}));

import { api } from '../../api/apiClient';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AddTaskForm', () => {
  test('renders input and submit button', () => {
    render(<AddTaskForm projectId={1} />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText(/Add new task/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Task/i)).toBeInTheDocument();
  });

  test('submitting with empty text does not call create', async () => {
    render(<AddTaskForm projectId={1} />, { wrapper: createWrapper() });
    
    const submitButton = screen.getByText(/Add Task/i);
    fireEvent.click(submitButton);

    expect(api.tasks.create).not.toHaveBeenCalled();
  });

  test('submitting with text calls create API and clears input', async () => {
    api.tasks.create.mockResolvedValue({ id: '1' });
    
    render(<AddTaskForm projectId={1} />, { wrapper: createWrapper() });
    
    const input = screen.getByPlaceholderText(/Add new task/i);

    fireEvent.change(input, { target: { value: 'Buy groceries' } });
    expect(input.value).toBe('Buy groceries');

    const submitButton = screen.getByText(/Add Task/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(api.tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Buy groceries' }),
      );
    });

    await waitFor(() => {
      expect(input.value).toBe('');
    }, { timeout: 2000 });
  });

  test('renders project and priority selects', () => {
    render(<AddTaskForm projectId={1} projects={[{ id: 1, name: 'Work' }]} />, { wrapper: createWrapper() });
    expect(screen.getByText(/No Project/i)).toBeInTheDocument();
    expect(screen.getByText(/None/i)).toBeInTheDocument(); // priority
  });
});
