import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, EditPencil, Bin } from "iconoir-react";
import {
  useAllUserDefinitions,
  useCreateDefinition,
  useUpdateDefinition,
  useDeleteDefinition,
  useProjectsForUser,
} from "@perfect-task-app/data";
import type { CustomPropertyDefinitionWithProjects } from "@perfect-task-app/models";

interface CustomPropertyManagerProps {
  projectId: string; // Still used for initial context, but now supports multi-select
  projectName: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PropertyType = "text" | "select" | "date" | "number";

interface PropertyFormData {
  name: string;
  type: PropertyType;
  options: string[];
  selectedProjectIds: string[]; // New field for multi-project selection
}

export function CustomPropertyManager({
  projectId,
  projectName: _projectName,
  userId,
  open,
  onOpenChange,
}: CustomPropertyManagerProps) {
  const { data: allUserProperties = [], isLoading } = useAllUserDefinitions(userId);
  const { data: userProjects = [] } = useProjectsForUser(userId);
  const createPropertyMutation = useCreateDefinition();
  const updatePropertyMutation = useUpdateDefinition();
  const deletePropertyMutation = useDeleteDefinition();

  const [isCreating, setIsCreating] = useState(false);
  const [editingProperty, setEditingProperty] = useState<CustomPropertyDefinitionWithProjects | null>(null);
  const [formData, setFormData] = useState<PropertyFormData>({
    name: "",
    type: "text",
    options: [],
    selectedProjectIds: [projectId], // Default to current project
  });
  const [optionInput, setOptionInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      name: "",
      type: "text",
      options: [],
      selectedProjectIds: [projectId], // Reset to current project
    });
    setOptionInput("");
    setError(null);
    setIsCreating(false);
    setEditingProperty(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleStartEdit = (property: CustomPropertyDefinitionWithProjects) => {
    setFormData({
      name: property.name,
      type: property.type as PropertyType,
      options: Array.isArray(property.options) ? property.options : [],
      selectedProjectIds: property.project_ids, // Use property's assigned projects
    });
    setEditingProperty(property);
    setIsCreating(false);
  };

  const handleAddOption = () => {
    if (optionInput.trim() && !formData.options.includes(optionInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        options: [...prev.options, optionInput.trim()],
      }));
      setOptionInput("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setError(null);

    // Check for duplicate names across all user properties
    const trimmedName = formData.name.trim();
    const existingProperty = allUserProperties.find(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && (!editingProperty || p.id !== editingProperty.id),
    );

    if (existingProperty) {
      setError("A custom property with this name already exists in your properties.");
      return;
    }

    try {
      if (editingProperty) {
        // Update existing property
        await updatePropertyMutation.mutateAsync({
          definitionId: editingProperty.id,
          updates: {
            name: trimmedName,
            type: formData.type,
            options: formData.type === "select" ? formData.options : undefined,
            project_ids: formData.selectedProjectIds,
          },
        });
      } else {
        // Create new property
        await createPropertyMutation.mutateAsync({
          project_ids: formData.selectedProjectIds,
          // Don't send created_by - the database will set it automatically
          name: trimmedName,
          type: formData.type,
          options: formData.type === "select" ? formData.options : undefined,
          display_order: allUserProperties.length,
        });
      }
      resetForm();
    } catch (error) {
      console.error("Failed to save property:", error);
      if (error instanceof Error && error.message.includes("duplicate key")) {
        setError("A custom property with this name already exists for this project.");
      } else {
        setError("Failed to save custom property. Please try again.");
      }
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this custom property? This will remove all values for this property from existing tasks.",
      )
    ) {
      try {
        await deletePropertyMutation.mutateAsync(propertyId);
      } catch (error) {
        console.error("Failed to delete property:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Custom Properties Manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Properties */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900">Your Custom Properties</h3>
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : allUserProperties.length === 0 ? (
              <div className="text-sm text-gray-500 p-4 border rounded-lg">
                No custom properties yet. Create one below!
              </div>
            ) : (
              <div className="space-y-2">
                {allUserProperties.map((property) => {
                  // Find project names for the chips
                  const assignedProjects = userProjects.filter((project) => property.project_ids.includes(project.id));
                  const isAssignedToCurrentProject = property.project_ids.includes(projectId);

                  return (
                    <div
                      key={property.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{property.name}</span>
                          <span className="text-xs px-2 py-1 bg-gray-200 rounded">{property.type}</span>
                          {isAssignedToCurrentProject && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Current Project</span>
                          )}
                        </div>
                        {property.type === "select" && property.options && (
                          <div className="text-xs text-gray-600 mb-2">
                            Options: {Array.isArray(property.options) ? property.options.join(", ") : ""}
                          </div>
                        )}
                        {/* Project assignment chips */}
                        <div className="flex flex-wrap gap-1">
                          {assignedProjects.map((project) => (
                            <span key={project.id} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                              {project.name}
                            </span>
                          ))}
                          {property.project_ids.length === 0 && (
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                              No projects assigned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleStartEdit(property)}>
                          <EditPencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(property.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Bin className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create/Edit Form */}
          {(isCreating || editingProperty) && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-sm font-medium text-gray-900">
                {editingProperty ? "Edit Property" : "Create New Property"}
              </h3>

              {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="property-name">Property Name</Label>
                  <Input
                    id="property-name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Priority, Environment"
                  />
                </div>

                <div>
                  <Label htmlFor="property-type">Property Type</Label>
                  <select
                    id="property-type"
                    value={formData.type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as PropertyType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select (Dropdown)</option>
                  </select>
                </div>

                <div>
                  <Label>Assign to Projects</Label>
                  <div className="space-y-2">
                    {userProjects.map((project) => (
                      <label key={project.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.selectedProjectIds.includes(project.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData((prev) => ({
                                ...prev,
                                selectedProjectIds: [...prev.selectedProjectIds, project.id],
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                selectedProjectIds: prev.selectedProjectIds.filter((id) => id !== project.id),
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">{project.name}</span>
                        {project.id === projectId && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Current</span>
                        )}
                      </label>
                    ))}
                    {formData.selectedProjectIds.length === 0 && (
                      <p className="text-sm text-red-600">Please select at least one project.</p>
                    )}
                  </div>
                </div>

                {formData.type === "select" && (
                  <div>
                    <Label>Options</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={optionInput}
                          onChange={(e) => setOptionInput(e.target.value)}
                          placeholder="Add option..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddOption();
                            }
                          }}
                        />
                        <Button type="button" size="sm" onClick={handleAddOption}>
                          Add
                        </Button>
                      </div>
                      {formData.options.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {formData.options.map((option, index) => (
                            <div key={index} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
                              {option}
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !formData.name.trim() ||
                    (formData.type === "select" && formData.options.length === 0) ||
                    formData.selectedProjectIds.length === 0
                  }
                >
                  {editingProperty ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          )}

          {/* Add New Button */}
          {!isCreating && !editingProperty && (
            <Button variant="outline" onClick={handleStartCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Property
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
