export interface ParsedTaskInput {
  taskName: string;
  projectQuery?: string;
  hasProjectCommand: boolean;
}

/**
 * Parse task input to extract /in commands and project queries
 *
 * Examples:
 * - "Buy milk" -> { taskName: "Buy milk", hasProjectCommand: false }
 * - "Buy milk /in groceries" -> { taskName: "Buy milk /in groceries", projectQuery: "groceries", hasProjectCommand: true }
 * - "/in work Task description" -> { taskName: "/in work Task description", projectQuery: "work Task description", hasProjectCommand: true }
 */
export const parseTaskInput = (input: string): ParsedTaskInput => {
  if (!input || typeof input !== 'string') {
    return {
      taskName: '',
      hasProjectCommand: false,
    };
  }

  const trimmedInput = input.trim();

  // Look for /in command anywhere in the string
  const inCommandMatch = trimmedInput.match(/\s*\/in\s+(.*)/);

  if (!inCommandMatch) {
    return {
      taskName: trimmedInput,
      hasProjectCommand: false,
    };
  }

  // Extract the project query (everything after /in)
  const projectQuery = inCommandMatch[1] || '';

  return {
    taskName: trimmedInput,
    projectQuery: projectQuery.trim(),
    hasProjectCommand: true,
  };
};

/**
 * Clean the task name by removing the /in command portion
 *
 * Examples:
 * - "Buy milk /in groceries" -> "Buy milk"
 * - "/in work Task description" -> ""
 * - "Task name" -> "Task name"
 */
export const cleanTaskName = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const trimmedInput = input.trim();

  // Remove /in command and everything after it
  const cleanedName = trimmedInput.replace(/\s*\/in\s+.*$/, '').trim();

  return cleanedName;
};

/**
 * Extract just the project query from a task input
 *
 * Examples:
 * - "Buy milk /in groceries" -> "groceries"
 * - "/in work stuff" -> "work stuff"
 * - "Regular task" -> null
 */
export const extractProjectQuery = (input: string): string | null => {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmedInput = input.trim();
  const inCommandMatch = trimmedInput.match(/\s*\/in\s+(.*)/);

  if (!inCommandMatch) {
    return null;
  }

  const projectQuery = inCommandMatch[1] || '';
  return projectQuery.trim() || '';
};