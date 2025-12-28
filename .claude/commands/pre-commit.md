---
description: Run build and type checks before committing
allowed-tools: Bash(pnpm build:*), Bash(find:*), Bash(cd:*), Bash(NEXT_OUTPUT=export pnpm run build)
---

# Pre-Commit Check

Your task is to analyze the results of the following pre-commit checks for this project.

## 1. TypeScript & Lint Check

Run the project's typecheck and lint commands.

**Build Output:**
!`pnpm build 2>&1 | tail -50`

## 2. Next.js Build Check

Run the full Next.js build to catch static generation issues (like missing Suspense boundaries).

**Next.js Build Output:**
!`cd apps/web && NEXT_OUTPUT=export pnpm run build 2>&1 | tail -100`

## 3. Edge Functions Check

Verify TypeScript syntax in Supabase Edge Functions.

**Edge Functions Found:**
!`find supabase/functions -name "*.ts" -type f`

**Note:** Edge Functions use Deno and are validated on deployment via `npx supabase functions deploy`.

## Analysis

Review ALL build outputs above.

**If there are errors:**
- Summarize them clearly
- Identify the problematic files and line numbers
- Provide specific suggestions on how to fix them
- Pay special attention to Next.js static generation errors (useSearchParams, dynamic imports, etc.)

**If all checks pass successfully:**
Respond with: "✅ All pre-commit checks passed. Ready to commit."

Include:
- TypeScript/Lint status
- Next.js build status
- Number of Edge Function files found
- Overall status
