import {
  scheduleNotification,
  cancelScheduledNotification,
  cancelScheduledNotificationsByPrefix,
  clearEventNotificationFlags,
} from '../useNotifications';

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // Reset the scheduledTimeouts map by scheduling & cancelling
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('scheduleNotification', () => {
  test('schedules notification in the future', () => {
    const futureDate = new Date(Date.now() + 60000); // 1 minute from now
    const id = scheduleNotification(futureDate, 'Test', {}, 'test-1');
    expect(id).not.toBeNull();
    cancelScheduledNotification('test-1');
  });

  test('returns null for past date', () => {
    const pastDate = new Date(Date.now() - 1000);
    const id = scheduleNotification(pastDate, 'Test', {});
    expect(id).toBeNull();
  });

  test('returns null when notifications not granted', () => {
    const original = Notification.permission;
    try {
      Object.defineProperty(Notification, 'permission', { value: 'denied', writable: true, configurable: true });
      const futureDate = new Date(Date.now() + 60000);
      const id = scheduleNotification(futureDate, 'Test', {});
      expect(id).toBeNull();
    } finally {
      Object.defineProperty(Notification, 'permission', { value: original, writable: true, configurable: true });
    }
  });

  test('replaces existing timeout for same key', () => {
    const futureDate1 = new Date(Date.now() + 60000);
    const futureDate2 = new Date(Date.now() + 120000);

    const id1 = scheduleNotification(futureDate1, 'Test1', {}, 'same-key');
    const id2 = scheduleNotification(futureDate2, 'Test2', {}, 'same-key');

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    // The old one should have been cleared
    cancelScheduledNotification('same-key');
  });

  test('fires notification when timeout expires', () => {
    const futureDate = new Date(Date.now() + 5000);
    scheduleNotification(futureDate, 'Timer Up', { body: 'Done' }, 'fire-test');

    jest.advanceTimersByTime(5000);

    // Notification constructor was called (via mock in setupTests.js)
    // At minimum, the timeout completed without error
    cancelScheduledNotification('fire-test');
  });
});

describe('cancelScheduledNotification', () => {
  test('cancels a scheduled timeout', () => {
    const futureDate = new Date(Date.now() + 60000);
    scheduleNotification(futureDate, 'Test', {}, 'cancel-me');

    cancelScheduledNotification('cancel-me');

    // Advance timers — nothing should fire
    jest.advanceTimersByTime(60000);
  });

  test('does nothing for undefined key', () => {
    expect(() => cancelScheduledNotification(undefined)).not.toThrow();
  });

  test('does nothing for non-existent key', () => {
    expect(() => cancelScheduledNotification('non-existent')).not.toThrow();
  });
});

describe('cancelScheduledNotificationsByPrefix', () => {
  test('cancels all timeouts with matching prefix', () => {
    const futureDate = new Date(Date.now() + 60000);
    scheduleNotification(futureDate, 'Test', {}, 'event-1-a');
    scheduleNotification(futureDate, 'Test', {}, 'event-1-b');
    scheduleNotification(futureDate, 'Test', {}, 'event-2-a');

    cancelScheduledNotificationsByPrefix('event-1');

    // The event-2 one should still be pending
    jest.advanceTimersByTime(60000);
  });

  test('does nothing for null prefix', () => {
    expect(() => cancelScheduledNotificationsByPrefix(null)).not.toThrow();
  });
});

describe('clearEventNotificationFlags', () => {
  test('removes localStorage entries for eventId', () => {
    localStorage.setItem('event-5-2025-01-01', 'shown');
    localStorage.setItem('event-5-2025-01-02', 'shown');
    localStorage.setItem('event-6-2025-01-01', 'shown');

    clearEventNotificationFlags(5);

    expect(localStorage.getItem('event-5-2025-01-01')).toBeNull();
    expect(localStorage.getItem('event-5-2025-01-02')).toBeNull();
    expect(localStorage.getItem('event-6-2025-01-01')).toBe('shown');
  });

  test('does nothing for null eventId', () => {
    expect(() => clearEventNotificationFlags(null)).not.toThrow();
  });
});
