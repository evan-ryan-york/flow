# Technical Guide

## Architecture Overview

Perfect Task App uses a monorepo architecture with maximum code reuse across platforms. The application delivers to Web, iOS, Android, and native macOS desktop using a unified codebase built on **Next.js + Capacitor + Tauri** that follows the **Golden Path** data flow architecture.

## Golden Path Data Flow

The core principle is clear separation of concerns with type-safe data flow:

```
UI Component → Custom Hook → Service Layer → Supabase → Zod Validation → TanStack Query → Cache → UI Re-render
```

### 1. UI Layer (React Components)
- Components never directly fetch or mutate data
- Use custom hooks for all data operations
- Handle loading, error, and success states from hooks

### 2. Hook Layer (TanStack Query)
- Custom React hooks in `packages/data/hooks/`
- Encapsulate data-fetching logic and state management
- Provide clean APIs with `{ data, isLoading, isError }` patterns
- Manage caching and background refetching automatically

### 3. Service Layer (Supabase Client)
- Service functions in `packages/data/services/`
- Direct communication with Supabase API
- Immediate Zod validation on all responses
- Comprehensive error handling and logging

### 4. Data Validation (Zod Schemas)
- All data shapes defined in `packages/models/`
- Runtime type safety at API boundaries
- Prevents malformed data from reaching UI components

## Tech Stack

### Monorepo Management
- **pnpm** - Package manager with workspace support
- **Turborepo** - Build system and task orchestration
- **pnpm workspaces** - Manages dependencies across packages

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database with Row-Level Security (RLS)
  - Authentication & authorization
  - Real-time subscriptions via WebSockets
  - Database migrations and schema management
- **Supabase CLI** - Local development and migrations

### Frontend Framework
- **Next.js 15** - Primary web application with App Router
  - Server-side rendering and React Server Components
  - File-based routing system
  - Optimized production builds
- **Capacitor** - Mobile wrapper for iOS and Android
  - Native device capabilities (camera, share, push notifications)
  - WebView-based native apps pointing to Next.js build
- **Tauri** - Native macOS/Windows desktop wrapper
  - Native system integration (file system, global shortcuts, tray)
  - Secure WebView with Rust backend capabilities

### Navigation & Routing
- **Next.js App Router** - File-based routing system
- **React Router** - Client-side navigation within the app

### State Management
- **TanStack Query** - Server state management, caching, and synchronization
- **Zustand** - Client-side state management (minimal usage)

### Data Flow & Validation
- **Zod** - Schema validation and TypeScript type inference
- **TypeScript** - Compile-time type safety across entire stack

### Forms & UI
- **React Hook Form** - Form handling with validation
- **@hookform/resolvers** - Form validation integration
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern component library built on Radix UI + Tailwind CSS
- **Radix UI Primitives** - Unstyled, accessible UI components (shadcn foundation)
- **class-variance-authority (CVA)** - Component variant management
- **tailwind-merge** - Intelligent Tailwind class merging utility
- **clsx** - Conditional class name utility
- **lucide-react** - Beautiful SVG icon library
- **@dnd-kit/core** - Drag and drop functionality for task scheduling
- **react-big-calendar** - Calendar component for time-blocking and event display
- **react-resizable-panels** - Resizable split-pane layouts with drag-to-resize

### Testing Infrastructure
- **Jest** - Test runner with TypeScript support
- **React Testing Library** - Testing custom hooks and components
- **Service Layer Integration Tests** - Direct database testing with live Supabase
- **Hook Unit Tests** - Isolated testing with service layer mocking

### Development Tools
- **Next.js Dev Server** - Development server with hot reloading
- **ESLint/Prettier** - Code formatting and linting
- **Supabase Studio** - Database management interface

## Project Structure

