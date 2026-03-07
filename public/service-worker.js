let timerInterval;
let lastStatus = {};
let timeLeft = 25 * 60; // Initialize with default pomodoro time
let timerState = 'idle'; // idle, running, paused
let settings = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
};
let mode = 'pomodoro';
let pomodoros = 0;

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function sendStatus(force = false) {
  const current = { timeLeft, timerState, mode, pomodoros };
  if (
    !force &&
    lastStatus.timeLeft === current.timeLeft &&
    lastStatus.timerState === current.timerState &&
    lastStatus.mode === current.mode &&
    lastStatus.pomodoros === current.pomodoros
  ) {
    return; // No changes, skip
  }
  lastStatus = { ...current };

  console.log('[SW] sendStatus', current);
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'status', ...current });
    });
  });
}

function finishSession() {
    console.log('[SW] finishSession - completed', { mode, pomodoros });
    stopTimerInterval();
    timerState = 'idle';
    
    let notificationMessage = "Break's over! Time to focus.";
    let nextMode = 'pomodoro';
    
    if (mode === 'pomodoro') {
        pomodoros++;
        notificationMessage = "Pomodoro complete! Time for a break.";
        nextMode = pomodoros % settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
    }
    
    self.registration.showNotification(notificationMessage);
    resetTimer(nextMode, true); // auto-start next timer
}


function startTimer() {
  if (timerState === 'idle' || timerState === 'paused') {
    console.log('[SW] startTimer');
    // Always tear down any previous interval before starting a new one.
    stopTimerInterval();
    timerState = 'running';
    sendStatus(); // Immediately notify clients that timer is running
    timerInterval = setInterval(() => {
      if (timerState !== 'running') {
        stopTimerInterval();
        return;
      }
      timeLeft--;
      if (timeLeft < 0) { // Changed to < 0 to allow 0 to be displayed
        finishSession();
      } else {
        sendStatus();
      }
    }, 1000);
  }
}

function pauseTimer() {
  if (timerState === 'running') {
    console.log('[SW] pauseTimer');
    timerState = 'paused';
    stopTimerInterval();
    sendStatus();
  }
}

function resetTimer(newMode, autoStart = false) {
  console.log('[SW] resetTimer', { newMode, autoStart });
  stopTimerInterval();
  mode = newMode;
  timeLeft = (settings[mode] || 25) * 60;
  
  if (autoStart) {
      startTimer();
  } else {
      timerState = 'idle';
      sendStatus();
  }
}


self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const { command, data } = event.data;

  console.log('[SW] Received command:', command, 'with data:', data);

  switch (command) {
    case 'start':
      startTimer();
      break;
    case 'pause':
      pauseTimer();
      break;
    case 'reset':
      resetTimer(data.mode);
      break;
    case 'getStatus':
      sendStatus(true);
      break;
    case 'updateSettings':
      settings = { ...settings, ...data.settings };
      if (timerState === 'idle') {
        timeLeft = (settings[mode] || 25) * 60; // Only reset when idle
      }
      sendStatus();
      break;
    default:
      console.log('Received unknown command:', command);
  }
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});