import React, { createContext, useState, useContext, useCallback } from 'react';

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
    // ----- Multi-select tasks -----
    selectedTaskIds: new Set(),
    multiSelectMode: false,
  });

  const setState = useCallback((newState) => {
    setAppState((prev) => ({ ...prev, ...newState }));
  }, []);

  // ---- Selection helpers ----
  const addSelectedTask = (id) => {
    setAppState(prev => {
      const set = new Set(prev.selectedTaskIds);
      set.add(id);
      return { ...prev, selectedTaskIds: set };
    });
  };

  const removeSelectedTask = (id) => {
    setAppState(prev => {
      const set = new Set(prev.selectedTaskIds);
      set.delete(id);
      return { ...prev, selectedTaskIds: set };
    });
  };

  const clearSelection = () => setAppState(prev => ({ ...prev, selectedTaskIds: new Set(), multiSelectMode: false }));

  const toggleTaskSelection = (id) => {
    setAppState(prev => {
      const set = new Set(prev.selectedTaskIds);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...prev, selectedTaskIds: set };
    });
  };

  const value = {
    appState,
    setState,
    addSelectedTask,
    removeSelectedTask,
    clearSelection,
    toggleTaskSelection,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
