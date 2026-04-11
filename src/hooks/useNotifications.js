import { useEffect } from 'react';
import { useEvents, useTasks } from './useAppData';

// Function to schedule a single notification for a specific time
// Keep track of scheduled notification timeouts so they can be canceled
const scheduledTimeouts = new Map();

export const scheduleNotification = (date, title, options, key) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('Notification permission not granted.');
    return null;
  }

  const now = new Date().getTime();
  const scheduledTime = new Date(date).getTime();
  const delay = scheduledTime - now;

  if (delay > 0) {
    // If a key is provided and an older timeout exists, clear it first
    if (key && scheduledTimeouts.has(key)) {
      clearTimeout(scheduledTimeouts.get(key));
      scheduledTimeouts.delete(key);
    }

    const timeoutId = setTimeout(() => {
      try {
        new Notification(title, options);
      } finally {
        if (key) scheduledTimeouts.delete(key);
      }
    }, delay);

    if (key) scheduledTimeouts.set(key, timeoutId);
    return timeoutId;
  }
  return null;
};

export const cancelScheduledNotification = (key) => {
  if (!key) return;
  const timeoutId = scheduledTimeouts.get(key);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledTimeouts.delete(key);
  }
};

export const cancelScheduledNotificationsByPrefix = (prefix) => {
  if (!prefix) return;
  Array.from(scheduledTimeouts.entries()).forEach(([key, id]) => {
    if (typeof key === 'string' && key.startsWith(prefix)) {
      clearTimeout(id);
      scheduledTimeouts.delete(key);
    }
  });
};

export const clearEventNotificationFlags = (eventId) => {
  if (!eventId) return;
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(`event-${eventId}-`)) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // ignore localStorage issues
  }
};

export const useNotifications = () => {
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useEvents();

  // Function to request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return Notification.permission;
  };

  useEffect(() => {
    if (!tasks || !events) return;
    if ('Notification' in window && Notification.permission !== 'granted') return;

    const checkNotifications = () => {
      const now = new Date();
      const currentTime = now.getTime();

      // Check for due tasks (within 15 minutes)
      tasks.forEach(task => {
        if (task.completed || !task.dueDate) return;
        
        const dueTime = new Date(task.dueDate).getTime();
        const timeDiff = dueTime - currentTime;
        
        // Notify 15 minutes before due time
        if (timeDiff > 0 && timeDiff <= 15 * 60 * 1000) {
          const notificationKey = `task-${task.id}-${task.dueDate}`;
          
          // Check if we've already shown this notification
          if (!localStorage.getItem(notificationKey)) {
            const taskName = task.text || 'Task';
            new Notification('Task Due Soon', {
              body: `"${taskName}" is due in ${Math.ceil(timeDiff / (1000 * 60))} minutes`,
              icon: '/favicon.ico',
              tag: notificationKey
            });
            
            // Mark this notification as shown
            localStorage.setItem(notificationKey, 'shown');
          }
        }
      });

      // Check for upcoming events (within 15 minutes)
      events.forEach(event => {
        if (!event.startTime) return;
        
        const eventTime = new Date(event.startTime).getTime();
        const timeDiff = eventTime - currentTime;
        
        // Notify 15 minutes before event time
        if (timeDiff > 0 && timeDiff <= 15 * 60 * 1000) {
          const notificationKey = `event-${event.id}-${event.startTime}`;
          
          // Check if we've already shown this notification
          if (!localStorage.getItem(notificationKey)) {
            new Notification('Event Starting Soon', {
              body: `"${event.title}" starts in ${Math.ceil(timeDiff / (1000 * 60))} minutes`,
              icon: '/favicon.ico',
              tag: notificationKey
            });
            
            // Mark this notification as shown
            localStorage.setItem(notificationKey, 'shown');
          }
        }
      });
    };

    // Check immediately
    checkNotifications();

    // Set up interval to check every minute
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [tasks, events]);

  // Clean up old notification flags (older than 24 hours)
  useEffect(() => {
    const cleanupOldNotifications = () => {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);

      keys.forEach(key => {
        if (key.startsWith('task-') || key.startsWith('event-')) {
          // Extract timestamp from key and clean up if old
          const parts = key.split('-');
          if (parts.length >= 3) {
            const timestamp = new Date(parts.slice(2).join('-')).getTime();
            if (timestamp < oneDayAgo) {
              localStorage.removeItem(key);
            }
          }
        }
      });
    };

    // Clean up on mount and then every hour
    cleanupOldNotifications();
    const cleanupInterval = setInterval(cleanupOldNotifications, 60 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    requestNotificationPermission,
    hasNotificationPermission: 'Notification' in window && Notification.permission === 'granted'
  };
}; 