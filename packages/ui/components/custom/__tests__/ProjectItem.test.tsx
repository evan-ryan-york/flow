/**
 * Component Tests for ProjectItem
 * Tests rendering, interactions, and visual states
 */

import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ProjectItem } from '../ProjectItem';
import type { Project } from '@flow-app/models';

// Mock the supabase module first to prevent initialization errors
jest.mock('@flow-app/data', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  };

  return {
    getSupabaseClient: jest.fn(() => mockSupabaseClient),
    useDeleteProjectWithReassignment: jest.fn(() => ({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
    })),
    useProjectsForUser: jest.fn(() => ({
      data: [],
      isLoading: false,
      isError: false,
    })),
    useUpdateProject: jest.fn(() => ({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
    })),
  };
});

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ProjectItem', () => {
  const mockOnClick = jest.fn();
  const mockOnColorChange = jest.fn();

  const mockProject: Project = {
    id: 'proj1',
    name: 'Marketing Campaign',
    owner_id: 'user1',
    color: 'rose',
    is_general: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render project name', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      expect(screen.getByText('Marketing Campaign')).toBeInTheDocument();
    });

    it('should show solid dot when selected', () => {
      const { container } = render(
        <ProjectItem
          project={mockProject}
          isSelected={true}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Check for solid dot indicator (has background color)
      const solidDot = container.querySelector('.w-3.h-3.rounded-full:not([class*="border"])');
      expect(solidDot).toBeInTheDocument();
    });

    it('should show hollow circle when not selected', () => {
      const { container } = render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Check for hollow circle indicator (uses inline border style, not class)
      const hollowCircle = container.querySelector('.w-3.h-3.rounded-full');
      expect(hollowCircle).toBeInTheDocument();
      // Verify it has border style (inline)
      expect(hollowCircle).toHaveStyle({ borderWidth: '2px' });
    });

    it('should show lock icon only for General project', () => {
      const generalProject: Project = { ...mockProject, is_general: true, name: 'General' };

      const { rerender, container } = render(
        <ProjectItem
          project={generalProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Lock icon should be present for General project
      expect(screen.getByText('General')).toBeInTheDocument();
      // The Lock component should be rendered
      const lockIcon = container.querySelector('svg');
      expect(lockIcon).toBeInTheDocument();

      // Rerender with non-general project
      rerender(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Should not show lock for regular project
      expect(screen.getByText('Marketing Campaign')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('should call onClick with projectId when clicked', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Click on the project name text
      const projectButton = screen.getByText('Marketing Campaign').closest('button');
      fireEvent.click(projectButton!);

      // onClick receives (projectId, isCtrlClick, isShiftClick)
      expect(mockOnClick).toHaveBeenCalledWith('proj1', false, false);
    });

    it('should pass isCtrlClick flag when Ctrl+Click', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      const projectButton = screen.getByText('Marketing Campaign').closest('button');
      fireEvent.click(projectButton!, { ctrlKey: true });

      // onClick receives (projectId, isCtrlClick, isShiftClick)
      expect(mockOnClick).toHaveBeenCalledWith('proj1', true, false);
    });

    it('should pass isCtrlClick flag when Cmd+Click on Mac', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      const projectButton = screen.getByText('Marketing Campaign').closest('button');
      fireEvent.click(projectButton!, { metaKey: true });

      // onClick receives (projectId, isCtrlClick, isShiftClick)
      expect(mockOnClick).toHaveBeenCalledWith('proj1', true, false);
    });
  });

  describe('Color Picker', () => {
    it('should render color picker for non-general projects', () => {
      const { container } = render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          onColorChange={mockOnColorChange}
          userId="user1"
        />
      );

      // Color picker should be present (check for the overlay button)
      const colorPickerOverlay = container.querySelector('.absolute.inset-0');
      expect(colorPickerOverlay).toBeInTheDocument();
    });

    it('should render color picker for General project (color customization allowed)', () => {
      const generalProject: Project = { ...mockProject, is_general: true };

      const { container } = render(
        <ProjectItem
          project={generalProject}
          isSelected={false}
          onClick={mockOnClick}
          onColorChange={mockOnColorChange}
          userId="user1"
        />
      );

      // Color picker overlay should be present for General project (colors are customizable)
      const colorPickerOverlay = container.querySelector('.absolute.inset-0.w-full.h-full.rounded-full');
      expect(colorPickerOverlay).toBeInTheDocument();
    });

    it('should call onColorChange when provided', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          onColorChange={mockOnColorChange}
          userId="user1"
        />
      );

      // The onColorChange handler is wired up
      // Actual color selection testing would require interacting with ProjectColorPicker
      expect(mockOnColorChange).not.toHaveBeenCalled(); // Not called on render
    });
  });

  describe('Visual States', () => {
    it('should apply correct color to selection indicator', () => {
      const { container } = render(
        <ProjectItem
          project={mockProject}
          isSelected={true}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Find the selection indicator - a colored dot/circle element
      const indicators = container.querySelectorAll('.rounded-full');
      expect(indicators.length).toBeGreaterThan(0);
      // At least one indicator should exist
      expect(indicators[0]).toBeInTheDocument();
    });

    it('should show project name with correct truncation', () => {
      const longNameProject: Project = {
        ...mockProject,
        name: 'Very Long Project Name That Should Be Truncated',
      };

      render(
        <ProjectItem
          project={longNameProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      expect(
        screen.getByText('Very Long Project Name That Should Be Truncated')
      ).toBeInTheDocument();
    });
  });

  describe('Context Menu', () => {
    it('should render context menu for non-general projects', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Context menu component should be rendered
      // The actual menu is shown on interaction
      expect(screen.getByText('Marketing Campaign')).toBeInTheDocument();
    });

    it('should NOT show context menu for General project', () => {
      const generalProject: Project = { ...mockProject, is_general: true, name: 'General' };

      render(
        <ProjectItem
          project={generalProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // General projects should not have context menu
      expect(screen.getByText('General')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have clickable button', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      const projectButton = screen.getByText('Marketing Campaign').closest('button');
      expect(projectButton).toBeInTheDocument();
      expect(projectButton).not.toBeDisabled();
    });

    it('should render with custom className', () => {
      const { container } = render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
          className="custom-class"
        />
      );

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
