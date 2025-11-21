# UI Component Specifications

## Overview

Visual and functional specifications for department assignment UI components, including component hierarchy, props interfaces, styling guidelines, and interaction patterns.

---

## 1. Component Architecture

### Component Hierarchy

```
App
├── DepartmentErrorBoundary
│   ├── DepartmentManagementPage
│   │   ├── DepartmentSidebar
│   │   │   ├── DepartmentTree
│   │   │   │   └── DepartmentNode (recursive)
│   │   │   └── UnassignedEmployeesBadge
│   │   │
│   │   ├── EmployeeListPanel
│   │   │   ├── EmployeeFilters
│   │   │   ├── BulkActionToolbar
│   │   │   └── EmployeeTable
│   │   │       ├── EmployeeRow
│   │   │       └── DepartmentSelector
│   │   │
│   │   └── DepartmentDetailsPanel
│   │       ├── DepartmentHeader
│   │       ├── DepartmentAnalyticsChart
│   │       ├── DepartmentMetricsGrid
│   │       └── DepartmentEmployeeList
│   │
│   ├── BulkAssignmentModal
│   │   ├── EmployeeSelectionList
│   │   ├── DepartmentSelector
│   │   ├── ProgressIndicator
│   │   └── ResultsSummary
│   │
│   └── AssignmentHistoryModal
│       ├── HistoryFilters
│       ├── AssignmentTimeline
│       └── ExportButton
```

---

## 2. Core Components

### DepartmentSelector

**Purpose:** Dropdown component for selecting a department with hierarchical navigation

**Props:**
```typescript
interface DepartmentSelectorProps {
  value: number | null;
  onChange: (departmentId: number | null) => void;
  allowNull?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showEmployeeCount?: boolean;
  filterInactive?: boolean;
}
```

**Visual Specifications:**

```
┌─────────────────────────────────────┐
│ Select Department...            ▼  │
├─────────────────────────────────────┤
│ • Engineering (45)                  │
│   ├─ Backend (20)                   │
│   ├─ Frontend (15)                  │
│   └─ DevOps (10)                    │
│ • Sales (30)                        │
│   ├─ Inside Sales (15)              │
│   └─ Enterprise (15)                │
│ • HR (12)                           │
│ ─────────────────────                │
│ ⊗ Unassign                          │
└─────────────────────────────────────┘
```

**Features:**
- Hierarchical department tree with indentation
- Employee count badges
- Search/filter functionality
- "Unassign" option (if `allowNull=true`)
- Keyboard navigation (arrow keys, Enter, Esc)
- Loading state with skeleton
- Empty state for no departments

**States:**
- Default
- Focused
- Disabled
- Loading
- Error
- Open/Collapsed

**Styling:**
```css
.department-selector {
  min-width: 250px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.department-selector:hover {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.department-selector.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.department-option {
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.department-option.level-1 { padding-left: 24px; }
.department-option.level-2 { padding-left: 36px; }
.department-option.level-3 { padding-left: 48px; }

.department-option:hover {
  background: #f3f4f6;
}

.employee-count {
  color: #6b7280;
  font-size: 12px;
  margin-left: 8px;
}
```

**Example Usage:**
```tsx
<DepartmentSelector
  value={selectedDepartmentId}
  onChange={handleDepartmentChange}
  allowNull={true}
  placeholder="Select a department..."
  showEmployeeCount={true}
  size="md"
/>
```

---

### BulkAssignmentModal

**Purpose:** Modal for bulk assigning employees to a department with progress tracking

**Props:**
```typescript
interface BulkAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmployees: Employee[];
  onConfirm: (departmentId: number | null) => Promise<void>;
  title?: string;
}
```

**Visual Layout:**

