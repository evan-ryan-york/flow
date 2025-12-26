---
description: Merge a PR, resolve conflicts if needed, pull main, and delete branch
allowed-tools: Bash(gh:*), Bash(git:*), AskUserQuestion
---

# Merge PR and Cleanup

This command merges a GitHub PR, handles any merge conflicts interactively, pulls the latest main, and cleans up the branch.

## Arguments

**PR Number:** $ARGUMENTS

If no PR number is provided, prompt the user for it.

## Pre-Execution Context

**Current Branch:**
!`git branch --show-current`

**Git Status:**
!`git status --short`

**PR Details (if number provided):**
!`gh pr view $ARGUMENTS 2>/dev/null || echo "No PR number provided or PR not found"`

## Your Task

### 1. Validate PR Number

If `$ARGUMENTS` is empty or not a valid number:
- Ask the user for the PR number using AskUserQuestion
- Validate the PR exists with `gh pr view <number>`

### 2. Check for Uncommitted Changes

Before proceeding, verify the working tree is clean:

```bash
git status --short
```

If there are uncommitted changes:
- List the modified files
- Ask the user if they want to:
  - Commit changes first (recommend running /commit)
  - Stash changes and proceed
  - Abort the operation

### 3. Store Current Branch Name

Save the current branch for later deletion:

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

### 4. Attempt to Merge the PR

Use GitHub CLI to merge:

```bash
gh pr merge <pr-number> --merge --delete-branch
```

### 5. Handle Merge Conflicts

If the merge fails due to conflicts:

1. **Fetch the latest changes:**
   ```bash
   git fetch origin main
   ```

2. **Attempt to rebase or merge main into current branch:**
   ```bash
   git merge origin/main
   ```

3. **If conflicts occur, identify them:**
   ```bash
   git diff --name-only --diff-filter=U
   ```

4. **For each conflicting file:**
   - Show the conflict markers
   - Ask the user how to resolve:
     - Keep our version (current branch)
     - Keep their version (main)
     - Manual resolution (show both versions and ask for guidance)

5. **After resolving conflicts:**
   ```bash
   git add <resolved-files>
   git commit -m "Resolve merge conflicts"
   git push
   ```

6. **Retry the PR merge:**
   ```bash
   gh pr merge <pr-number> --merge --delete-branch
   ```

### 6. Switch to Main and Pull

After successful merge:

```bash
git checkout main
git pull origin main
```

### 7. Delete Local Branch

Clean up the local feature branch:

```bash
git branch -d <previous-branch-name>
```

If soft delete fails (branch not fully merged), inform user and offer force delete.

### 8. Prune Remote References

Clean up stale remote-tracking branches:

```bash
git fetch --prune
```

### 9. Display Summary

Show final state:

```bash
git log --oneline -5
git branch -a
```

## Conflict Resolution Guide

When asking the user about conflicts, provide context:

```
🔀 Merge Conflict in: <filename>

<<<<<<< HEAD (your changes)
<show your version>
=======
<show their version>
>>>>>>> origin/main

How would you like to resolve this?
1. Keep YOUR changes (from current branch)
2. Keep THEIR changes (from main)
3. Keep BOTH (concatenate)
4. Let me describe what I want...
```

## Example Execution Flow

```
1. Validate PR #42 exists
2. Check working tree is clean
3. Store current branch: feature/my-feature
4. Run: gh pr merge 42 --merge --delete-branch
5. If conflicts:
   - Fetch origin/main
   - Merge origin/main into feature/my-feature
   - Resolve each conflict with user input
   - Push resolved changes
   - Retry merge
6. Switch to main
7. Pull latest: git pull origin main
8. Delete local branch: git branch -d feature/my-feature
9. Prune: git fetch --prune
10. Show summary
```

## Expected Output

```
✅ PR #42 Merged Successfully

Previous branch: feature/my-feature (deleted)
Current branch: main

Latest commits:
<git log --oneline -5>

Remaining branches:
<git branch -a>
```

## Error Handling

### PR Not Found
```
❌ PR #<number> not found.
Please check the PR number and try again.
Use 'gh pr list' to see open PRs.
```

### PR Already Merged
```
ℹ️  PR #<number> is already merged.
Proceeding to pull main and cleanup...
```

### Branch Protection
```
❌ Cannot merge: branch protection rules prevent direct merge.
Please merge via GitHub web interface or request review approval.
```

### Already on Main
```
ℹ️  Already on main branch.
Pulling latest changes and cleaning up...
```
