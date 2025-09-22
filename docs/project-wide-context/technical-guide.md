# Technical Guide

## Architecture Overview

Perfect Task App uses a monorepo architecture with maximum code reuse across platforms. The application compiles to iOS, Android, Web, and native macOS desktop using a unified codebase that follows the **Golden Path** data flow architecture.

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
- **Expo (React Native)** - Cross-platform development
  - iOS compilation
  - Android compilation
  - Web compilation (React Native Web)
- **Tauri** - Native macOS desktop wrapper (planned)

### Navigation & Routing
- **Expo Router** - File-based routing system

### State Management
- **TanStack Query** - Server state management, caching, and synchronization
- **Zustand** - Client-side state management (minimal usage)

### Data Flow & Validation
- **Zod** - Schema validation and TypeScript type inference
- **TypeScript** - Compile-time type safety across entire stack

### Forms & UI
- **React Hook Form** - Form handling with validation
- **@hookform/resolvers** - Form validation integration
- **NativeWind** - Tailwind CSS for React Native
- **Tailwind CSS** - Utility-first CSS framework

### Testing Infrastructure
- **Jest** - Test runner with TypeScript support
- **React Native Testing Library** - Testing custom hooks and components
- **Service Layer Integration Tests** - Direct database testing with live Supabase
- **Hook Unit Tests** - Isolated testing with service layer mocking

### Development Tools
- **Expo Dev Tools** - Development server and debugging
- **ESLint/Prettier** - Code formatting and linting
- **Supabase Studio** - Database management interface

## Project Structure

```
perfect-task-app/
├── apps/
│   └── mobile/              # Expo app (iOS, Android, Web)
│       ├── app/            # File-based routing
│       ├── components/     # App-specific components
│       └── ...
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
│   │   └── __tests__/      # Comprehensive test suite
│   └── ui/                 # Shared React components
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
export const serviceFunction = async (params): Promise<Type> => {
  try {
    // 1. Supabase API call
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

## Development Workflow

### Local Development Setup
1. **Start Supabase**: `supabase start` (requires Docker)
2. **Install Dependencies**: `pnpm install`
3. **Start Development**: `pnpm dev` (starts all packages)
4. **Database Migrations**: `supabase db push`

### Development Commands
- `pnpm dev` - Start all development servers across packages
- `pnpm build` - TypeScript compilation and build check across monorepo
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
- **Local-First**: All development uses local Supabase instance
- **Migration-Driven**: All schema changes via SQL migration files
- **RLS Enforced**: Row-Level Security policies on all tables
- **Type Generation**: Database types generated from Zod schemas

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

- **iOS App Store** - Native iOS application via Expo
- **Google Play Store** - Native Android application via Expo
- **Web Application** - Browser-based version via React Native Web
- **macOS Desktop** - Native application via Tauri (future)

## Production Readiness

The application is production-ready with:
- ✅ Complete backend service architecture
- ✅ Comprehensive test coverage (57+ test files)
- ✅ Type safety throughout the entire stack
- ✅ Professional error handling and logging
- ✅ Database migrations for schema management
- ✅ Row-Level Security for data protection
- ✅ Real-time collaboration features
- ✅ Performance-optimized caching strategies