```
┌────────────────────────────────────────────────┐
│  Bulk Assign Employees                      ✕  │
├────────────────────────────────────────────────┤
│                                                │
│  Assigning 15 employees:                       │
│  ┌────────────────────────────────────────┐   │
│  │ ☑ John Doe                             │   │
│  │ ☑ Jane Smith                           │   │
│  │ ☑ Mike Johnson                         │   │
│  │ ... +12 more                           │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  To Department:                                │
│  ┌────────────────────────────────────────┐   │
│  │ Engineering ▼                          │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  ┌────────────────────────────────────────┐   │
│  │ ████████████░░░░░░░░░░░░ 50%          │   │
│  │ Processing... (8/15 complete)          │   │
│  └────────────────────────────────────────┘   │
│                                                │
│  ┌────────────────────────────────────────┐   │
│  │ ✓ Success: 8                           │   │
│  │ ✗ Failed: 2                            │   │
│  │   • Employee #123: Already assigned    │   │
│  │   • Employee #456: Department inactive │   │
│  │ ⏳ Pending: 5                          │   │
│  └────────────────────────────────────────┘   │
│                                                │
│           [Cancel]  [Assign (15)]             │
└────────────────────────────────────────────────┘
```

**Workflow States:**

1. **Selection State**
   - Shows selected employees
   - Department selector
   - Confirm button enabled

2. **Processing State**
   - Progress bar animating
   - Real-time count updates
   - Cancel button (to stop)

3. **Results State**
   - Success/failure summary
   - Detailed error list
   - Close button

**Features:**
- Real-time progress indication
- Partial success handling
- Detailed error messages
- Retry failed assignments
- Export results to CSV
- Keyboard shortcuts (Esc to cancel)

**Component Structure:**
```tsx
const BulkAssignmentModal: React.FC<BulkAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedEmployees,
  onConfirm
}) => {
  const { bulkAssign, progress, results, isLoading } = useBulkAssignment();
  const [departmentId, setDepartmentId] = useState<number | null>(null);

  const handleSubmit = async () => {
    await bulkAssign(
      selectedEmployees.map(e => e.id),
      departmentId
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>Bulk Assign Employees</ModalHeader>
      <ModalBody>
        <EmployeeSelectionList employees={selectedEmployees} />
        <DepartmentSelector
          value={departmentId}
          onChange={setDepartmentId}
          allowNull={true}
        />
        {isLoading && <ProgressIndicator progress={progress} />}
        {results && <ResultsSummary results={results} />}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!departmentId || isLoading}
        >
          Assign ({selectedEmployees.length})
        </Button>
      </ModalFooter>
    </Modal>
  );
};
```

---

### DepartmentAnalyticsChart

**Purpose:** Visual analytics dashboard for department metrics and trends

**Props:**
```typescript
interface DepartmentAnalyticsChartProps {
  departmentId: number;
  timeRange?: '7d' | '30d' | '90d' | '1y';
  showTrends?: boolean;
  compact?: boolean;
}
```

