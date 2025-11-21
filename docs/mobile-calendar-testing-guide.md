# Mobile Calendar Testing Guide

## Quick Testing Checklist

### 1. Mobile Device (< 900px)

**Test on**: iPhone SE (375px), iPhone 12 (390px), Android phones

**Expected Behavior**:
- ✅ Calendar shows `timeGridDay` view (single day)
- ✅ Header shows: `prev | title | next | today`
- ✅ Time slots display at 1-hour intervals (6 AM - 10 PM)
- ✅ Event cards minimum 60px height
- ✅ All buttons minimum 48x48px
- ✅ No drag-and-drop functionality
- ✅ No horizontal scrolling
- ✅ Font size 16px (prevents iOS zoom)
- ✅ Padding reduced to 8px

**Test Actions**:
1. Resize browser to 375px width
2. Click events - should be easy to tap
3. Navigate prev/next - smooth transitions
4. Click "Today" button - returns to current date
5. Rotate to landscape - view adjusts

### 2. Tablet Device (900-1200px)

**Test on**: iPad (768px), iPad Pro (1024px)

**Expected Behavior**:
- ✅ Calendar shows `timeGridThreeDay` view (3 consecutive days)
- ✅ Header shows: `prev next today | title | day/3days/week`
- ✅ Time slots at 30-minute intervals
- ✅ Event cards minimum 45px height
- ✅ Buttons minimum 42x42px
- ✅ Drag-and-drop enabled
- ✅ Event resizing enabled
- ✅ View switcher functional

**Test Actions**:
1. Resize browser to 1000px width
2. Switch between Day/3Day/Week views
3. Drag event to different time - should work
4. Resize event - should work
5. Click date - opens add dialog

### 3. Desktop (> 1200px)

**Test on**: Desktop browsers, large screens

**Expected Behavior**:
- ✅ Calendar shows `timeGridWeek` view (7 days)
- ✅ Header shows: `prev next today | title | month/week/day`
- ✅ Full editing controls
- ✅ Custom scrollbars visible
- ✅ Hover effects on events
- ✅ All interaction features enabled

**Test Actions**:
1. Open in full browser window
2. Test all view switches (Month/Week/Day)
3. Drag events between days
4. Resize events from start and end
5. Hover over events - visual feedback

## Responsive Breakpoint Tests

### Test Breakpoint Transitions

1. **Start at Desktop (1400px)**
   - Verify: timeGridWeek view, full controls

2. **Resize to Tablet (1000px)**
   - Verify: Auto-switches to timeGridThreeDay
   - Verify: Controls adjust, drag-drop still works

3. **Resize to Mobile (600px)**
   - Verify: Auto-switches to timeGridDay
   - Verify: Toolbar stacks vertically
   - Verify: Drag-drop disabled

4. **Resize back to Desktop (1400px)**
   - Verify: Returns to timeGridWeek
   - Verify: All features restored

## Touch Target Verification

Use browser DevTools to measure touch targets:

```javascript
// Run in console to check button sizes
document.querySelectorAll('.fc-button').forEach(btn => {
  const rect = btn.getBoundingClientRect();
  console.log(`Button: ${rect.width}x${rect.height}px`);
  if (rect.width < 44 || rect.height < 44) {
    console.warn('❌ Button too small:', btn);
  }
});

// Check event cards
document.querySelectorAll('.fc-event').forEach(event => {
  const rect = event.getBoundingClientRect();
  console.log(`Event: ${rect.height}px`);
  if (rect.height < 50) {
    console.warn('❌ Event too small:', event);
  }
});
```

## iOS-Specific Tests

### Prevent Zoom on Input Focus

1. Open on iOS Safari
2. Click any button or event
3. Verify: No zoom occurs (text size >= 16px)

### Touch Gestures

1. Tap events - should respond immediately
2. Scroll time grid - smooth scrolling
3. Pinch zoom - should be disabled on calendar
4. Long press - no context menu on events

## Performance Tests

### Load Time

```javascript
// Measure calendar render time
console.time('Calendar Load');
// Navigate to schedule page
console.timeEnd('Calendar Load');
// Should be < 2s on mobile, < 1s on desktop
```

### Interaction Response

1. Click event - should respond < 100ms
2. Switch view - should complete < 300ms
3. Navigate date - should render < 200ms

## Accessibility Tests

