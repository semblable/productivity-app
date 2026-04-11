/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataTools } from '../DataTools';

jest.mock('../../api/apiClient', () => ({
  api: {
    exportData: jest.fn(),
    migrateData: jest.fn(),
    clearData: jest.fn(),
  },
}));

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
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => 'DELETE');
  
  // Mock URL methods
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = jest.fn();
});

describe('DataTools', () => {
  test('renders action buttons', () => {
    render(<DataTools onShowReview={() => {}} />, { wrapper: createWrapper() });
    expect(screen.getByText(/Export Backup/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear Database/i)).toBeInTheDocument();
  });

  test('calls API when exporting backup', async () => {
    api.exportData.mockResolvedValue({ tables: {} });
    
    render(<DataTools />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText(/Export Backup/i));

    await waitFor(() => {
      expect(api.exportData).toHaveBeenCalled();
    });
  });

  test('calls API when clearing database', async () => {
    api.clearData.mockResolvedValue({});
    
    render(<DataTools />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText(/Clear Database/i));

    await waitFor(() => {
      expect(api.clearData).toHaveBeenCalled();
    });
  });
});
