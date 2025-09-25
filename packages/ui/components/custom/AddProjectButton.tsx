import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Check, X } from 'lucide-react';

interface AddProjectButtonProps {
  onCreateProject: (name: string) => Promise<void>;
  isLoading: boolean;
}

export function AddProjectButton({ onCreateProject, isLoading }: AddProjectButtonProps) {
  const [isInputMode, setIsInputMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedValue = inputValue.trim();

    if (!trimmedValue) {
      setError('Project name is required');
      return;
    }

    if (trimmedValue.length > 50) {
      setError('Project name must be 50 characters or less');
      return;
    }

    try {
      await onCreateProject(trimmedValue);
      setInputValue('');
      setIsInputMode(false);
      setError(null);
    } catch (err) {
      setError('Failed to create project');
    }
  };

  const handleCancel = () => {
    setInputValue('');
    setIsInputMode(false);
    setError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  if (isInputMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Project name..."
            className="flex-1"
            autoFocus
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && (
          <div className="text-red-500 text-xs">{error}</div>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={() => setIsInputMode(true)}
      disabled={isLoading}
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Project
    </Button>
  );
}