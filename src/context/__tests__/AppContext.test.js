import React from 'react';
import { render, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { AppProvider, useAppContext } from '../AppContext';

beforeEach(() => {
  localStorage.clear();
});

describe('AppContext', () => {
  test('AppProvider renders children', () => {
    const { getByText } = render(
      <AppProvider><span>Hello</span></AppProvider>
    );
    expect(getByText('Hello')).toBeInTheDocument();
  });

  test('setState merges partial state', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.setState({ focusTaskId: 'task-42' });
    });

    expect(result.current.appState.focusTaskId).toBe('task-42');
    // Other state should remain unchanged
    expect(result.current.appState.showWeeklyReview).toBe(false);
  });

  test('addSelectedTask adds to set', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.addSelectedTask('t1');
      result.current.addSelectedTask('t2');
    });

    expect(result.current.appState.selectedTaskIds.has('t1')).toBe(true);
    expect(result.current.appState.selectedTaskIds.has('t2')).toBe(true);
  });

  test('removeSelectedTask removes from set', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.addSelectedTask('t1');
      result.current.addSelectedTask('t2');
    });

    act(() => {
      result.current.removeSelectedTask('t1');
    });

    expect(result.current.appState.selectedTaskIds.has('t1')).toBe(false);
    expect(result.current.appState.selectedTaskIds.has('t2')).toBe(true);
  });

  test('toggleTaskSelection toggles', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.toggleTaskSelection('t1');
    });
    expect(result.current.appState.selectedTaskIds.has('t1')).toBe(true);

    act(() => {
      result.current.toggleTaskSelection('t1');
    });
    expect(result.current.appState.selectedTaskIds.has('t1')).toBe(false);
  });

  test('clearSelection empties set and disables multiSelect', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.addSelectedTask('t1');
      result.current.setState({ multiSelectMode: true });
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.appState.selectedTaskIds.size).toBe(0);
    expect(result.current.appState.multiSelectMode).toBe(false);
  });

  test('activeTimer initializes from localStorage', () => {
    const timer = { startedAt: '2025-01-01T00:00:00Z', description: 'Work' };
    localStorage.setItem('activeTimer', JSON.stringify(timer));

    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    expect(result.current.appState.activeTimer).toEqual(timer);
  });

  test('activeTimer defaults to null when localStorage is empty', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    expect(result.current.appState.activeTimer).toBeNull();
  });

  test('activeTimer defaults to null when localStorage has invalid JSON', () => {
    localStorage.setItem('activeTimer', '{invalid-json}');

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    expect(result.current.appState.activeTimer).toBeNull();
    consoleSpy.mockRestore();
  });
});
