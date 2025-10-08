# Perfect Task App - Claude Code Context

> This file is automatically loaded by Claude Code. Keep it concise and iterate on effectiveness.

## Project Overview

Perfect Task App is a cross-platform task management application with a unified codebase that compiles to **iOS, Android, Web, and macOS desktop**. Built with Next.js + Capacitor + Tauri in a pnpm monorepo.

**Live Instance**: Connects to hosted Supabase (no local Docker setup)

## Tech Stack

- **Backend**: Supabase (PostgreSQL + real-time + auth)
- **Frontend**: Next.js 15 + Capacitor (mobile) + Tauri (desktop)
- **State Management**: TanStack Query (server state) + Zustand (client state)
- **Validation**: Zod schemas (runtime + compile-time types)
- **UI**: shadcn/ui (10 components) + Tailwind CSS
- **Monorepo**: pnpm workspaces + Turborepo
- **Testing**: Jest + React Testing Library

## Project Structure

```
perfect-task-app/
├── apps/
│   ├── web/              # Next.js 15 app (primary, builds for all platforms)
│   ├── mobile/           # Capacitor config (iOS, Android)
│   └── desktop/          # Tauri config (macOS, Windows)
├── packages/
│   ├── models/           # ⚠️ SINGLE SOURCE OF TRUTH - Zod schemas only
│   ├── data/             # Supabase client + services + TanStack Query hooks
│   └── ui/               # shadcn/ui components + Tailwind config
├── supabase/migrations/  # Database schema (apply via psql, never dashboard)
└── docs/                 # Documentation by concern
    ├── project-wide-context/  # Architecture deep-dives
    ├── infrastructure/        # Non-feature builds (auth, deployment)
    └── features/              # Feature-specific docs
```

## Essential Commands

**IMPORTANT**: Run all commands from **root directory**. Never run dev servers in background - user must run them to see logs.

```bash
# Development (requires two terminals)
pnpm dev:web          # Terminal 1: Start Next.js at http://localhost:3000
pnpm dev:mobile       # Terminal 2: Launch iOS/Android (requires web running first)
pnpm dev:desktop      # Alternative: Launch Tauri desktop app

# Build & Quality
pnpm build            # Full TypeScript compilation check across monorepo
pnpm lint             # ESLint (zero warnings tolerance)
pnpm test             # Run complete test suite
pnpm test:watch       # Tests in watch mode

# Database Migrations (ALWAYS use psql, NEVER copy/paste to dashboard)
psql "postgresql://postgres.ewuhxqbfwbenkhnkzokp:bVK*uKBtLv\$pnL8@aws-1-us-east-2.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/YOUR_MIGRATION_FILE.sql
```

## Critical Rules - READ FIRST

### 🚨 Schema Management (NEVER VIOLATE)

**`packages/models/index.ts` IS THE SINGLE SOURCE OF TRUTH**

- **NEVER modify Zod schemas without explicit human permission**
- Schema changes affect entire application AND database structure
- Services derive FROM models, NEVER the other way around
- If drift exists between services and models → fix services to match models
- All schema changes REQUIRE coordinated database migrations

### Data Flow Architecture (Golden Path)

```
UI Component → Custom Hook → Service Function → Supabase → Zod Validation → TanStack Query Cache → UI Re-render
```

**Every layer has a specific responsibility:**
- **UI**: Rendering and user interaction only
- **Hooks**: Data lifecycle (loading, error, success states)
- **Services**: Direct Supabase communication + Zod validation
- **Models**: Data shape definitions (Zod schemas)

### Supabase Client Usage

**IMPORTANT**: All code uses the **shared authenticated client** from `packages/data/supabase.ts`

```typescript
// ✅ CORRECT - Single client with session management
import { getSupabaseClient } from '@perfect-task-app/data'
const supabase = getSupabaseClient()

// ❌ WRONG - Do not create new clients
import { createClient } from '@supabase/supabase-js'
```

The shared client uses `createBrowserClient` from `@supabase/ssr` for proper session persistence.

### Service Layer Pattern

Every service function MUST follow this exact pattern:

```typescript
import { getSupabaseClient } from '../supabase'
import { YourSchema } from '@perfect-task-app/models'

const supabase = getSupabaseClient()

export const serviceFunction = async (params): Promise<Type> => {
  try {
    // 1. Supabase API call
    const { data, error } = await supabase.from('table').select('*')

    // 2. Error handling
    if (error) throw new Error(`Context: ${error.message}`)

    // 3. Zod validation (REQUIRED for type safety)
    const validated = YourSchema.parse(data)

    // 4. Return type-safe data
    return validated
  } catch (error) {
    console.error('Service.function error:', error)
    throw error
  }
}
```

