import React, { createContext, useState, useContext } from 'react';

const AppContext = createContext();

export function useAppContext() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const initialActiveTimer = (() => {
    try {
      const stored = localStorage.getItem('activeTimer');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to parse activeTimer from localStorage', e);
      return null;
    }
  })();

  const [appState, setAppState] = useState({
    focusTaskId: null,
    showWeeklyReview: false,
    activeTimer: initialActiveTimer,
    activeGoalId: null,
    isModalOpen: false,
    modalEventData: null,
    calendarDate: new Date().toISOString(),
    calendarView: 'week',
    showUserGuide: false,
    eventToTrack: null,
  });

  const setState = (newState) => {
    setAppState((prev) => ({ ...prev, ...newState }));
  };

  const value = {
    appState,
    setState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
