import { useState, useCallback, useRef, useEffect } from 'react';
import { generateTasks } from '../api/geminiClient';

export const useGeminiTaskify = () => {
  const [tasksTree, setTasksTree] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const timeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const run = useCallback((noteContent, options = {}) => {
    if (!noteContent?.trim()) return;
    setIsLoading(true);
    setError(null);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(async () => {
      try {
        const tree = await generateTasks(noteContent, undefined, options);
        if (isMountedRef.current) setTasksTree(tree);
      } catch (err) {
        console.error('Gemini taskify failed', err);
        if (isMountedRef.current) setError(err.message || 'Failed to generate tasks');
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    }, 500);
  }, []);

  const reset = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setTasksTree(null);
    setError(null);
    setIsLoading(false);
  };

  return { tasksTree, isLoading, error, run, reset };
}; 