### TanStack Query Hook Pattern

Every React hook MUST follow this pattern:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { serviceFunction } from '../services/yourService'

// Query Hook
export const useYourData = (id: string) => {
  return useQuery({
    queryKey: ['entity', id],
    queryFn: () => serviceFunction(id),
    enabled: !!id,
    staleTime: 60000, // Adjust based on data volatility
  })
}

// Mutation Hook
export const useUpdateYourData = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateServiceFunction,
    onSuccess: () => {
      // Granular cache invalidation
      queryClient.invalidateQueries({ queryKey: ['entity'] })
    },
  })
}
```

## Code Style & Conventions

### File Organization
- **TypeScript everywhere** - All files use `.ts` or `.tsx`
- **Follow existing patterns** - Check neighboring files for naming conventions
- **Component placement**:
  - UI components → `packages/ui`
  - Page components → `apps/web/app` (Next.js App Router)
  - Hooks → `packages/data/hooks`
  - Services → `packages/data/services`

### Import Patterns
```typescript
// ✅ CORRECT - Use package aliases
import { Task } from '@perfect-task-app/models'
import { useProjectTasks } from '@perfect-task-app/data'
import { Button, Card } from '@perfect-task-app/ui'

// ❌ WRONG - Relative imports across packages
import { Task } from '../../packages/models'
```

### Component Conventions
- UI components are pure presentation (no data fetching)
- Use `cn()` utility from `@perfect-task-app/ui` for conditional classes
- All shadcn/ui components support `className` prop for customization
- Follow Radix UI accessibility patterns (ARIA, keyboard nav)

## Database & Migrations

### Connection Details
- **Remote-first development** - Connects directly to hosted Supabase
- **URL**: `https://ewuhxqbfwbenkhnkzokp.supabase.co`
- **No local Docker** - Project does NOT use `supabase start`

### Migration Best Practices
1. **Create migration files** in `supabase/migrations/` with timestamp prefix
2. **Apply via psql** (command above) - NEVER copy/paste SQL to Supabase Dashboard
3. **Idempotent migrations** - Use `IF NOT EXISTS`, `IF EXISTS` clauses
4. **RLS policies** - All user data tables MUST have Row-Level Security enabled
5. **Test migrations** - Verify with SELECT queries after applying

### Security (Row-Level Security)
All tables with user data have RLS enabled. Policies enforce:
- Users can only access their own data
- Project collaboration via `project_users` join table
- No service bypasses RLS (all use anon key, not service role key)

## Testing Strategy

### Test Coverage
- **Service Integration Tests** - Test against live Supabase instance
- **Hook Unit Tests** - Isolated testing with mocked services
- **Full CRUD Coverage** - Every service function tested
- **RLS Security Tests** - Verify Row-Level Security policies

### Test Commands
```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode for development
pnpm test packages/data/services  # Test specific package
```

## Common Pitfalls to Avoid

### ❌ NEVER DO THESE:
1. Modify Zod schemas without permission
2. Create duplicate Supabase clients
3. Fetch data directly in UI components
4. Copy/paste SQL to Supabase Dashboard
5. Bypass Zod validation in services
6. Run dev servers with Bash tool in background
7. Use relative imports across packages
8. Skip RLS policies on user data tables

### ✅ ALWAYS DO THESE:
1. Use shared Supabase client from `packages/data/supabase.ts`
2. Validate ALL Supabase responses with Zod
3. Use TanStack Query for all server state
4. Apply migrations via psql command
5. Follow Golden Path data flow
6. Test cross-platform (iOS, Android, Web)
7. Use package aliases (`@perfect-task-app/*`)
8. Check neighboring files for patterns

## Documentation Map

- **Architecture deep-dive**: `docs/project-wide-context/golden-path.md`
- **Complete tech reference**: `docs/project-wide-context/technical-guide.md`
- **Feature-specific docs**: `docs/features/[feature-name]/`
- **Infrastructure docs**: `docs/infrastructure/`

## Production Readiness Status

✅ Complete backend service architecture
✅ Modern UI component system (shadcn/ui + 10 components)
✅ Cross-platform compatibility (Web, iOS, Android, Desktop)
✅ Comprehensive test coverage (57+ test files)
✅ Type safety throughout entire stack
✅ RLS security for data protection
✅ Real-time collaboration features

---

**Last Updated**: Auto-generated by Claude Code
**Project Version**: Production-ready
**Supabase Project**: `ewuhxqbfwbenkhnkzokp`
