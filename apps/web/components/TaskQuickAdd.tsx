"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Project } from "@perfect-task-app/models";
import {
  useCreateTask,
  useProjectsForUser,
  useLastUsedProject,
  useGeneralProject,
  useProjectDefinitions,
  useSetPropertyValue,
  useAllProfiles,
} from "@perfect-task-app/data";
import { ProjectChip } from "@perfect-task-app/ui/components/custom";
import { Input } from "@perfect-task-app/ui/components/ui/input";
import { Button } from "@perfect-task-app/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@perfect-task-app/ui";
import { Calendar as CalendarIcon, User, NavArrowDown } from "iconoir-react";
import { format } from "date-fns";
import { CustomPropertyManager } from "@perfect-task-app/ui/components/custom/CustomPropertyManager";
import { parseTaskInput, cleanTaskName } from "@perfect-task-app/ui/lib/textParser";

interface TaskQuickAddProps {
  userId: string;
  defaultProjectId: string;
}

export function TaskQuickAdd({ userId, defaultProjectId }: TaskQuickAddProps) {
  const [taskName, setTaskName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dueDate, setDueDate] = useState<string>("");
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [assignedUser, setAssignedUser] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isManualProjectSelection, setIsManualProjectSelection] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [customPropertyValues, setCustomPropertyValues] = useState<Record<string, string>>({});
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [showCustomPropertyManager, setShowCustomPropertyManager] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { data: projectsData = [] } = useProjectsForUser(userId);

  // Stabilize projects array to prevent unnecessary re-renders
  const projects = useMemo(() => projectsData, [projectsData]);
  const { data: lastUsedProjectId } = useLastUsedProject();
  const { data: generalProject } = useGeneralProject(userId);
  const { data: customProperties = [] } = useProjectDefinitions(selectedProject?.id || "");
  const { data: allProfiles = [] } = useAllProfiles();
  const createTaskMutation = useCreateTask();
  const setPropertyValueMutation = useSetPropertyValue();

  // Set default project based on sticky behavior - only when not manually overridden
  useEffect(() => {
    // Don't override manual project selections
    if (isManualProjectSelection) {
      return;
    }

    if (lastUsedProjectId && projects && projects.length > 0) {
      const lastUsedProject = projects.find((p) => p.id === lastUsedProjectId);
      if (lastUsedProject && (!selectedProject || selectedProject.id !== lastUsedProject.id)) {
        setSelectedProject(lastUsedProject);
      }
    } else if (generalProject && (!selectedProject || selectedProject.id !== generalProject.id)) {
      setSelectedProject(generalProject);
    }
  }, [lastUsedProjectId, projects?.length, generalProject?.id, isManualProjectSelection]);

  // Set default assignee to current user
  useEffect(() => {
    if (!assignedUser) {
      setAssignedUser(userId);
    }
  }, [userId, assignedUser]);

  // Clear custom property values when project changes
  useEffect(() => {
    setCustomPropertyValues({});
  }, [selectedProject?.id]);

  // Filter projects based on query using useMemo to prevent infinite re-renders
  const filteredProjects = useMemo(() => {
    if (showAutocomplete) {
      // If no query yet (just typed "/in"), show all projects
      if (!projectQuery || projectQuery.trim() === "") {
        return projects.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Filter projects based on query
      const query = projectQuery.toLowerCase().trim();
      const filtered = projects
        .filter((project) => project.name.toLowerCase().includes(query))
        .sort((a, b) => {
          // Prioritize projects that start with the query
          const aStartsWith = a.name.toLowerCase().startsWith(query);
          const bStartsWith = b.name.toLowerCase().startsWith(query);

          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;

          // Then sort by name length (shorter names first for better matches)
          return a.name.length - b.name.length;
        });

      return filtered;
    }

    return [];
  }, [projectQuery, showAutocomplete, projects]);

  // Reset selected index when filtered projects change
  useEffect(() => {
    setSelectedProjectIndex(0);
  }, [filteredProjects.length]);

  const handleInputChange = (value: string) => {
    // Auto-add space after /in if user just typed "/in" without space
    let processedValue = value;
    if (value.endsWith("/in") && !value.endsWith("/in ")) {
      processedValue = value + " ";
      setTaskName(processedValue);
    } else {
      setTaskName(value);
    }

    // Simple /in detection
    const hasInCommand = processedValue.includes("/in "); // Note: now looking for "/in " with space

    if (hasInCommand) {
      const parts = processedValue.split("/in "); // Split on "/in " with space
      const query = parts[1] || ""; // Don't trim here - let user see their exact typing

      setShowAutocomplete(true);
      setProjectQuery(query);
    } else {
      setShowAutocomplete(false);
      setProjectQuery("");
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setIsManualProjectSelection(true); // Mark as manual selection
    setShowAutocomplete(false);

    // Clean up the task name - remove "/in [query]" part
    let cleanName = taskName;
    if (taskName.includes("/in ")) {
      cleanName = taskName.split("/in ")[0].trim();
    }
    setTaskName(cleanName);
    setProjectQuery("");

    // Clear custom property values when project changes
    setCustomPropertyValues({});

    // Focus back to input
    inputRef.current?.focus();
  };

  const handleProjectRemove = () => {
    setSelectedProject(null);
    // Don't restore the /in command - just leave the clean task name
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clean task name by removing /in command if present
    let cleanName = taskName;
    if (taskName.includes("/in ")) {
      cleanName = taskName.split("/in ")[0].trim();
    }

    if (!cleanName.trim()) {
      return;
    }

    // Determine project ID: selected project > last used > general > default
    const projectId = selectedProject?.id || lastUsedProjectId || generalProject?.id || defaultProjectId;

    const taskData = {
      name: cleanName,
      project_id: projectId,
      assigned_to: assignedUser || userId,
      created_by: userId,
      due_date: dueDate || undefined,
    };

    try {
      const newTask = await createTaskMutation.mutateAsync(taskData);

      // Save custom property values if any are set
      const customPropertyEntries = Object.entries(customPropertyValues).filter(([_, value]) => value.trim());
      if (customPropertyEntries.length > 0) {
        console.log("Setting custom properties for new task:", newTask.id, customPropertyEntries);
        await Promise.all(
          customPropertyEntries.map(([definitionId, value]) =>
            setPropertyValueMutation.mutateAsync({
              taskId: newTask.id,
              definitionId,
              value: value.trim(),
              userId,
            }),
          ),
        );
        console.log("Custom properties set successfully");
      }

      // Reset form but keep sticky project behavior
      setTaskName("");
      setDueDate("");
      setShowDueDatePicker(false);
      setAssignedUser(userId); // Reset to current user
      setCustomPropertyValues({});
      setShowAdvanced(false);
      setShowAutocomplete(false);
      setProjectQuery("");
      setIsManualProjectSelection(false); // Reset manual flag to allow sticky behavior
      // Note: selectedProject is intentionally kept for sticky behavior
      // The backend will update lastUsedProjectId automatically
    } catch (error) {
      console.error("Failed to create task:", error);
      // TODO: Show error message to user
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts for autocomplete
    if (showAutocomplete && filteredProjects.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedProjectIndex((prev) => (prev + 1) % filteredProjects.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedProjectIndex((prev) => (prev - 1 + filteredProjects.length) % filteredProjects.length);
          break;
        case "Tab":
        case "Enter":
          e.preventDefault();
          if (filteredProjects[selectedProjectIndex]) {
            handleProjectSelect(filteredProjects[selectedProjectIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowAutocomplete(false);
          setProjectQuery("");
          break;
        default:
          // Allow typing to continue
          break;
      }
    } else if (e.key === "Enter") {
      // Explicitly handle Enter key when autocomplete is not open
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="space-y-3" data-testid="task-quick-add">
      <form onSubmit={handleSubmit} role="form">
        {/* Main Input with Project Chip */}
        <div className="relative">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="text"
                value={taskName}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a task..."
                className="pr-2"
                data-testid="task-input"
              />

              {/* Project Chip */}
              {selectedProject && !showAutocomplete && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <ProjectChip
                    project={selectedProject}
                    onRemove={handleProjectRemove}
                    onProjectSelect={handleProjectSelect}
                    projects={projects}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-2"
              title="Advanced options"
            >
              <NavArrowDown className="w-4 h-4" />
            </Button>

            <Button
              type="submit"
              disabled={!cleanTaskName(taskName).trim() || createTaskMutation.isPending}
              className="min-w-[80px]"
            >
              {createTaskMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>

          {/* Custom Project Autocomplete */}
          {showAutocomplete && filteredProjects.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-auto">
              <div className="p-2">
                <div className="space-y-1">
                  {filteredProjects.map((project, index) => (
                    <div
                      key={project.id}
                      onClick={() => handleProjectSelect(project)}
                      className={`cursor-pointer px-3 py-2 rounded-md hover:bg-gray-100 transition-colors ${
                        index === selectedProjectIndex ? "bg-blue-50 border border-blue-200" : ""
                      }`}
                      data-selected={index === selectedProjectIndex}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            project.color === "rose"
                              ? "bg-rose-500"
                              : project.color === "amber"
                                ? "bg-amber-500"
                                : project.color === "mint"
                                  ? "bg-emerald-500"
                                  : project.color === "sky"
                                    ? "bg-sky-500"
                                    : project.color === "violet"
                                      ? "bg-violet-500"
                                      : project.color === "lime"
                                        ? "bg-lime-500"
                                        : project.color === "teal"
                                          ? "bg-teal-500"
                                          : project.color === "crimson"
                                            ? "bg-red-600"
                                            : "bg-gray-500"
                          }`}
                        />
                        <span className="text-sm font-medium">{project.name}</span>
                        {index === selectedProjectIndex && (
                          <span className="ml-auto text-xs text-blue-600">Press Tab</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty state for /in command with no matches */}
          {showAutocomplete && projectQuery && filteredProjects.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
              <div className="p-3 text-sm text-gray-500 text-center">No projects found matching "{projectQuery}"</div>
            </div>
          )}
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-4">
            {/* Chips Row */}
            <div className="flex gap-2 flex-wrap">
              {/* Due Date Chip */}
              <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      dueDate
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>{dueDate ? format(new Date(dueDate), "MMM d") : "Due"}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      {dueDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setDueDate("");
                            setShowDueDatePicker(false);
                          }}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowDueDatePicker(false)}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Assigned To Chip */}
              <Popover open={showUserPicker} onOpenChange={setShowUserPicker}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      assignedUser && assignedUser !== userId
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>
                      {assignedUser === userId || !assignedUser
                        ? "Assigned: You"
                        : `Assigned: ${allProfiles.find((p) => p.id === assignedUser)?.first_name || "Unknown"}`}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Assign to</label>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {/* Current User (Default) */}
                      <button
                        type="button"
                        onClick={() => {
                          setAssignedUser(userId);
                          setShowUserPicker(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center gap-2 ${
                          assignedUser === userId ? "bg-blue-50 border border-blue-200" : ""
                        }`}
                      >
                        <User className="w-4 h-4" />
                        <span>You (default)</span>
                        {assignedUser === userId && <span className="ml-auto text-blue-600 text-xs">✓</span>}
                      </button>

                      {/* Other Users */}
                      {allProfiles
                        .filter((profile) => profile.id !== userId)
                        .map((profile) => (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => {
                              setAssignedUser(profile.id);
                              setShowUserPicker(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center gap-2 ${
                              assignedUser === profile.id ? "bg-blue-50 border border-blue-200" : ""
                            }`}
                          >
                            <User className="w-4 h-4" />
                            <span>{profile.first_name || profile.last_name || "Unknown User"}</span>
                            {assignedUser === profile.id && <span className="ml-auto text-blue-600 text-xs">✓</span>}
                          </button>
                        ))}

                      {allProfiles.length === 0 && (
                        <div className="text-xs text-gray-500 p-2">No other users found</div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Custom Property Chips */}
              {customProperties.map((property) => {
                const value = customPropertyValues[property.id] || "";
                const hasValue = value.trim() !== "";

                return (
                  <Popover key={property.id}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                          hasValue
                            ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <span>
                          {property.name}:{" "}
                          {hasValue
                            ? property.type === "date" && value
                              ? format(new Date(value), "MMM d")
                              : value.length > 10
                                ? `${value.substring(0, 10)}...`
                                : value
                            : "None"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="start">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-900">{property.name}</label>
                        {property.type === "text" && (
                          <Input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              setCustomPropertyValues((prev) => ({
                                ...prev,
                                [property.id]: e.target.value,
                              }))
                            }
                            className="text-sm"
                            placeholder={`Enter ${property.name.toLowerCase()}`}
                          />
                        )}
                        {property.type === "number" && (
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) =>
                              setCustomPropertyValues((prev) => ({
                                ...prev,
                                [property.id]: e.target.value,
                              }))
                            }
                            className="text-sm"
                            placeholder={`Enter ${property.name.toLowerCase()}`}
                          />
                        )}
                        {property.type === "date" && (
                          <Input
                            type="date"
                            value={value}
                            onChange={(e) =>
                              setCustomPropertyValues((prev) => ({
                                ...prev,
                                [property.id]: e.target.value,
                              }))
                            }
                            className="text-sm"
                          />
                        )}
                        {property.type === "select" && (
                          <select
                            value={value}
                            onChange={(e) =>
                              setCustomPropertyValues((prev) => ({
                                ...prev,
                                [property.id]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select {property.name.toLowerCase()}...</option>
                            {property.options &&
                              Array.isArray(property.options) &&
                              property.options.map((option: string, index: number) => (
                                <option key={index} value={option}>
                                  {option}
                                </option>
                              ))}
                          </select>
                        )}
                        <div className="flex gap-2">
                          {hasValue && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomPropertyValues((prev) => ({
                                  ...prev,
                                  [property.id]: "",
                                }));
                              }}
                              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}

              {/* Add Property Button - Far Right */}
              <div className="ml-auto">
                {selectedProject && (
                  <button
                    type="button"
                    onClick={() => setShowCustomPropertyManager(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                    title="Manage custom properties"
                  >
                    <span>Manage Properties</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Custom Property Manager Dialog */}
      {selectedProject && (
        <CustomPropertyManager
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          userId={userId}
          open={showCustomPropertyManager}
          onOpenChange={setShowCustomPropertyManager}
        />
      )}
    </div>
  );
}
