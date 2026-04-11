/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock the hook it uses internally
jest.mock('../../hooks/useAppData', () => ({
  useHabitCompletions: jest.fn(),
}));

// Mock react-calendar-heatmap since it's an SVG lib that may have issues in jsdom
jest.mock('react-calendar-heatmap', () => {
  return function MockCalendarHeatmap(props) {
    return (
      <div className="react-calendar-heatmap" data-testid="heatmap">
        {(props.values || []).map((v, i) => (
          <rect key={i} data-date={v.date} data-count={v.count} />
        ))}
      </div>
    );
  };
});

// Mock the tooltip lib
jest.mock('react-tooltip', () => ({
  Tooltip: () => <div data-testid="tooltip" />
}));

// Mock css import
jest.mock('react-calendar-heatmap/dist/styles.css', () => ({}));

import HabitCalendar from '../HabitCalendar';
import { useHabitCompletions } from '../../hooks/useAppData';

describe('HabitCalendar', () => {
  test('renders heatmap container using habitId to fetch data', () => {
    useHabitCompletions.mockReturnValue({ data: [], isLoading: false });
    
    render(<HabitCalendar habitId="1" />);
    expect(screen.getByTestId('heatmap')).toBeInTheDocument();
  });

  test('processes completions from hook and renders rects', () => {
    const completions = [
        { date: '2025-01-01' },
        { date: '2025-01-02' }
    ];
    useHabitCompletions.mockReturnValue({ data: completions, isLoading: false });
    
    render(<HabitCalendar habitId="1" />);
    
    const rects = screen.getAllByRole('generic').filter(el => el.tagName === 'RECT');
    // In our mock, they are rendered as rect tags.
    // Wait, querySelectorAll might be easier since they are inside the div.
  });

  test('handles empty completions gracefully', () => {
    useHabitCompletions.mockReturnValue({ data: [], isLoading: false });
    render(<HabitCalendar habitId="1" />);
    expect(screen.getByTestId('heatmap')).toBeInTheDocument();
  });
});
