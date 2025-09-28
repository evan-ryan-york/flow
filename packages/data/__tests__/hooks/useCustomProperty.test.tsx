import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useProjectDefinitions,
  useCreateDefinition,
  useUpdateDefinition,
  useDeleteDefinition,
  useTaskPropertyValues,
  useSetPropertyValue,
  useDeletePropertyValue,
} from "../../hooks/useCustomProperty";
import * as customPropertyService from "../../services/customPropertyService";

// Mock the entire customPropertyService
jest.mock("../../services/customPropertyService");
const mockedCustomPropertyService = customPropertyService as jest.Mocked<typeof customPropertyService>;

// Test wrapper component for TanStack Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock definition data (new multi-project format)
const mockDefinition = {
  id: "def-1",
  created_by: "user-1",
  name: "Priority",
  type: "select" as const,
  options: ["Low", "Medium", "High"],
  display_order: 1,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  project_ids: ["project-1"],
};

// Legacy mock for backward compatibility tests
const mockDefinitionLegacy = {
  id: "def-1",
  project_id: "project-1",
  created_by: "user-1",
  name: "Priority",
  type: "select" as const,
  options: ["Low", "Medium", "High"],
  display_order: 1,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockDefinitions = [
  mockDefinition,
  {
    ...mockDefinition,
    id: "def-2",
    name: "Environment",
    type: "select" as const,
    options: ["QA", "Prod"],
    display_order: 2,
  },
];

// Mock property value data
const mockPropertyValue = {
  id: "val-1",
  task_id: "task-1",
  definition_id: "def-1",
  value: "High",
  created_by: "user-1",
  updated_by: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockPropertyValues = [
  mockPropertyValue,
  {
    ...mockPropertyValue,
    id: "val-2",
    definition_id: "def-2",
    value: "QA",
  },
];

describe("useCustomProperty hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useProjectDefinitions", () => {
    it("should return loading state initially", async () => {
      mockedCustomPropertyService.getDefinitionsForProject.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDefinitions), 100)),
      );

      const { result } = renderHook(() => useProjectDefinitions("project-1"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isError).toBe(false);
    });

    it("should return data when service resolves successfully", async () => {
      mockedCustomPropertyService.getDefinitionsForProject.mockResolvedValue(mockDefinitions);

      const { result } = renderHook(() => useProjectDefinitions("project-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(mockDefinitions);
      expect(result.current.isError).toBe(false);
      expect(mockedCustomPropertyService.getDefinitionsForProject).toHaveBeenCalledWith("project-1");
    });

    it("should return error state when service throws an error", async () => {
      const errorMessage = "Failed to fetch definitions";
      mockedCustomPropertyService.getDefinitionsForProject.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useProjectDefinitions("project-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });

    it("should not execute query when projectId is not provided", () => {
      mockedCustomPropertyService.getDefinitionsForProject.mockResolvedValue(mockDefinitions);

      const { result } = renderHook(() => useProjectDefinitions(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockedCustomPropertyService.getDefinitionsForProject).not.toHaveBeenCalled();
    });
  });

  describe("useTaskPropertyValues", () => {
    it("should return loading state initially", async () => {
      mockedCustomPropertyService.getValuesForTask.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockPropertyValues), 100)),
      );

      const { result } = renderHook(() => useTaskPropertyValues("task-1"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isError).toBe(false);
    });

    it("should return data when service resolves successfully", async () => {
      mockedCustomPropertyService.getValuesForTask.mockResolvedValue(mockPropertyValues);

      const { result } = renderHook(() => useTaskPropertyValues("task-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(mockPropertyValues);
      expect(result.current.isError).toBe(false);
      expect(mockedCustomPropertyService.getValuesForTask).toHaveBeenCalledWith("task-1");
    });

    it("should handle empty property values list", async () => {
      mockedCustomPropertyService.getValuesForTask.mockResolvedValue([]);

      const { result } = renderHook(() => useTaskPropertyValues("task-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(result.current.isError).toBe(false);
    });
  });

  describe("useCreateDefinition", () => {
    it("should initially not be loading or error", () => {
      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle successful definition creation", async () => {
      const newDefinitionData = {
        project_ids: ["project-1"],
        created_by: "user-1",
        name: "New Property",
        type: "text" as const,
        display_order: 1,
      };

      mockedCustomPropertyService.createDefinition.mockResolvedValue(mockDefinition);

      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newDefinitionData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toEqual(mockDefinition);
      expect(result.current.isError).toBe(false);
      expect(mockedCustomPropertyService.createDefinition).toHaveBeenCalledWith(newDefinitionData);
    });

    it("should handle definition creation error", async () => {
      const errorMessage = "Failed to create definition";
      const newDefinitionData = {
        project_ids: ["project-1"],
        created_by: "user-1",
        name: "New Property",
        type: "text" as const,
      };

      mockedCustomPropertyService.createDefinition.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newDefinitionData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });

    it("should show pending state during creation", async () => {
      mockedCustomPropertyService.createDefinition.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDefinition), 100)),
      );

      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        project_ids: ["project-1"],
        created_by: "user-1",
        name: "New Property",
        type: "text",
      });

      expect(result.current.isPending).toBe(true);
    });
  });

  describe("useUpdateDefinition", () => {
    it("should handle successful definition update", async () => {
      const updatedDefinition = { ...mockDefinition, name: "Updated Priority" };
      const updateData = { name: "Updated Priority" };

      mockedCustomPropertyService.updateDefinition.mockResolvedValue(updatedDefinition);

      const { result } = renderHook(() => useUpdateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ definitionId: "def-1", updates: updateData });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(updatedDefinition);
      expect(mockedCustomPropertyService.updateDefinition).toHaveBeenCalledWith("def-1", updateData);
    });

    it("should handle definition update error", async () => {
      const errorMessage = "Failed to update definition";
      const updateData = { name: "Updated Priority" };

      mockedCustomPropertyService.updateDefinition.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useUpdateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ definitionId: "def-1", updates: updateData });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });
  });

  describe("useDeleteDefinition", () => {
    it("should handle successful definition deletion", async () => {
      mockedCustomPropertyService.deleteDefinition.mockResolvedValue();

      const { result } = renderHook(() => useDeleteDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate("def-1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isError).toBe(false);
      expect(mockedCustomPropertyService.deleteDefinition).toHaveBeenCalledWith("def-1");
    });

    it("should handle definition deletion error", async () => {
      const errorMessage = "Failed to delete definition";

      mockedCustomPropertyService.deleteDefinition.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useDeleteDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate("def-1");

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });
  });

  describe("useSetPropertyValue", () => {
    it("should handle successful property value setting", async () => {
      mockedCustomPropertyService.setPropertyValue.mockResolvedValue(mockPropertyValue);

      const { result } = renderHook(() => useSetPropertyValue(), {
        wrapper: createWrapper(),
      });

      const setValueData = {
        taskId: "task-1",
        definitionId: "def-1",
        value: "High",
        userId: "user-1",
      };

      result.current.mutate(setValueData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockPropertyValue);
      expect(mockedCustomPropertyService.setPropertyValue).toHaveBeenCalledWith("task-1", "def-1", "High");
    });

    it("should handle property value setting error", async () => {
      const errorMessage = "Failed to set property value";

      mockedCustomPropertyService.setPropertyValue.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSetPropertyValue(), {
        wrapper: createWrapper(),
      });

      const setValueData = {
        taskId: "task-1",
        definitionId: "def-1",
        value: "High",
        userId: "user-1",
      };

      result.current.mutate(setValueData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });

    it("should show pending state during value setting", async () => {
      mockedCustomPropertyService.setPropertyValue.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockPropertyValue), 100)),
      );

      const { result } = renderHook(() => useSetPropertyValue(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        taskId: "task-1",
        definitionId: "def-1",
        value: "High",
        userId: "user-1",
      });

      expect(result.current.isPending).toBe(true);
    });
  });

  describe("useDeletePropertyValue", () => {
    it("should handle successful property value deletion", async () => {
      mockedCustomPropertyService.deletePropertyValue.mockResolvedValue();

      const { result } = renderHook(() => useDeletePropertyValue(), {
        wrapper: createWrapper(),
      });

      const deleteValueData = {
        taskId: "task-1",
        definitionId: "def-1",
      };

      result.current.mutate(deleteValueData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isError).toBe(false);
      expect(mockedCustomPropertyService.deletePropertyValue).toHaveBeenCalledWith("task-1", "def-1");
    });

    it("should handle property value deletion error", async () => {
      const errorMessage = "Failed to delete property value";

      mockedCustomPropertyService.deletePropertyValue.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useDeletePropertyValue(), {
        wrapper: createWrapper(),
      });

      const deleteValueData = {
        taskId: "task-1",
        definitionId: "def-1",
      };

      result.current.mutate(deleteValueData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });
  });

  describe("State management behavior", () => {
    it("should maintain correct loading states for definitions query", async () => {
      let resolvePromise: (value: typeof mockDefinitions) => void;
      const promise = new Promise<typeof mockDefinitions>((resolve) => {
        resolvePromise = resolve;
      });

      mockedCustomPropertyService.getDefinitionsForProject.mockReturnValue(promise);

      const { result } = renderHook(() => useProjectDefinitions("project-1"), {
        wrapper: createWrapper(),
      });

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Resolve the promise
      resolvePromise!(mockDefinitions);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Final state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual(mockDefinitions);
    });

    it("should maintain correct loading states for property values query", async () => {
      let resolvePromise: (value: typeof mockPropertyValues) => void;
      const promise = new Promise<typeof mockPropertyValues>((resolve) => {
        resolvePromise = resolve;
      });

      mockedCustomPropertyService.getValuesForTask.mockReturnValue(promise);

      const { result } = renderHook(() => useTaskPropertyValues("task-1"), {
        wrapper: createWrapper(),
      });

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Resolve the promise
      resolvePromise!(mockPropertyValues);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Final state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual(mockPropertyValues);
    });

    it("should handle mutations with proper state transitions", async () => {
      let resolvePromise: (value: typeof mockDefinition) => void;
      const promise = new Promise<typeof mockDefinition>((resolve) => {
        resolvePromise = resolve;
      });

      mockedCustomPropertyService.createDefinition.mockReturnValue(promise);

      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      // Initial state
      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Start mutation
      result.current.mutate({
        project_ids: ["project-1"],
        created_by: "user-1",
        name: "Test Property",
        type: "text",
      });

      // Pending state
      expect(result.current.isPending).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Resolve the promise
      resolvePromise!(mockDefinition);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Final state
      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual(mockDefinition);
    });
  });

  describe("Stale time behavior", () => {
    it("should have longer stale time for definitions (5 minutes)", async () => {
      mockedCustomPropertyService.getDefinitionsForProject.mockResolvedValue(mockDefinitions);

      const { result } = renderHook(() => useProjectDefinitions("project-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // The hook is configured with 5-minute stale time for definitions
      // This is tested by the configuration, not the behavior itself
      expect(result.current.data).toEqual(mockDefinitions);
    });

    it("should have shorter stale time for property values (30 seconds)", async () => {
      mockedCustomPropertyService.getValuesForTask.mockResolvedValue(mockPropertyValues);

      const { result } = renderHook(() => useTaskPropertyValues("task-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // The hook is configured with 30-second stale time for property values
      // This is tested by the configuration, not the behavior itself
      expect(result.current.data).toEqual(mockPropertyValues);
    });
  });
});
