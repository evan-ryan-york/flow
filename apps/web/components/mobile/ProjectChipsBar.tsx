'use client';

import { useRef, useState, useEffect } from 'react';
import { Project } from '@perfect-task-app/models';
import { getProjectColorHex, getProjectColorLightBackground } from '@perfect-task-app/ui/colors';

interface ProjectChipsBarProps {
  projects: Project[];
  visibleProjectIds: string[]; // Filled state chips
  selectedProjectId: string | null; // Selected project for new tasks (blue border)
  onVisibilityChange: (projectId: string, visible: boolean) => void;
  onProjectSelect: (projectId: string) => void; // Long-press to select
}

export function ProjectChipsBar({
  projects,
  visibleProjectIds,
  selectedProjectId,
  onVisibilityChange,
  onProjectSelect,
}: ProjectChipsBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // Check if scrollable and update fade indicators
  const updateFadeIndicators = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftFade(scrollLeft > 0);
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    updateFadeIndicators();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateFadeIndicators);
      window.addEventListener('resize', updateFadeIndicators);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', updateFadeIndicators);
      }
      window.removeEventListener('resize', updateFadeIndicators);
    };
  }, [projects]);

  // Handle chip click - toggles visibility
  const handleChipClick = (projectId: string) => {
    const isVisible = visibleProjectIds.includes(projectId);
    onVisibilityChange(projectId, !isVisible);
  };

  // Handle long-press start
  const handlePressStart = (projectId: string) => {
    const timer = setTimeout(() => {
      onProjectSelect(projectId);
    }, 500); // 500ms for long-press
    setLongPressTimer(timer);
  };

  // Handle long-press end
  const handlePressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // Get chip state
  const getChipState = (projectId: string): { visible: boolean; selected: boolean } => {
    return {
      visible: visibleProjectIds.includes(projectId),
      selected: projectId === selectedProjectId,
    };
  };

  // Get chip styles based on state and project color
  const getChipStyles = (visible: boolean, project: Project) => {
    const mainColor = getProjectColorHex(project.color || 'blue');
    const lightBg = getProjectColorLightBackground(project.color || 'blue');

    if (visible) {
      return {
        style: {
          backgroundColor: lightBg,
          color: mainColor,
          borderColor: mainColor,
        },
        className: 'border-2'
      };
    } else {
      return {
        style: {},
        className: 'border-2 border-gray-300 bg-white text-gray-700'
      };
    }
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="relative px-4 py-3 border-b border-gray-200">
      {/* Left fade indicator */}
      {showLeftFade && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
      )}

      {/* Scrollable chips container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {projects.map((project) => {
          const chipState = getChipState(project.id);
          const chipStyles = getChipStyles(chipState.visible, project);
          return (
            <button
              key={project.id}
              onClick={() => handleChipClick(project.id)}
              onTouchStart={() => handlePressStart(project.id)}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
              onMouseDown={() => handlePressStart(project.id)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              style={chipStyles.style}
              className={`
                px-4 py-2 rounded-full text-sm font-medium
                min-h-[44px] flex items-center justify-center
                whitespace-nowrap snap-center
                transition-all duration-200
                active:scale-95
                ${chipStyles.className}
              `}
              aria-pressed={chipState.visible}
              aria-label={`${project.name} project${chipState.selected ? ' (selected for new tasks)' : chipState.visible ? ' (visible)' : ''}`}
            >
              {project.name}
              {chipState.selected && (
                <span className="ml-1.5 text-xs">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right fade indicator */}
      {showRightFade && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
      )}

      {/* Hide scrollbar with custom CSS */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
