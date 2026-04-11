import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Mock routes to avoid importing ESM-only dependencies in deep tree during this smoke test
jest.mock('./AppRoutes', () => ({ __esModule: true, AppRoutes: () => <div data-testid="routes" /> }));
import App from './App';

test('renders app header', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
  expect(screen.getByText(/Momentum Planner/i)).toBeInTheDocument();
});
