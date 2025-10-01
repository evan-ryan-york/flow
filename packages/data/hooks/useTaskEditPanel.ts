import { useState, useCallback } from 'react';

interface UseTaskEditPanelReturn {
  isOpen: boolean;
  selectedTaskId: string | null;
  openPanel: (taskId: string) => void;
  closePanel: () => void;
  switchTask: (taskId: string) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
}

/**
 * Hook for managing task edit panel state
 * Tracks open/closed state, selected task, and unsaved changes
 */
export const useTaskEditPanel = (): UseTaskEditPanelReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const openPanel = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setIsOpen(true);
    setHasUnsavedChanges(false);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setSelectedTaskId(null);
    setHasUnsavedChanges(false);
  }, []);

  const switchTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setHasUnsavedChanges(false);
  }, []);

  return {
    isOpen,
    selectedTaskId,
    openPanel,
    closePanel,
    switchTask,
    hasUnsavedChanges,
    setHasUnsavedChanges,
  };
};
