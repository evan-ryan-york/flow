/**
 * Centralized Color Configuration
 *
 * This file is the single source of truth for ALL colors used in the Flow.
 * Any color definitions should be added here and exported for use throughout the application.
 */

// ---------------------------------
// Brand/Primary Color
// ---------------------------------

/**
 * Primary brand color used throughout the application for:
 * - Primary buttons and CTAs
 * - Active/selected states
 * - Hover states
 * - Focus rings
 * - Links
 * - Progress indicators
 * - Filter/group badges when active
 *
 * This is separate from project colors to maintain clear distinction between
 * product UI (brand color) and user content (project colors).
 */
export const BRAND_COLOR = {
  main: '#2563eb',           // Primary brand color (blue-600)
  hover: '#1d4ed8',          // Slightly darker for hover states (blue-700)
  light: '#dbeafe',          // Light background for badges/pills (blue-100)
  lighter: '#eff6ff',        // Very light background for subtle highlights (blue-50)
} as const;

// ---------------------------------
// Project Colors
// ---------------------------------

export type ProjectColorName =
  | 'red'
  | 'orange-red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'light-blue'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose'
  | 'magenta'
  | 'hot-pink'
  | 'plum'
  | 'gray'
  | 'dark-gray'
  | 'charcoal';

export interface ProjectColorConfig {
  name: ProjectColorName;
  label: string;
  hex: string;
  lightBackground: string;
}

/**
 * Available project colors with their primary color and light background variants.
 * These colors are used in:
 * - Project color picker UI
 * - Project badges/chips
 * - Project indicators throughout the app
 */
export const PROJECT_COLORS: ProjectColorConfig[] = [
  { name: 'red', label: 'Red', hex: 'hsl(2, 72%, 28%)', lightBackground: 'hsl(6, 43%, 99%)' },
  { name: 'orange-red', label: 'Orange Red', hex: 'hsl(3, 67%, 51%)', lightBackground: 'hsl(0, 50%, 99%)' },
  { name: 'orange', label: 'Orange', hex: 'hsl(4, 88%, 63%)', lightBackground: 'hsl(8, 83%, 99%)' },
  { name: 'amber', label: 'Amber', hex: 'hsl(25, 100%, 30%)', lightBackground: 'hsl(27, 43%, 99%)' },
  { name: 'yellow', label: 'Yellow', hex: 'hsl(25, 100%, 45%)', lightBackground: 'hsl(27, 67%, 99%)' },
  { name: 'lime', label: 'Lime', hex: 'hsl(25, 100%, 60%)', lightBackground: 'hsl(27, 100%, 99%)' },
  { name: 'green', label: 'Green', hex: 'hsl(45, 81%, 26%)', lightBackground: 'hsl(48, 29%, 99%)' },
  { name: 'emerald', label: 'Emerald', hex: 'hsl(45, 78%, 40%)', lightBackground: 'hsl(53, 44%, 99%)' },
  { name: 'teal', label: 'Teal', hex: 'hsl(49, 91%, 61%)', lightBackground: 'hsl(53, 73%, 99%)' },
  { name: 'cyan', label: 'Cyan', hex: 'hsl(110, 52%, 25%)', lightBackground: 'hsl(100, 24%, 99%)' },
  { name: 'light-blue', label: 'Light Blue', hex: 'hsl(110, 58%, 39%)', lightBackground: 'hsl(111, 29%, 99%)' },
  { name: 'blue', label: 'Blue', hex: 'hsl(110, 55%, 59%)', lightBackground: 'hsl(113, 38%, 99%)' },
  { name: 'indigo', label: 'Indigo', hex: 'hsl(205, 81%, 30%)', lightBackground: 'hsl(209, 29%, 99%)' },
  { name: 'violet', label: 'Violet', hex: 'hsl(205, 89%, 45%)', lightBackground: 'hsl(208, 64%, 99%)' },
  { name: 'purple', label: 'Purple', hex: 'hsl(205, 84%, 61%)', lightBackground: 'hsl(208, 83%, 99%)' },
  { name: 'fuchsia', label: 'Fuchsia', hex: 'hsl(257, 65%, 25%)', lightBackground: 'hsl(240, 22%, 99%)' },
  { name: 'pink', label: 'Pink', hex: 'hsl(257, 70%, 53%)', lightBackground: 'hsl(253, 63%, 99%)' },
  { name: 'rose', label: 'Rose', hex: 'hsl(257, 89%, 64%)', lightBackground: 'hsl(255, 75%, 99%)' },
  { name: 'magenta', label: 'Magenta', hex: 'hsl(283, 65%, 25%)', lightBackground: 'hsl(280, 22%, 99%)' },
  { name: 'hot-pink', label: 'Hot Pink', hex: 'hsl(283, 70%, 40%)', lightBackground: 'hsl(284, 56%, 99%)' },
  { name: 'plum', label: 'Plum', hex: 'hsl(283, 89%, 64%)', lightBackground: 'hsl(285, 75%, 99%)' },
  { name: 'gray', label: 'Gray', hex: 'hsl(0, 0%, 40%)', lightBackground: 'hsl(0, 0%, 99%)' },
  { name: 'dark-gray', label: 'Dark Gray', hex: 'hsl(0, 0%, 20%)', lightBackground: 'hsl(0, 0%, 94%)' },
  { name: 'charcoal', label: 'Charcoal', hex: 'hsl(0, 0%, 7%)', lightBackground: 'hsl(0, 0%, 92%)' },
];

/**
 * Helper function to get the hex color value for a project color by name
 */
export function getProjectColorHex(colorName: ProjectColorName): string {
  const color = PROJECT_COLORS.find(c => c.name === colorName);
  return color?.hex || '#009cb9'; // default to blue
}

/**
 * Helper function to get the light background color for a project color by name
 */
export function getProjectColorLightBackground(colorName: ProjectColorName): string {
  const color = PROJECT_COLORS.find(c => c.name === colorName);
  return color?.lightBackground || '#e5faff'; // default to blue light background
}

/**
 * Helper function to get the full color configuration for a project color by name
 */
export function getProjectColorConfig(colorName: ProjectColorName): ProjectColorConfig | undefined {
  return PROJECT_COLORS.find(c => c.name === colorName);
}

/**
 * Array of all available project color names (for use in schemas/validation)
 */
export const PROJECT_COLOR_NAMES = PROJECT_COLORS.map(c => c.name) as [ProjectColorName, ...ProjectColorName[]];

/**
 * Migrate old color names to new color names
 * This is a temporary helper to handle data migration from the old 8-color palette to the new 20-color palette
 */
export function migrateOldColorName(oldColor: string): ProjectColorName {
  const colorMap: Record<string, ProjectColorName> = {
    'sky': 'blue',
    'mint': 'emerald',
    'crimson': 'red',
    // Colors that remain the same
    'rose': 'rose',
    'amber': 'amber',
    'violet': 'violet',
    'lime': 'lime',
    'teal': 'teal',
  };

  return colorMap[oldColor] || 'blue'; // default to blue if unknown
}

// ---------------------------------
// Future: Add other app-wide colors here
// ---------------------------------
// Example sections to add:
// - UI theme colors
// - Status colors (success, warning, error, info)
// - Chart colors
// - etc.
