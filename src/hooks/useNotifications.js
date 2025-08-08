import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

// Function to schedule a single notification for a specific time
export const scheduleNotification = (date, title, options) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('Notification permission not granted.');
    return;
  }

  const now = new Date().getTime();
  const scheduledTime = new Date(date).getTime();
  const delay = scheduledTime - now;

  if (delay > 0) {
    setTimeout(() => {
      new Notification(title, options);
    }, delay);
  }
};

export const useNotifications = () => {
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const events = useLiveQuery(() => db.events.toArray());

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