```
perfect-task-app/
├── apps/
│   ├── web/                # Next.js 15 app (primary interface)
│   │   ├── app/            # App Router file-based routing
│   │   ├── components/     # Web-specific components
│   │   ├── lib/            # Web utilities and configurations
│   │   └── public/         # Static assets
│   ├── mobile/             # Capacitor wrapper (iOS, Android)
│   │   ├── capacitor.config.ts
│   │   ├── src/            # Points to web build
│   │   ├── ios/            # iOS-specific native code
│   │   └── android/        # Android-specific native code
│   └── desktop/            # Tauri wrapper (macOS, Windows)
│       ├── src-tauri/      # Rust backend configuration
│       └── src/            # Points to web build
├── packages/
│   ├── models/             # Zod schemas and TypeScript types
│   │   ├── auth.ts         # User and profile schemas
│   │   ├── project.ts      # Project and collaboration schemas
│   │   ├── task.ts         # Task and custom property schemas
│   │   ├── view.ts         # Saved views schemas
│   │   └── timeblock.ts    # Calendar and time block schemas
│   ├── data/               # Service layer and React hooks
│   │   ├── services/       # Direct Supabase API communication
│   │   │   ├── authService.ts
│   │   │   ├── profileService.ts
│   │   │   ├── projectService.ts
│   │   │   ├── taskService.ts
│   │   │   ├── customPropertyService.ts
│   │   │   ├── viewService.ts
│   │   │   └── timeBlockService.ts
│   │   ├── hooks/          # TanStack Query custom hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useProfile.ts
│   │   │   ├── useProject.ts
│   │   │   ├── useTask.ts
│   │   │   ├── useCustomProperty.ts
│   │   │   ├── useView.ts
│   │   │   └── useTimeBlock.ts
│   │   ├── supabase.ts     # Supabase client configuration
│   │   ├── nativeBridge.ts # Capacitor/Tauri native bridge
│   │   └── __tests__/      # Comprehensive test suite
│   └── ui/                 # Shared UI component library (shadcn/ui)
│       ├── components/
│       │   ├── ui/         # shadcn/ui base components
│       │   │   ├── button.tsx    # Button variants (default, destructive, outline, etc.)
│       │   │   ├── card.tsx      # Card container with header, content, footer
│       │   │   ├── input.tsx     # Form input with validation styling
│       │   │   ├── textarea.tsx  # Multi-line text input
│       │   │   ├── label.tsx     # Form labels with accessibility
│       │   │   ├── badge.tsx     # Status and tag indicators
│       │   │   ├── checkbox.tsx  # Checkbox with indeterminate state
│       │   │   ├── select.tsx    # Dropdown select with search
│       │   │   ├── dialog.tsx    # Modal dialogs with overlay
│       │   │   └── popover.tsx   # Contextual pop-up containers
│       │   └── custom/     # Application-specific components
│       │       └── index.ts      # Custom component exports
│       ├── lib/
│       │   └── utils.ts    # cn() utility and helper functions
│       ├── styles/
│       │   └── globals.css       # Tailwind base + CSS variables
│       ├── components.json       # shadcn/ui CLI configuration
│       ├── tailwind.config.js    # Tailwind preset for shared theming
│       ├── index.ts              # Base component exports
│       └── custom.ts             # Custom component exports
├── supabase/
│   ├── migrations/         # Database schema changes
│   └── config/            # Supabase configuration
├── docs/                  # Project documentation
└── turbo.json             # Turborepo configuration
```

## Data Architecture

### Database Schema (Supabase/PostgreSQL)
- **Users & Authentication**: Handled by Supabase Auth
- **Profiles**: User profile data linked to auth users
- **Projects**: Workspaces with owner and collaboration support
- **Project Users**: Join table for project collaboration with roles
- **Tasks**: Core task data with project associations
- **Custom Property Definitions**: Project-scoped dynamic field schemas
- **Custom Property Values**: Task-specific property values
- **Views**: Saved user interface configurations
- **Time Blocks**: Calendar blocks for time management
- **Time Block Tasks**: Join table for task-time associations

### Service Layer Pattern
Every service function follows this pattern:
```typescript
import { getSupabaseClient } from '../supabase';

const supabase = getSupabaseClient(); // Uses shared authenticated client

export const serviceFunction = async (params): Promise<Type> => {
  try {
    // 1. Supabase API call (with auth context from client)
    const { data, error } = await supabase.from('table')...;

    // 2. Error handling
    if (error) throw new Error(`Descriptive message: ${error.message}`);

    // 3. Zod validation (immediate type safety)
    const validatedData = Schema.parse(data);

    // 4. Return type-safe data
    return validatedData;
  } catch (error) {
    // 5. Comprehensive error logging
    console.error('ServiceName.functionName error:', error);
    throw error;
  }
};
```

**Critical**: All services use `getSupabaseClient()` from `packages/data/supabase.ts` which provides a singleton client with proper session management via `createBrowserClient` from `@supabase/ssr`.

### Hook Layer Pattern
Every React hook follows this pattern:
```typescript
export const useDataHook = (params) => {
  return useQuery({
    queryKey: ['entity', ...params],
    queryFn: () => serviceFunction(params),
    enabled: !!requiredParams,
    staleTime: appropriateForDataType, // 30s to 5min based on volatility
  });
};

export const useMutationHook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: serviceFunction,
    onSuccess: (data) => {
      // Smart cache invalidation
      queryClient.invalidateQueries({ queryKey: ['entity'] });
    },
  });
};
```

## UI Component System (shadcn/ui)

