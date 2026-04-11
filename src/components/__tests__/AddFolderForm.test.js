/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddFolderForm } from '../AddFolderForm';

jest.mock('../../api/apiClient', () => ({
  api: {
    projects: {
      list: jest.fn().mockResolvedValue([{ id: 'proj-1', name: 'Work' }]),
    },
  },
}));

jest.mock('../../db/folder-utils', () => ({
  createFolder: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { createFolder } from '../../db/folder-utils';
import toast from 'react-hot-toast';

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
});

describe('AddFolderForm', () => {
  test('renders input, project selector when no projectId, and submit button', () => {
    render(<AddFolderForm />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText('New folder name')).toBeInTheDocument();
    expect(screen.getByText('Add Folder')).toBeInTheDocument();
  });

  test('hides project selector when projectId is provided', () => {
    render(<AddFolderForm projectId="proj-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText('Project…')).not.toBeInTheDocument();
  });

  test('submitting with empty name shows toast error', async () => {
    render(<AddFolderForm projectId="proj-1" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Add Folder'));

    expect(toast.error).toHaveBeenCalledWith('Folder name required');
    expect(createFolder).not.toHaveBeenCalled();
  });

  test('submitting calls createFolder and clears input', async () => {
    createFolder.mockResolvedValue({ id: 42 });

    render(<AddFolderForm projectId="proj-1" />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('New folder name'), { target: { value: 'Docs' } });
    fireEvent.click(screen.getByText('Add Folder'));

    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Docs' }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Folder created');
    });

    expect(screen.getByPlaceholderText('New folder name').value).toBe('');
  });

  test('submit button is disabled when no projectId', () => {
    render(<AddFolderForm />, { wrapper: createWrapper() });
    const submitButton = screen.getByText('Add Folder').closest('button');
    expect(submitButton).toBeDisabled();
  });
});
