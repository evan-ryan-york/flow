'use client';

console.log('📦 ThreeColumnLayout MODULE loading - Step 1: Starting imports');

import { useState, useEffect } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';

console.log('📦 ThreeColumnLayout MODULE loading - Step 2: React imports done');

import { ProjectsPanel } from '@perfect-task-app/ui/custom';
import { TaskHub } from './TaskHub';
import { CalendarPanel } from './CalendarPanel';
import { ResizeHandle } from './ResizeHandle';
import { MobileTaskView } from './mobile/MobileTaskView';

console.log('📦 ThreeColumnLayout MODULE loading - Step 3: Component imports done');

import { useGeneralProject, useVisibleProjectIds, useUpdateVisibleProjectIds, useUserViews, useProjectsForUser, useDefaultView } from '@perfect-task-app/data';

console.log('📦 ThreeColumnLayout MODULE loaded at:', new Date().toISOString());

interface ThreeColumnLayoutProps {
  userId: string;
}

export function ThreeColumnLayout({ userId }: ThreeColumnLayoutProps) {
  console.log('🏗️  ThreeColumnLayout component rendering with userId:', userId);
  console.log('⏰ ThreeColumnLayout render time:', new Date().toISOString());

  console.log('🎣 About to call useState hooks in ThreeColumnLayout');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  console.log('✅ useState hooks completed in ThreeColumnLayout');

  // Load user's saved project visibility preferences
  console.log('🎣 About to call useGeneralProject');
  const { data: generalProject } = useGeneralProject(userId);
  console.log('✅ useGeneralProject completed:', { hasData: !!generalProject });

  console.log('🎣 About to call useVisibleProjectIds');
  const { data: visibleProjectIds, isLoading: isLoadingVisibleProjects } = useVisibleProjectIds(userId);
  console.log('✅ useVisibleProjectIds completed:', { hasData: !!visibleProjectIds, isLoading: isLoadingVisibleProjects });

  console.log('🎣 About to call useUpdateVisibleProjectIds');
  const updateVisibleProjectsMutation = useUpdateVisibleProjectIds();
  console.log('✅ useUpdateVisibleProjectIds completed');

  // Fetch user views to get active view data
  console.log('🎣 About to call useUserViews');
  const { data: userViews = [], isLoading: isLoadingViews } = useUserViews(userId);
  console.log('✅ useUserViews completed:', { count: userViews.length, isLoading: isLoadingViews });

  const activeView = userViews.find(v => v.id === selectedViewId);

  console.log('🎣 About to call useDefaultView');
  const defaultView = useDefaultView(userId);
  console.log('✅ useDefaultView completed:', { hasData: !!defaultView });

  // Fetch all projects to validate selectedProjectIds
  console.log('🎣 About to call useProjectsForUser');
  const { data: allProjects = [] } = useProjectsForUser(userId);
  console.log('✅ useProjectsForUser completed:', { count: allProjects.length });

  // Initialize with saved visible projects and selected view from localStorage
  useEffect(() => {
    // Wait for both visible projects and views to load before initializing
    if (!hasInitialized && !isLoadingVisibleProjects && !isLoadingViews && userViews.length > 0) {
      // Restore selected view from localStorage
      // eslint-disable-next-line no-undef
      const savedViewId = typeof localStorage !== 'undefined' ? localStorage.getItem(`selectedViewId_${userId}`) : null;

      console.log('[ThreeColumnLayout] Initializing view selection:', {
        savedViewId,
        userViewIds: userViews.map(v => v.id),
        userViewNames: userViews.map(v => v.name),
        defaultViewId: defaultView?.id,
      });

      if (savedViewId === 'none') {
        // User explicitly deselected view - keep it deselected
        console.log('[ThreeColumnLayout] ⭕ No view selected (user preference)');
        setSelectedViewId(null);
      } else if (savedViewId && userViews.some(v => v.id === savedViewId)) {
        // Use saved view if it exists
        console.log('[ThreeColumnLayout] ✅ Using saved view:', savedViewId);
        setSelectedViewId(savedViewId);
      } else if (defaultView) {
        // Fall back to default view for first-time users or if saved view no longer exists
        console.log('[ThreeColumnLayout] ⚠️ Falling back to default view:', defaultView.id);
        setSelectedViewId(defaultView.id);
      }

      if (visibleProjectIds && visibleProjectIds.length > 0) {
        setSelectedProjectIds(visibleProjectIds);
      } else if (generalProject) {
        setSelectedProjectIds([generalProject.id]);
      }
      setHasInitialized(true);
    }
  }, [generalProject, visibleProjectIds, isLoadingVisibleProjects, isLoadingViews, hasInitialized, userId, userViews, defaultView]);

  // Persist selected view to localStorage whenever it changes
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && hasInitialized) {
      if (selectedViewId) {
        // eslint-disable-next-line no-undef
        localStorage.setItem(`selectedViewId_${userId}`, selectedViewId);
        console.log('[ThreeColumnLayout] 💾 Saved view to localStorage:', selectedViewId);
      } else {
        // Save 'none' to indicate user explicitly deselected view
        // eslint-disable-next-line no-undef
        localStorage.setItem(`selectedViewId_${userId}`, 'none');
        console.log('[ThreeColumnLayout] 💾 Saved "no view selected" state to localStorage');
      }
    }
  }, [selectedViewId, userId, hasInitialized]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProjects, selectedProjectIds, userId]);

  // Sync project selection when active view changes
  useEffect(() => {
    if (activeView?.config.projectIds !== undefined) {
      // Empty array means "all projects" - select all available projects
      const projectsToSelect = activeView.config.projectIds.length === 0
        ? allProjects.map(p => p.id)
        : activeView.config.projectIds;

      setSelectedProjectIds(projectsToSelect);
      updateVisibleProjectsMutation.mutate({ projectIds: projectsToSelect, userId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView?.id, activeView?.config.projectIds, allProjects.length, userId]);

  // Save project selection changes to the database
  const handleProjectSelectionChange = (newProjectIds: string[]) => {
    console.log('[ThreeColumnLayout] handleProjectSelectionChange called with:', newProjectIds);
    setSelectedProjectIds(newProjectIds);
    updateVisibleProjectsMutation.mutate({ projectIds: newProjectIds, userId });

    // If a view is active and projects are manually changed, deselect the view
    if (activeView) {
      const viewProjectIds = activeView.config.projectIds.length === 0
        ? allProjects.map(p => p.id)  // Default view's empty array means "all projects"
        : activeView.config.projectIds;

      const isDifferent =
        newProjectIds.length !== viewProjectIds.length ||
        !newProjectIds.every(id => viewProjectIds.includes(id));

      if (isDifferent) {
        console.log('[ThreeColumnLayout] Projects changed, deselecting view');
        setSelectedViewId(null);
      }
    }
  };

  const handleViewChange = (viewId: string | null) => {
    setSelectedViewId(viewId);
  };

  console.log('✅ All hooks completed, about to render ThreeColumnLayout JSX');

  return (
    <>
      {/* Desktop View (≥ 1024px) */}
      <div className="hidden lg:flex h-screen bg-white">
        {/* Column 1: Projects/Navigation Panel - Keep Fixed */}
        <div className="w-48 border-r border-gray-200 flex-shrink-0">
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

      {/* Mobile View (< 1024px) */}
      <div className="block lg:hidden h-screen bg-white">
        <MobileTaskView
          userId={userId}
          selectedProjectIds={selectedProjectIds}
          onProjectSelectionChange={handleProjectSelectionChange}
        />
      </div>
    </>
  );
}