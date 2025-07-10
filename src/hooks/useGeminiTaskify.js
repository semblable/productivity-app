import { useState, useCallback, useRef } from 'react';
import { generateTasks } from '../api/geminiClient';

// A simple debounce implementation
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

export const useGeminiTaskify = () => {
  const [tasksTree, setTasksTree] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Using useRef to hold the debounced function to prevent re-creation on each render
  const debouncedGenerateTasks = useRef(
    debounce(async (noteContent, options) => {
      try {
        const tree = await generateTasks(noteContent, undefined, options);
        setTasksTree(tree);
      } catch (err) {
        console.error('Gemini taskify failed', err);
        setError(err.message || 'Failed to generate tasks');
      } finally {
        setIsLoading(false);
      }
    }, 500) // 500ms debounce delay
  ).current;

  const run = useCallback((noteContent, options = {}) => {
    if (!noteContent?.trim()) return;
    setIsLoading(true);
    setError(null);
    debouncedGenerateTasks(noteContent, options);
  }, [debouncedGenerateTasks]);

  const reset = () => {
    setTasksTree(null);
    setError(null);
    setIsLoading(false);
  };

  return { tasksTree, isLoading, error, run, reset };
}; 