Perfect Task App uses **shadcn/ui** as its primary component system, providing a modern, accessible, and highly customizable UI foundation built on **Radix UI primitives** and **Tailwind CSS**.

### Architecture Overview

The UI system is organized as a shared package (`packages/ui/`) that serves all platform targets (Web, iOS, Android, Desktop) through a centralized design system:

```
UI System Architecture:
┌─────────────────────────────────────────────────────────────────┐
│                       @perfect-task-app/ui                     │
├─────────────────────────────────────────────────────────────────┤
│  shadcn/ui Components (10 components)                          │
│  ├── button, card, input, textarea, label, badge              │
│  ├── checkbox, select, dialog, popover                         │
│  └── Built on: Radix UI + Tailwind CSS + CVA                  │
├─────────────────────────────────────────────────────────────────┤
│  Foundation Libraries                                           │
│  ├── @radix-ui/* - Unstyled, accessible primitives            │
│  ├── tailwind-merge - Intelligent class merging               │
│  ├── clsx - Conditional class utilities                        │
│  ├── class-variance-authority - Component variants             │
│  └── lucide-react - Beautiful SVG icons                       │
├─────────────────────────────────────────────────────────────────┤
│  Styling System                                                │
│  ├── Tailwind CSS - Utility-first styling                     │
│  ├── CSS Variables - Theme tokens (light/dark mode)           │
│  └── Global Stylesheet - Base styles and design tokens        │
└─────────────────────────────────────────────────────────────────┘
```

### Component Library Structure

#### Base Components (shadcn/ui)
Located in `packages/ui/components/ui/`, these are production-ready components with:

**Form Components:**
- `button.tsx` - Multi-variant buttons (default, destructive, outline, secondary, ghost, link)
- `input.tsx` - Text inputs with validation styling and accessibility
- `textarea.tsx` - Multi-line text areas with resize handling
- `label.tsx` - Form labels with proper association and styling
- `checkbox.tsx` - Checkboxes with indeterminate state support
- `select.tsx` - Dropdown selects with search, groups, and custom styling

**Layout Components:**
- `card.tsx` - Container cards with header, content, and footer sections
- `badge.tsx` - Status indicators and tags with multiple variants

**Overlay Components:**
- `dialog.tsx` - Modal dialogs with backdrop, focus management, and animations
- `popover.tsx` - Contextual pop-ups with smart positioning

#### Utility Functions
Located in `packages/ui/lib/utils.ts`:

```typescript
// The cn() function - Core utility for conditional class merging
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))  // Merges classes intelligently, resolving Tailwind conflicts
}
```

#### Design System Configuration

**Tailwind Configuration** (`packages/ui/tailwind.config.js`):
- Pure preset configuration (no content scanning)
- CSS custom properties for theming
- Design tokens for spacing, colors, typography
- Dark mode support via class strategy
- Animation definitions for micro-interactions

**CSS Variables** (`packages/ui/styles/globals.css`):
```css
/* Light theme tokens */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... full design system tokens */
}

/* Dark theme tokens */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode overrides */
}
```

### Import Patterns

The UI system provides clean, predictable import paths:

```typescript
// Base shadcn/ui components
import { Button, Input, Card, CardHeader, CardContent } from '@perfect-task-app/ui'

// Custom application components (when created)
import { TaskItem, ProjectCard } from '@perfect-task-app/ui/custom'

// Utility functions
import { cn } from '@perfect-task-app/ui'
```

### Component Usage Examples

**Basic Form:**
```typescript
import { Button, Input, Label, Card, CardContent } from '@perfect-task-app/ui'

export function LoginForm() {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="Enter your email" />
        </div>
        <Button className="w-full">Sign In</Button>
      </CardContent>
    </Card>
  )
}
```

**Interactive Dialog:**
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Button } from '@perfect-task-app/ui'

export function CreateTaskDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create Task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        {/* Form content */}
      </DialogContent>
    </Dialog>
  )
}
```

### Component Development Workflow

**Adding New shadcn/ui Components:**
```bash
# From packages/ui directory
cd packages/ui
pnpm dlx shadcn@latest add [component-name]

# Components auto-install with proper TypeScript types and dependencies
# Auto-exported in packages/ui/index.ts for immediate usage
```

**Creating Custom Components:**
```typescript
// packages/ui/components/custom/TaskItem.tsx
import { cn, Card, Badge, Button } from '@perfect-task-app/ui'

interface TaskItemProps {
  title: string
  priority: 'low' | 'medium' | 'high'
  className?: string
}

export function TaskItem({ title, priority, className }: TaskItemProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant={priority === 'high' ? 'destructive' : 'default'}>
          {priority}
        </Badge>
      </div>
    </Card>
  )
}

