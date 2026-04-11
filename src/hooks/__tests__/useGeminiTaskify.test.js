import { renderHook, act } from '@testing-library/react';

jest.mock('../../api/geminiClient', () => ({
  generateTasks: jest.fn(),
}));

import { useGeminiTaskify } from '../useGeminiTaskify';
import { generateTasks } from '../../api/geminiClient';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useGeminiTaskify', () => {
  test('initial state is idle', () => {
    const { result } = renderHook(() => useGeminiTaskify());
    expect(result.current.tasksTree).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('run() skips empty content', () => {
    const { result } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('');
    });

    expect(result.current.isLoading).toBe(false);
    expect(generateTasks).not.toHaveBeenCalled();
  });

  test('run() skips whitespace-only content', () => {
    const { result } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('   ');
    });

    expect(generateTasks).not.toHaveBeenCalled();
  });

  test('run() sets loading and resolves with task tree', async () => {
    const mockTree = [{ text: 'Task 1', children: [] }];
    generateTasks.mockResolvedValue(mockTree);

    const { result } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('Build a house');
    });

    expect(result.current.isLoading).toBe(true);

    // Advance past debounce
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(generateTasks).toHaveBeenCalledWith('Build a house', undefined, {});
    expect(result.current.tasksTree).toEqual(mockTree);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('run() handles API error and sets error state', async () => {
    generateTasks.mockRejectedValue(new Error('API failed'));

    const { result } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('Some note');
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.error).toBe('API failed');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.tasksTree).toBeNull();

    errorSpy.mockRestore();
  });

  test('run() passes options through', async () => {
    generateTasks.mockResolvedValue([]);

    const { result } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('Note', { enhance: true });
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(generateTasks).toHaveBeenCalledWith('Note', undefined, { enhance: true });
  });

  test('reset() clears all state', async () => {
    const mockTree = [{ text: 'Task' }];
    generateTasks.mockResolvedValue(mockTree);

    const { result } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('Content');
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.tasksTree).toEqual(mockTree);

    act(() => {
      result.current.reset();
    });

    expect(result.current.tasksTree).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test('debounces rapid calls (only last fires)', async () => {
    generateTasks.mockResolvedValue([{ text: 'Final' }]);

    const { result } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('First');
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    act(() => {
      result.current.run('Second');
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    // Only the second call should have fired
    expect(generateTasks).toHaveBeenCalledTimes(1);
    expect(generateTasks).toHaveBeenCalledWith('Second', undefined, {});
  });

  test('cleanup on unmount cancels pending timeout', () => {
    const { result, unmount } = renderHook(() => useGeminiTaskify());

    act(() => {
      result.current.run('Some content');
    });

    unmount();

    // Advance timers — the callback should not fire after unmount
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(generateTasks).not.toHaveBeenCalled();
  });
});
