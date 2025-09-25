import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

export type ProjectColor = 'rose' | 'amber' | 'mint' | 'sky' | 'violet' | 'lime' | 'teal' | 'crimson';

interface ProjectColorPickerProps {
  currentColor: ProjectColor;
  onColorChange: (color: ProjectColor) => void;
  children: React.ReactNode;
}

const PROJECT_COLORS: { name: ProjectColor; label: string; hsl: string }[] = [
  { name: 'rose', label: 'Rose', hsl: 'hsl(347 91% 60%)' },
  { name: 'amber', label: 'Amber', hsl: 'hsl(38 92% 50%)' },
  { name: 'mint', label: 'Mint', hsl: 'hsl(145 63% 49%)' },
  { name: 'sky', label: 'Sky', hsl: 'hsl(199 89% 48%)' },
  { name: 'violet', label: 'Violet', hsl: 'hsl(262 82% 58%)' },
  { name: 'lime', label: 'Lime', hsl: 'hsl(84 81% 44%)' },
  { name: 'teal', label: 'Teal', hsl: 'hsl(168 76% 42%)' },
  { name: 'crimson', label: 'Crimson', hsl: 'hsl(336 81% 51%)' },
];

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
      <PopoverContent className="w-48 p-2" align="start">
        <div className="grid grid-cols-4 gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorSelect(color.name)}
              className={`
                relative w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110
                ${currentColor === color.name
                  ? 'border-gray-600 shadow-lg'
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
              style={{ backgroundColor: color.hsl }}
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

// Helper function to get HSL color value for a project color
export function getProjectColorHSL(color: ProjectColor): string {
  const colorConfig = PROJECT_COLORS.find(c => c.name === color);
  return colorConfig?.hsl || 'hsl(199 89% 48%)'; // default to sky
}