// Export from packages/ui/custom.ts
export * from './components/custom/TaskItem'
```

### Cross-Platform Compatibility

The UI system is designed for universal compatibility:

- **Web (Next.js)** - Native DOM rendering with full interactivity
- **Mobile (Capacitor)** - WebView rendering with touch-optimized components
- **Desktop (Tauri)** - Native window rendering with keyboard shortcuts
- **Server-Side Rendering** - All components support SSR/RSC in Next.js

### Accessibility Features

All components follow WCAG 2.1 AA standards:
- Proper ARIA attributes and roles
- Keyboard navigation support
- Screen reader compatibility
- Focus management and visual indicators
- Color contrast compliance
- Semantic HTML structure

### Theming and Customization

**CSS Custom Properties System:**
- Centralized design tokens in CSS variables
- Automatic dark/light mode switching
- Consistent spacing, typography, and color scales
- Easy theme customization via CSS variable overrides

**Component Variants:**
```typescript
// Powered by class-variance-authority (CVA)
const buttonVariants = cva(
  "base-button-styles",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background",
        // ... more variants
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      }
    }
  }
)
```

### Performance Optimizations

- **Tree-shaking friendly** - Import only the components you use
- **Zero-runtime CSS-in-JS** - Pure Tailwind CSS compilation
- **Minimal JavaScript** - Radix UI primitives are lightweight
- **Efficient re-renders** - Components use React.forwardRef and proper memoization

## Development Workflow

### Local Development Setup
1. **Start Supabase**: `supabase start` (requires Docker)
2. **Install Dependencies**: `pnpm install`
3. **Start Development**: `pnpm dev` (starts all packages)
4. **Database Migrations**: `supabase db push`

### Development Commands
- `pnpm dev` - Start all development servers across packages
- `pnpm dev:web` - Start Next.js development server
- `pnpm build` - TypeScript compilation and build check across monorepo
- `pnpm build:web` - Build Next.js production bundle
- `pnpm lint` - ESLint across entire monorepo with zero warnings tolerance
- `pnpm test` - Run all test suites (integration + unit tests)
- `pnpm test:watch` - Run tests in watch mode

### Testing Strategy
- **Service Integration Tests**: Test against live local Supabase instance
- **Hook Unit Tests**: Isolated testing with service layer mocking
- **Full CRUD Coverage**: Every service function tested
- **RLS Security Testing**: Row-Level Security policy validation
- **Error Handling**: Comprehensive edge case testing

### Database Development
- **Remote-First**: Development connects directly to hosted Supabase instance
- **Migration-Driven**: All schema changes via SQL migration files applied with psql
- **RLS Enforced**: Row-Level Security policies on all tables (projects, tasks, custom_properties, etc.)
- **Type Generation**: Database types generated from Zod schemas
- **Security**: All tables have proper RLS policies preventing unauthorized access

## Key Implementation Features

### Authentication & Security
- Supabase Auth integration with automatic profile creation
- Row-Level Security (RLS) policies enforcing data access controls
- Project-based collaboration with role management
- Comprehensive authentication error handling

### Real-time Features
- Supabase real-time subscriptions for collaborative updates
- Automatic cache invalidation on data changes
- Live updates across all connected clients

### Advanced Data Management
- **Custom Properties**: Project-scoped dynamic fields with type validation
- **Saved Views**: Personalized UI configurations with JSON storage
- **Time Blocks**: Calendar integration with task associations
- **Upsert Logic**: Intelligent INSERT/UPDATE handling for property values

### Performance Optimization
- Smart caching strategies based on data volatility
- Background refetching for data freshness
- Granular cache invalidation for optimal performance
- Efficient database queries with proper indexing

## Deployment Targets

- **Web Application** - Primary Next.js application deployed to Vercel/Netlify
- **iOS App Store** - Native iOS application via Capacitor wrapper
- **Google Play Store** - Native Android application via Capacitor wrapper
- **macOS App Store** - Native desktop application via Tauri wrapper
- **Windows Store** - Native desktop application via Tauri wrapper

## Production Readiness

The application is production-ready with:
- ✅ Complete backend service architecture
- ✅ **Modern UI component system** with shadcn/ui + 10 production-ready components
- ✅ **Cross-platform compatibility** (Web, iOS, Android, Desktop)
- ✅ **Comprehensive accessibility** - WCAG 2.1 AA compliant components
- ✅ **Design system** with theming, dark mode, and CSS custom properties
- ✅ Comprehensive test coverage (57+ test files)
- ✅ Type safety throughout the entire stack
- ✅ Professional error handling and logging
- ✅ Database migrations for schema management
- ✅ Row-Level Security for data protection
- ✅ Real-time collaboration features
- ✅ Performance-optimized caching strategies