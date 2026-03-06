import { render, screen } from '@testing-library/react';
// Mock routes to avoid importing ESM-only dependencies in deep tree during this smoke test
jest.mock('./AppRoutes', () => ({ __esModule: true, AppRoutes: () => <div data-testid="routes" /> }));
import App from './App';

test('renders app header', () => {
  render(<App />);
  expect(screen.getByText(/Momentum Planner/i)).toBeInTheDocument();
});
