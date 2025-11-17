# PR Setup Guide

## Step 1: Push Branch to Remote

```bash
git push -u origin multi-tenant-system-implementation
```

## Step 2: Create Pull Request

### Option A: Via GitHub Web Interface (Recommended)

1. **Go to GitHub**: https://github.com/marchalgreen/Rundeklar
2. **Click "Pull requests"** tab
3. **Click "New pull request"**
4. **Select branches**:
   - Base: `main`
   - Compare: `multi-tenant-system-implementation`
5. **Click "Create pull request"**
6. **Copy PR description** from `PR_DESCRIPTION.md` into the PR body
7. **Add title**: `feat: Multi-tenant system implementation with PIN authentication`
8. **Click "Create pull request"**

### Option B: Via GitHub CLI (if installed)

```bash
gh pr create --base main --head multi-tenant-system-implementation --title "feat: Multi-tenant system implementation with PIN authentication" --body-file PR_DESCRIPTION.md
```

## Step 3: Review Checklist

Before requesting review, ensure:

- [ ] All validation steps pass (`pnpm validate`, `pnpm build`)
- [ ] PR description is complete
- [ ] All critical issues addressed (see `CRITICAL_REVIEW.md`)
- [ ] Database migrations tested on staging
- [ ] Manual testing checklist completed

## PR Title Suggestion

```
feat: Multi-tenant system implementation with PIN authentication
```

## Quick Commands

```bash
# Push branch
git push -u origin multi-tenant-system-implementation

# Verify commits
git log main..HEAD --oneline

# Check file changes
git diff --stat main...HEAD
```

