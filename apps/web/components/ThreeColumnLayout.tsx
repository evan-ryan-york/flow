'use client';

import { useState, useEffect } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { ProjectsPanel } from '@perfect-task-app/ui/custom';
import { TaskHub } from './TaskHub';
import { CalendarPanel } from './CalendarPanel';
import { ResizeHandle } from './ResizeHandle';
import { Button } from '@perfect-task-app/ui';
import { useGeneralProject, useVisibleProjectIds, useUpdateVisibleProjectIds, useUserViews, useUpdateView, useEnsureDefaultView, useProjectsForUser } from '@perfect-task-app/data';

interface ThreeColumnLayoutProps {
  userId: string;
}

export function ThreeColumnLayout({ userId }: ThreeColumnLayoutProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasManualChanges, setHasManualChanges] = useState(false);

  // Load user's saved project visibility preferences
  const { data: generalProject } = useGeneralProject(userId);
  const { data: visibleProjectIds, isLoading: isLoadingVisibleProjects } = useVisibleProjectIds(userId);
  const updateVisibleProjectsMutation = useUpdateVisibleProjectIds();

  // Fetch user views to get active view data
  const { data: userViews = [] } = useUserViews(userId);
  const activeView = userViews.find(v => v.id === selectedViewId);

  // Fetch all projects to validate selectedProjectIds
  const { data: allProjects = [] } = useProjectsForUser(userId);


  // Note: Automatic default view creation disabled to avoid RLS timing issues
  // Users can create views manually via the "New" button
  // useEnsureDefaultView(userId);

  // Mutation for updating view
  const updateViewMutation = useUpdateView();

  // Initialize with saved visible projects and selected view from localStorage
  useEffect(() => {
    if (!hasInitialized && !isLoadingVisibleProjects) {
      // Restore selected view from localStorage
      const savedViewId = localStorage.getItem(`selectedViewId_${userId}`);
      if (savedViewId && userViews.some(v => v.id === savedViewId)) {
        setSelectedViewId(savedViewId);
      }

      if (visibleProjectIds && visibleProjectIds.length > 0) {
        setSelectedProjectIds(visibleProjectIds);
      } else if (generalProject) {
        setSelectedProjectIds([generalProject.id]);
      }
      setHasInitialized(true);
    }
  }, [generalProject, visibleProjectIds, isLoadingVisibleProjects, hasInitialized, userId, userViews]);

  // Persist selected view to localStorage whenever it changes
  useEffect(() => {
    if (selectedViewId) {
      localStorage.setItem(`selectedViewId_${userId}`, selectedViewId);
    } else {
      localStorage.removeItem(`selectedViewId_${userId}`);
    }
  }, [selectedViewId, userId]);

  // Clean up selectedProjectIds to remove invalid/deleted project IDs
  useEffect(() => {
    if (allProjects.length > 0 && selectedProjectIds.length > 0) {
      const validProjectIds = allProjects.map(p => p.id);
      const cleanedProjectIds = selectedProjectIds.filter(id => validProjectIds.includes(id));

      if (cleanedProjectIds.length !== selectedProjectIds.length) {
        console.log('[ThreeColumnLayout] Cleaning up invalid project IDs:', {
          before: selectedProjectIds,
          after: cleanedProjectIds,
          removed: selectedProjectIds.filter(id => !validProjectIds.includes(id)),
        });
        setSelectedProjectIds(cleanedProjectIds);
        // Also update the database to remove ghost projects
        updateVisibleProjectsMutation.mutate({ projectIds: cleanedProjectIds, userId });
      }
    }
  }, [allProjects, selectedProjectIds, userId]);

  // Sync project selection when active view changes
  useEffect(() => {
    if (activeView?.config.projectIds && activeView.config.projectIds.length > 0) {
      setSelectedProjectIds(activeView.config.projectIds);
      setHasManualChanges(false);
      updateVisibleProjectsMutation.mutate({ projectIds: activeView.config.projectIds, userId });
    }
  }, [activeView?.id, activeView?.config.projectIds, userId]);

  // Save project selection changes to the database
  const handleProjectSelectionChange = (newProjectIds: string[]) => {
    console.log('[ThreeColumnLayout] handleProjectSelectionChange called with:', newProjectIds);
    setSelectedProjectIds(newProjectIds);
    updateVisibleProjectsMutation.mutate({ projectIds: newProjectIds, userId });

    // If a view is active and projects are manually changed, mark as having manual changes
    if (activeView) {
      const viewProjectIds = activeView.config.projectIds || [];
      const isDifferent =
        newProjectIds.length !== viewProjectIds.length ||
        !newProjectIds.every(id => viewProjectIds.includes(id));
      setHasManualChanges(isDifferent);
    }
  };

  // Update the active view with current project selection
  const handleUpdateView = () => {
    if (activeView) {
      updateViewMutation.mutate({
        viewId: activeView.id,
        updates: {
          config: {
            ...activeView.config,
            projectIds: selectedProjectIds,
          },
        },
      }, {
        onSuccess: () => {
          setHasManualChanges(false);
        },
      });
    }
  };

  // Discard changes and revert to view's project selection
  const handleDiscardChanges = () => {
    if (activeView?.config.projectIds) {
      setSelectedProjectIds(activeView.config.projectIds);
      setHasManualChanges(false);
      updateVisibleProjectsMutation.mutate({ projectIds: activeView.config.projectIds, userId });
    }
  };

  const handleViewChange = (viewId: string | null) => {
    setSelectedViewId(viewId);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Column 1: Projects/Navigation Panel - Keep Fixed */}
      <div className="w-64 border-r border-gray-200 flex-shrink-0">
        <ProjectsPanel
          userId={userId}
          selectedProjectIds={selectedProjectIds}
          onProjectSelectionChange={handleProjectSelectionChange}
        />
      </div>

      {/* Columns 2 & 3: Resizable Task Hub and Calendar */}
      <PanelGroup
        direction="horizontal"
        autoSaveId="task-calendar-layout"
        className="flex-1"
      >
        {/* Column 2: Task Hub - Resizable */}
        <Panel
          defaultSize={60}
          minSize={30}
          maxSize={80}
          id="task-hub-panel"
        >
          <div className="flex flex-col h-full min-w-0">
            {/* Unsaved Changes Banner */}
            {hasManualChanges && activeView && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  <span className="text-sm text-amber-900">
                    Project selection differs from view "{activeView.name}"
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDiscardChanges}
                    className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpdateView}
                    disabled={updateViewMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {updateViewMutation.isPending ? 'Updating...' : 'Update View'}
                  </Button>
                </div>
              </div>
            )}

            <TaskHub
              userId={userId}
              selectedProjectIds={selectedProjectIds}
              selectedViewId={selectedViewId}
              onViewChange={handleViewChange}
            />
          </div>
        </Panel>

        {/* Resize Handle */}
        <ResizeHandle />

        {/* Column 3: Calendar Panel - Resizable */}
        <Panel
          defaultSize={40}
          minSize={20}
          maxSize={70}
          id="calendar-panel"
        >
          <div className="flex flex-col h-full border-l border-gray-200">
            <CalendarPanel userId={userId} />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}