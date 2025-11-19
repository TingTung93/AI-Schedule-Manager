# MUI Grid Migration Guide - Material UI v7

**Date:** November 19, 2025
**Source:** Official MUI documentation and web research
**Target Version:** MUI v7.3.5

---

## Overview

Material UI v7 deprecated the old Grid component (now renamed to GridLegacy) and promoted Grid2 to become the standard Grid component. The migration requires updating imports and prop syntax.

---

## Key Changes in MUI v7

### 1. Import Changes

**❌ WRONG (What parallel agent used):**
```javascript
import Grid from '@mui/material/Unstable_Grid2';  // This doesn't exist in v7!
```

**✅ CORRECT for MUI v7:**
```javascript
// Option 1: Named import (recommended)
import { Grid } from '@mui/material';

// Option 2: Default import from Grid path
import Grid from '@mui/material/Grid';
```

### 2. Syntax Changes

**Old Grid v1 (GridLegacy) - DEPRECATED:**
```jsx
<Grid container spacing={3}>
  <Grid item xs={12} sm={6} md={4}>
    {/* content */}
  </Grid>
</Grid>
```

**New Grid v2 (Now just "Grid") - RECOMMENDED:**

**Option A: Individual breakpoint props (simpler migration):**
```jsx
<Grid container spacing={3}>
  <Grid xs={12} sm={6} md={4}>  {/* No 'item' prop needed! */}
    {/* content */}
  </Grid>
</Grid>
```

**Option B: Size object (more explicit):**
```jsx
<Grid container spacing={3}>
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
    {/* content */}
  </Grid>
</Grid>
```

---

## Migration Steps

### Step 1: Update Imports

Find all Grid imports and update them:

```bash
# Find files with Grid imports
grep -r "import.*Grid.*from.*@mui" frontend/src
```

**Before:**
```javascript
import { Box, Grid, Card, Typography } from '@mui/material';
```

**After:** (No change needed - Grid is already in @mui/material!)
```javascript
import { Box, Grid, Card, Typography } from '@mui/material';
```

### Step 2: Remove `item` Prop

The new Grid treats every Grid as an item by default.

**Before:**
```jsx
<Grid item xs={12}>
  <Card>Content</Card>
</Grid>
```

**After:**
```jsx
<Grid xs={12}>  {/* Just remove 'item' */}
  <Card>Content</Card>
</Grid>
```

### Step 3: Keep Everything Else

- ✅ `container` prop stays the same
- ✅ `spacing` prop stays the same
- ✅ Breakpoint props (xs, sm, md, lg, xl) stay the same
- ✅ All styling props stay the same

---

## Automated Migration with Codemod

MUI provides an official codemod for migration:

```bash
# Install codemod
npm install -g @mui/codemod

# Run migration
npx @mui/codemod v7.0.0/grid-props frontend/src

# Or for specific files
npx @mui/codemod v7.0.0/grid-props frontend/src/pages/DashboardPage.jsx
```

**⚠️ Warning:** Always review codemod changes before committing!

---

## Manual Migration Example

### Before (Grid v1 with warnings):
```jsx
import React from 'react';
import { Box, Grid, Card, Typography } from '@mui/material';

const DashboardPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <Typography>Stat Card 1</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <Typography>Stat Card 2</Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
```

### After (Grid v2 without warnings):
```jsx
import React from 'react';
import { Box, Grid, Card, Typography } from '@mui/material';  // Same import!

const DashboardPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>  {/* container stays */}
        <Grid xs={12} sm={6} md={4}>  {/* Just removed 'item' */}
          <Card>
            <Typography>Stat Card 1</Typography>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={4}>  {/* Just removed 'item' */}
          <Card>
            <Typography>Stat Card 2</Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
```

**Changes:**
- ✅ Import statement unchanged
- ✅ Removed `item` prop from Grid children
- ✅ Kept all breakpoint props (xs, sm, md, etc.)
- ✅ Kept all other props and styling

---

## Benefits of Grid v2

1. **No `item` prop needed** - All Grid components are items by default
2. **CSS variables** - Better performance and specificity
3. **No negative margins** - No overflow issues like GridLegacy
4. **Nested grids** - No depth limitation
5. **Offset feature** - More flexibility for positioning

---

## Common Patterns