### Keyboard Navigation

1. Tab through calendar controls
2. Verify: Visible focus indicators
3. Press Enter on buttons - should activate
4. Arrow keys - should navigate time grid

### Screen Reader

1. Enable screen reader (VoiceOver/TalkBack)
2. Navigate calendar
3. Verify: Announces dates, events, buttons
4. Verify: Time slots readable

## Browser Compatibility

Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS 12+)
- ✅ Chrome Mobile (Android)

## Common Issues & Solutions

### Issue: Events too small on mobile
**Solution**: Check `eventMinHeight` in config, should be 50+

### Issue: Horizontal scrolling on mobile
**Solution**: Verify `fc-scroller` has `overflow-x: hidden`

### Issue: View doesn't auto-switch
**Solution**: Check `useEffect` hook for `isMobile/isTablet` changes

### Issue: Drag-drop works on mobile
**Solution**: Verify `editable: false` in mobile config

### Issue: Buttons too small
**Solution**: Check CSS min-width/min-height >= 44px

## Visual Regression Tests

Take screenshots at each breakpoint:

```bash
# Using Playwright or Puppeteer
npm run test:visual

# Manual comparison
1. Take screenshot at 375px
2. Take screenshot at 1000px
3. Take screenshot at 1400px
4. Compare with baseline
```

## Testing Checklist Summary

### Mobile (< 900px)
- [ ] Single day view
- [ ] 1-hour time slots
- [ ] 60px minimum event height
- [ ] 48px minimum button size
- [ ] No drag-drop
- [ ] No horizontal scroll
- [ ] 16px font size
- [ ] Vertical toolbar

### Tablet (900-1200px)
- [ ] Three-day view
- [ ] 30-min time slots
- [ ] 45px minimum event height
- [ ] 42px minimum button size
- [ ] Drag-drop enabled
- [ ] Event resizing works
- [ ] View switcher functional

### Desktop (> 1200px)
- [ ] Week view
- [ ] 30-min time slots
- [ ] Full controls
- [ ] Hover effects
- [ ] Custom scrollbars
- [ ] All interactions work

### Cross-Device
- [ ] Auto-switches on resize
- [ ] No console errors
- [ ] Smooth animations
- [ ] Touch targets >= 44px
- [ ] Accessible via keyboard
- [ ] Screen reader compatible

## Automated Testing

Add to test suite:

```javascript
describe('Mobile Calendar Responsive', () => {
  it('should show day view on mobile', () => {
    cy.viewport(375, 667);
    cy.visit('/schedule');
    cy.get('.fc-view-harness')
      .should('have.class', 'fc-timeGridDay-view');
  });

  it('should show three-day view on tablet', () => {
    cy.viewport(1000, 768);
    cy.visit('/schedule');
    cy.get('.fc-view-harness')
      .should('have.class', 'fc-timeGridThreeDay-view');
  });

  it('should have touch-friendly buttons on mobile', () => {
    cy.viewport(375, 667);
    cy.visit('/schedule');
    cy.get('.fc-button').each(($btn) => {
      expect($btn.width()).to.be.at.least(44);
      expect($btn.height()).to.be.at.least(44);
    });
  });
});
```

## Sign-Off Checklist

Before marking complete:

- [ ] All breakpoints tested on real devices
- [ ] Touch targets verified (>= 44px)
- [ ] No horizontal scrolling
- [ ] Auto-responsive on resize
- [ ] Accessibility verified
- [ ] Performance metrics met
- [ ] Cross-browser tested
- [ ] iOS zoom prevented
- [ ] Screenshots documented
- [ ] Code reviewed

## Test Results Template

```markdown
## Test Results - [Date]

**Tester**: [Name]
**Devices**: iPhone 12, iPad Pro, Desktop Chrome

### Mobile (375px)
- ✅ Day view loads
- ✅ Touch targets correct
- ✅ No horizontal scroll
- ⚠️  Minor: [Any issues]

### Tablet (1000px)
- ✅ Three-day view loads
- ✅ Drag-drop works
- ✅ View switching works

### Desktop (1400px)
- ✅ Week view loads
- ✅ All features work
- ✅ Hover effects present

### Issues Found
1. [Issue description] - [Severity] - [Status]

### Screenshots
- Mobile: [Link]
- Tablet: [Link]
- Desktop: [Link]
```