**Visual Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Engineering Department Analytics          [7d][30d][90d][1y] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────┐  ┌───────────────────┐         │
│  │  Total Employees  │  │  Active           │         │
│  │      45 ↑         │  │      42 ↑         │         │
│  │  +5 this month    │  │  +3 this week     │         │
│  └───────────────────┘  └───────────────────┘         │
│                                                         │
│  ┌───────────────────┐  ┌───────────────────┐         │
│  │  Avg Tenure       │  │  Turnover Rate    │         │
│  │   2.3 years       │  │      8%           │         │
│  │  +0.2 YoY         │  │  -2% YoY          │         │
│  └───────────────────┘  └───────────────────┘         │
│                                                         │
│  Employee Count Trend                                   │
│  ┌────────────────────────────────────────────────┐   │
│  │ 50 •                                           │   │
│  │ 45 •───•───•───•───•───•───•───•───•───•      │   │
│  │ 40     •       •               •       •       │   │
│  │ 35                                             │   │
│  │ 30                                             │   │
│  │    J   F   M   A   M   J   J   A   S   O      │   │
│  └────────────────────────────────────────────────┘   │
│                                                         │
│  By Role                        By Position             │
│  ┌──────────────────┐          ┌──────────────────┐   │
│  │ ████████ Dev (20)│          │ ████████ Sr (15) │   │
│  │ ██████ QA (15)   │          │ ██████ Mid (18)  │   │
│  │ ████ DevOps (10) │          │ ████ Jr (12)     │   │
│  └──────────────────┘          └──────────────────┘   │
│                                                         │
│  [Export PDF]  [Export CSV]  [Share]                   │
└─────────────────────────────────────────────────────────┘
```

**Chart Types:**
1. **Metrics Cards** - Key statistics with trends
2. **Line Chart** - Employee count over time
3. **Bar Charts** - Distribution by role/position
4. **Donut Charts** - Percentage breakdowns

**Features:**
- Interactive tooltips
- Time range selector
- Real-time updates
- Export functionality
- Responsive design (mobile-friendly)
- Drill-down capability

**Styling:**
```css
.analytics-chart {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.metric-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.metric-value {
  font-size: 32px;
  font-weight: 700;
  margin: 8px 0;
}

.metric-trend {
  font-size: 14px;
  opacity: 0.9;
}

.metric-trend.positive { color: #10b981; }
.metric-trend.negative { color: #ef4444; }

.chart-container {
  margin-top: 24px;
  min-height: 300px;
}
```

---

### AssignmentHistoryTimeline

**Purpose:** Chronological view of department assignment changes

**Props:**
```typescript
interface AssignmentHistoryTimelineProps {
  departmentId?: number;
  employeeId?: number;
  limit?: number;
  showFilters?: boolean;
}
```

**Visual Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Assignment History                [Filters ▼]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Today                                              │
│  ──────────────────────────────────────────────     │
│  ⊙ 10:30 AM                                         │
│  │  John Doe assigned to Engineering               │
│  │  by Admin User                                  │
│  │  From: Sales → To: Engineering                  │
│  │                                                  │
│  ⊙ 09:15 AM                                         │
│  │  Jane Smith unassigned from HR                  │
│  │  by HR Manager                                  │
│  │  From: HR → To: Unassigned                      │
│  │                                                  │
│  Yesterday                                          │
│  ──────────────────────────────────────────────     │
│  ⊙ 4:45 PM                                          │
│  │  Bulk Assignment (15 employees)                 │
│  │  To: Sales Department                           │
│  │  by System Admin                                │
│  │  [View Details]                                 │
│  │                                                  │
│  ⊙ 2:20 PM                                          │
│  │  Mike Johnson assigned to DevOps                │
│  │  by Team Lead                                   │
│  │  From: Engineering → To: DevOps                 │
│  │  Reason: Team restructuring                     │
│  │                                                  │
│                                                     │
│  [Load More] [Export CSV]                          │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Infinite scroll / pagination
- Date grouping (Today, Yesterday, Last Week, etc.)
- Color-coded events (assignment=blue, unassignment=red)
- Filter by employee, department, date range
- Export to CSV/PDF
- Bulk operation expansion
- Search functionality

**Component Structure:**
```tsx
const AssignmentHistoryTimeline: React.FC<AssignmentHistoryTimelineProps> = ({
  departmentId,
  employeeId,
  limit = 20,
  showFilters = true
}) => {
  const { history, hasMore, loadMore, isLoading } = useDepartmentHistory({
    departmentId,
    employeeId,
    limit
  });

  return (
    <div className="history-timeline">
      {showFilters && <HistoryFilters />}

      <div className="timeline">
        {history.map((entry, index) => (
          <TimelineEntry key={entry.id} entry={entry} />
        ))}
      </div>

      {hasMore && (
        <Button onClick={loadMore} loading={isLoading}>
          Load More
        </Button>
      )}
    </div>
  );
};
```

---

### UnassignedEmployeesList

**Purpose:** Widget displaying employees without department assignment

**Props:**
```typescript
interface UnassignedEmployeesListProps {
  limit?: number;
  showBulkActions?: boolean;
  onEmployeeClick?: (employee: Employee) => void;
  compact?: boolean;
}
```

**Visual Layout:**

```
┌──────────────────────────────────────┐
│  Unassigned Employees (23)      [⊕] │
├──────────────────────────────────────┤
│  ☐  John Doe                         │
│      Software Engineer               │
│      Hired: 2024-01-15               │
│  ────────────────────────────────    │
│  ☐  Jane Smith                       │
│      Marketing Manager               │
│      Hired: 2024-02-01               │
│  ────────────────────────────────    │
│  ☐  Mike Johnson                     │
│      Sales Representative            │
│      Hired: 2024-02-10               │
│  ────────────────────────────────    │
│                                      │
│  Selected: 0                         │
│  [Bulk Assign]  [View All (23)]     │
└──────────────────────────────────────┘
```

**Features:**
- Real-time count badge
- Checkbox selection
- Quick assign (click employee)
- Bulk assign button
- Sort by hire date, name, position
- Search filter
- Empty state message

**States:**
- Empty (no unassigned employees)
- Loading (skeleton)
- Populated
- Selection mode

**Styling:**
```css
.unassigned-badge {
  background: #ef4444;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 8px;
}

.unassigned-list-item {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background 0.15s;
}

.unassigned-list-item:hover {
  background: #f9fafb;
}

.unassigned-list-item.selected {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
}
```

---

## 3. Layout Specifications

### DepartmentManagementPage Layout

**Desktop (≥1024px):**
```
┌──────────────────────────────────────────────────────────────┐
│  Header: Department Management                     [+ New]   │
├──────┬───────────────────────────────────────────────────────┤
│      │  Employee List                                        │
│      │  ┌────────────────────────────────────────────────┐  │
│      │  │ [Search...] [Filter ▼] [Bulk Actions ▼]      │  │
│ Dept │  ├────────────────────────────────────────────────┤  │
│ Tree │  │ ☐  Name        Position      Department  ⚙️  │  │
│      │  │ ☐  John Doe    Developer     Engineering  ⚙️  │  │
│ 240px│  │ ☐  Jane Smith  Manager       Sales        ⚙️  │  │
│      │  └────────────────────────────────────────────────┘  │
│      │                                                       │
│      │  Department Analytics                                │
│      │  ┌────────────────────────────────────────────────┐  │
│      │  │  [Charts and Metrics]                          │  │
│      │  └────────────────────────────────────────────────┘  │
└──────┴───────────────────────────────────────────────────────┘
```

**Tablet (768px-1023px):**
```
┌────────────────────────────────────┐
│  Header                       [☰] │
├────────────────────────────────────┤
│  Employee List (Full Width)        │
│  ┌──────────────────────────────┐ │
│  │ [Search...] [Filter ▼]      │ │
│  ├──────────────────────────────┤ │
│  │ Employees...                 │ │
│  └──────────────────────────────┘ │
│                                    │
│  [Show Department Tree]            │
└────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌──────────────────┐
│  [☰]  Departments│
├──────────────────┤
│  [Search...]     │
│  ┌────────────┐ │
│  │ John Doe   │ │
│  │ Engineering│ │
│  │ [Assign]   │ │
│  └────────────┘ │
│  ┌────────────┐ │
│  │ Jane Smith │ │
│  │ Sales      │ │
│  │ [Assign]   │ │
│  └────────────┘ │
└──────────────────┘
```

---

## 4. Interaction Patterns

### Drag and Drop Assignment

```typescript
// Enable drag-and-drop from employee list to department tree
const handleDragStart = (e: DragEvent, employee: Employee) => {
  e.dataTransfer.setData('employeeId', employee.id.toString());
};

const handleDrop = (e: DragEvent, departmentId: number) => {
  e.preventDefault();
  const employeeId = parseInt(e.dataTransfer.getData('employeeId'));
  assignDepartment(employeeId, departmentId);
};
```

**Visual Feedback:**
- Dragging employee: Opacity 0.5, blue outline
- Valid drop target: Green highlight, dashed border
- Invalid drop target: Red highlight, cursor not-allowed
- Drop success: Fade animation, toast notification

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+A` | Select all visible employees |
| `Ctrl+B` | Open bulk assignment modal |
| `Ctrl+F` | Focus search input |
| `Esc` | Clear selection / Close modal |
| `Enter` | Confirm action |
| `↑/↓` | Navigate list |
| `Space` | Toggle selection |

---

## 5. Responsive Design Guidelines

### Breakpoints

```css
/* Mobile */
@media (max-width: 767px) {
  .department-sidebar { display: none; }
  .employee-table { display: block; }
  .employee-row {
    flex-direction: column;
    padding: 12px;
  }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  .department-sidebar {
    position: absolute;
    transform: translateX(-100%);
    transition: transform 0.3s;
  }
  .department-sidebar.open {
    transform: translateX(0);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .department-sidebar {
    position: static;
    width: 240px;
  }
}
```

---

## 6. Accessibility (a11y)

### ARIA Labels and Roles

```tsx
<div
  role="region"
  aria-label="Department assignment interface"
  aria-live="polite"
>
  <button
    aria-label={`Assign ${employee.firstName} to department`}
    aria-describedby="department-selector-description"
  >
    Assign Department
  </button>

  <select
    aria-label="Select department"
    aria-required="true"
    aria-invalid={!!error}
  >
    {/* Options */}
  </select>
</div>
```

### Focus Management

- Trap focus within modals
- Return focus after modal close
- Skip links for keyboard navigation
- Visible focus indicators (2px blue outline)

### Screen Reader Support

```tsx
<span className="sr-only">
  {results.updated} employees successfully assigned,
  {results.failed} failed
</span>

<div aria-live="assertive" aria-atomic="true">
  {/* Dynamic status updates */}
</div>
```

---

## 7. Animation Specifications

### Transitions

```css
/* Modal entrance */
@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-enter {
  animation: modalSlideIn 0.3s ease-out;
}

/* Progress bar fill */
@keyframes progressFill {
  from { width: 0%; }
  to { width: var(--progress-width); }
}

.progress-bar {
  animation: progressFill 0.5s ease-out;
}

/* Success checkmark */
@keyframes checkmarkDraw {
  0% { stroke-dashoffset: 100; }
  100% { stroke-dashoffset: 0; }
}
```

---

## 8. Theme Customization

### CSS Custom Properties

```css
:root {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;

  --border-radius: 6px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);

  --spacing-unit: 8px;
  --font-family: 'Inter', sans-serif;
}
```

---

## Summary

This specification provides:

✅ **6 Core Components** with detailed props and visual specs
✅ **Responsive Layouts** for desktop, tablet, and mobile
✅ **Interaction Patterns** including drag-and-drop and keyboard shortcuts
✅ **Accessibility Standards** with ARIA labels and screen reader support
✅ **Animation Guidelines** for smooth user experience
✅ **Theme Customization** with CSS custom properties

**Implementation Checklist:**
- [ ] Build DepartmentSelector with hierarchical tree
- [ ] Implement BulkAssignmentModal with progress tracking
- [ ] Create DepartmentAnalyticsChart with Chart.js or Recharts
- [ ] Design AssignmentHistoryTimeline with infinite scroll
- [ ] Build UnassignedEmployeesList widget
- [ ] Add drag-and-drop functionality
- [ ] Implement keyboard shortcuts
- [ ] Test responsive layouts on all breakpoints
- [ ] Validate accessibility with screen readers
- [ ] Set up theme variables

**Recommended Libraries:**
- **Charts:** Recharts, Chart.js, or Victory
- **Modals:** Radix UI, Headless UI
- **Drag & Drop:** react-beautiful-dnd, dnd-kit
- **Tables:** TanStack Table (React Table v8)
- **Forms:** React Hook Form, Formik
- **Icons:** Heroicons, Lucide React
