import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { PROJECT_COLORS, ProjectColorName } from '../../colors';

export type ProjectColor = ProjectColorName;

interface ProjectColorPickerProps {
  currentColor: ProjectColor;
  onColorChange: (color: ProjectColor) => void;
  children: React.ReactNode;
}

export function ProjectColorPicker({ currentColor, onColorChange, children }: ProjectColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (color: ProjectColor) => {
    onColorChange(color);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="grid grid-cols-4 gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorSelect(color.name)}
              className={`
                relative w-10 h-10 rounded-full border-2 transition-all duration-200 hover:scale-110
                ${currentColor === color.name
                  ? 'border-gray-600 shadow-lg'
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
              style={{ backgroundColor: color.hex }}
              title={color.label}
            >
              {currentColor === color.name && (
                <div className="absolute inset-0 rounded-full border-2 border-white shadow-inner" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Re-export color helper functions from colors.ts for convenience
export { getProjectColorHex, getProjectColorLightBackground, getProjectColorConfig } from '../../colors';