### Responsive Layout
```jsx
// 12 columns on mobile, 6 on tablet, 4 on desktop
<Grid container spacing={2}>
  {items.map((item) => (
    <Grid key={item.id} xs={12} sm={6} md={4}>
      <ItemCard item={item} />
    </Grid>
  ))}
</Grid>
```

### Offset (Positioning)
```jsx
<Grid container>
  <Grid xs={6} offset={3}>  {/* Centered */}
    <Content />
  </Grid>
</Grid>
```

### Nested Grids
```jsx
<Grid container spacing={3}>
  <Grid xs={12} md={8}>
    <Grid container spacing={2}>  {/* Nested grid! */}
      <Grid xs={6}>
        <Card>Left</Card>
      </Grid>
      <Grid xs={6}>
        <Card>Right</Card>
      </Grid>
    </Grid>
  </Grid>
  <Grid xs={12} md={4}>
    <Card>Sidebar</Card>
  </Grid>
</Grid>
```

---

## Testing After Migration

### 1. Visual Testing
- ✅ Check all pages load without errors
- ✅ Verify layouts look identical
- ✅ Test responsive behavior at breakpoints
- ✅ Check nested grids work correctly

### 2. Console Check
```javascript
// Should see NO warnings like:
// ❌ "MUI Grid: The `item` prop has been removed"
// ❌ "MUI Grid: The `xs` prop has been removed"
```

### 3. Build Test
```bash
npm run build
# Should compile without Grid-related warnings
```

---

## Files to Migrate in AI Schedule Manager

Based on grep search, these 22 files need migration:

**Pages (9 files):**
1. `src/pages/DashboardPage.jsx`
2. `src/pages/SchedulePage.jsx`
3. `src/pages/EmployeesPage.jsx`
4. `src/pages/DepartmentManager.jsx`
5. `src/pages/ShiftManager.jsx`
6. `src/pages/RoleManager.jsx`
7. `src/pages/AnalyticsPage.jsx`
8. `src/pages/ProfilePage.jsx`
9. `src/pages/SettingsPage.jsx`

**Components (13 files):**
10. `src/components/Dashboard.jsx`
11. `src/components/ScheduleDisplay.jsx`
12. `src/components/EmployeeManagement.jsx`
13. `src/components/EmployeeManagementValidated.jsx`
14. `src/components/RuleInput.jsx`
15. `src/components/wizard/RequirementsStep.jsx`
16. `src/components/wizard/GenerationStep.jsx`
17. `src/components/wizard/ValidationStep.jsx`
18. `src/components/wizard/PublishStep.jsx`
19. `src/components/wizard/ConfigurationStep.jsx`
20. `src/components/forms/RuleInputForm.jsx`
21. `src/components/forms/ScheduleForm.jsx`
22. `src/components/optimized/MemoizedComponents.jsx`

---

## Migration Checklist

- [ ] Back up current working code
- [ ] Choose migration method (manual or codemod)
- [ ] Migrate one file at a time
- [ ] Test each file after migration
- [ ] Run `npm run build` after each file
- [ ] Check browser console for warnings
- [ ] Test responsive behavior
- [ ] Commit working changes
- [ ] Repeat for all 22 files

---

## Troubleshooting

### Issue: "Can't resolve '@mui/material/Unstable_Grid2'"
**Solution:** This import doesn't exist in v7. Use `import { Grid } from '@mui/material'` instead.

### Issue: "Grid deprecation warnings persist"
**Solution:** Make sure you removed all `item` props from Grid children.

### Issue: "Layout broken after migration"
**Solution:** Verify all breakpoint props (xs, sm, md, lg) are still present. Only the `item` prop should be removed.

### Issue: "Nested grids not working"
**Solution:** Each nested Grid needs its own `container` prop if it contains Grid children.

---

## References

- [Official MUI v7 Migration Guide](https://mui.com/material-ui/migration/upgrade-to-v7/)
- [Grid v2 Upgrade Guide](https://mui.com/material-ui/migration/upgrade-to-grid-v2/)
- [Grid Component Documentation](https://mui.com/material-ui/react-grid/)
- [Grid2 Rollout Plan](https://github.com/mui/material-ui/issues/43437)

---

**Last Updated:** November 19, 2025
**MUI Version:** v7.3.5
**Status:** Ready for migration
