# User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles](#user-roles)
4. [Employee Management](#employee-management)
5. [Department Management](#department-management)
6. [Password Management](#password-management)
7. [Account Status Management](#account-status-management)
8. [Extended Employee Fields](#extended-employee-fields)
9. [Search and Filtering](#search-and-filtering)
10. [Audit Trails](#audit-trails)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

AI Schedule Manager is an intelligent scheduling application designed for small to medium-sized businesses. This guide covers the employee management features implemented in Weeks 1-4, including:

- **Employee CRUD operations** with role-based access control
- **Department assignment** with hierarchical structure
- **Password management** (reset and change)
- **Account status management** (active, locked, verified)
- **Extended fields** (qualifications, availability, hourly rate)
- **Comprehensive audit trails** for compliance

---

## Getting Started

### First Login

1. Navigate to the application URL (default: http://localhost:3000)
2. Enter your email and password
3. If this is your first login with a temporary password, you'll be prompted to change it

### Dashboard Overview

After login, you'll see:
- **Navigation Menu**: Access to Employees, Departments, Schedules, etc.
- **Quick Actions**: Create employee, view schedules, etc.
- **Recent Activity**: Latest system changes

---

## User Roles

The system supports four user roles with different permission levels:

### Role Hierarchy

```
Admin (Full Access)
  └─ Manager (Department + Employee Management)
      └─ User (Standard Employee - Own Profile Only)
          └─ Guest (Read-Only Access)
```

### Permission Matrix

| Action | Admin | Manager | User | Guest |
|--------|-------|---------|------|-------|
| View all employees | ✅ | ✅ | ❌ | ✅ |
| View own profile | ✅ | ✅ | ✅ | ✅ |
| Create employees | ✅ | ✅ | ❌ | ❌ |
| Edit any employee | ✅ | ✅ | ❌ | ❌ |
| Edit own profile | ✅ | ✅ | ✅ | ❌ |
| Delete employees | ✅ | ❌ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ | ❌ |
| Lock/unlock accounts | ✅ | ❌ | ❌ | ❌ |
| Reset passwords | ✅ | ❌ | ❌ | ❌ |
| Change own password | ✅ | ✅ | ✅ | ✅ |
| View audit trails | ✅ | ✅ | Own only | ❌ |

---

## Employee Management

### Viewing Employees

#### Employees List

Navigate to **Employees** in the main menu to see all employees.

**For Admins/Managers**:
- View all employees across all departments
- See employee details including department, role, and status

**For Regular Users**:
- View only your own profile
- Cannot see other employees

**Information Displayed**:
- Name (First and Last)
- Email address
- Role (Admin, Manager, User, Guest)
- Department
- Status (Active, Inactive, Locked)
- Qualifications
- Hourly Rate
- Maximum Hours per Week

---

### Creating Employees

**Required Role**: Admin or Manager

1. Click **"Add Employee"** button
2. Fill in required fields:
   - **First Name** (required)
   - **Last Name** (required)
3. Optional fields:
   - **Email**: Auto-generated if not provided
   - **Department**: Select from dropdown
   - **Qualifications**: Add certifications/skills
   - **Availability**: Set weekly schedule
   - **Hourly Rate**: Set pay rate (0.00-1000.00)
   - **Max Hours per Week**: Set limit (1-168)
4. Click **"Create Employee"**

**Default Values**:
- **Password**: `Employee123!` (user must change on first login)
- **Role**: `user` (standard employee)
- **Status**: Active

**Email Generation**:
If no email is provided, the system generates one automatically:
```
{first}.{last}.{random}@temp.example.com
```

**Example**: `john.doe.a1b2c3d4@temp.example.com`

---

### Editing Employees

**Required Role**:
- Admin/Manager: Can edit any employee
- User: Can edit own profile only (except role)

1. Navigate to employee profile
2. Click **"Edit"** button
3. Modify fields as needed
4. Click **"Save Changes"**

**Editable Fields**:
- First Name, Last Name
- Email (must be unique)
- Department
- Qualifications
- Availability
- Hourly Rate
- Max Hours per Week
- Active Status (Admin/Manager only)
- Role (Admin only)

**Important Notes**:
- Email must be unique across all employees
- Department must be active
- Role changes require Admin privileges
- All changes are logged in audit trail

---

### Deleting Employees

**Required Role**: Admin only

1. Navigate to employee profile
2. Click **"Delete"** button
3. Confirm deletion in dialog

**Warning**: This action cannot be undone. Consider deactivating instead.

**What Happens**:
- Employee record deleted from database
- Audit trail records preserved for compliance
- Schedules and assignments remain (orphaned)

---

## Department Management

### Department Structure

Departments support hierarchical organization:

```
Corporate (Root)
  ├─ Engineering
  │   ├─ Frontend Team
  │   └─ Backend Team
  ├─ Sales
  └─ Support
```

### Assigning Departments

When creating or editing an employee:

1. Click **"Department"** dropdown
2. Select from list of active departments
3. Only active departments appear in the list

**Department Validation**:
- Department must exist
- Department must be active
- Cannot assign to inactive departments

### Department Assignment History

View all department changes for an employee:

1. Navigate to employee profile
2. Click **"Department History"** tab

**Information Shown**:
- Previous department
- New department
- Date/time of change
- Who made the change
- Reason for change (if provided)

---

## Password Management

### Changing Your Password

**Available to**: All users (for own account)

1. Navigate to **Profile** → **Settings**
2. Click **"Change Password"**
3. Enter:
   - Current password
   - New password
   - Confirm new password
4. Click **"Change Password"**

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- At least one special character (!@#$%^&*...)
- Cannot be one of your last 5 passwords

**Password Validation Examples**:

| Password | Valid? | Reason |
|----------|--------|--------|
| Password123! | ✅ | Meets all requirements |
| password123 | ❌ | Missing uppercase and special char |
| PASSWORD123! | ❌ | Missing lowercase |
| Pass123! | ❌ | Too short (min 8 chars) |
| OldPassword1! | ❌ | Recently used (if in last 5) |

---

### Resetting Employee Passwords

**Required Role**: Admin only

1. Navigate to employee profile
2. Click **"Reset Password"**
3. Click **"Confirm Reset"**
4. Copy the temporary password shown
5. Securely provide password to employee

**Important**:
- Temporary password shown only once
- Employee must change password on next login
- Password change tracked in audit trail

**Example Temporary Password**: `aB3$kL9mP2@qR5tU`

---

### Forgotten Password Flow

1. On login page, click **"Forgot Password?"**
2. Enter your email address
3. Check email for reset link
4. Click link and enter new password
5. Login with new password

---

## Account Status Management

**Required Role**: Admin only

### Account Status Types

#### Active/Inactive
- **Active**: Employee can login and access system
- **Inactive**: Employee cannot login (soft delete)

Use inactive for:
- Temporary leave
- Suspended employees
- Employees pending termination

#### Locked/Unlocked
- **Locked**: Account locked for security (e.g., too many failed logins)
- **Unlocked**: Account accessible

Use locked for:
- Security incidents
- Suspicious activity
- Multiple failed login attempts

#### Verified/Unverified
- **Verified**: Email address confirmed
- **Unverified**: Email not yet confirmed

---

### Changing Account Status

1. Navigate to employee profile
2. Click **"Status"** dropdown
3. Select status action:
   - **Activate**: Enable account
   - **Deactivate**: Disable account
   - **Lock**: Lock account
   - **Unlock**: Unlock account
   - **Verify**: Mark as verified
   - **Unverify**: Mark as unverified
4. Enter reason (required for lock/inactive)
5. Click **"Update Status"**

**Security Note**: Administrators cannot modify their own account status.

---

### Account Status History

View all status changes for an employee:

1. Navigate to employee profile
2. Click **"Status History"** tab

**Information Shown**:
- Previous status
- New status
- Date/time of change
- Who made the change
- Reason for change
- Additional metadata

---

## Extended Employee Fields

### Qualifications

Track employee certifications, skills, and qualifications.

**Adding Qualifications**:
1. Edit employee profile
2. In **"Qualifications"** section, click **"Add"**
3. Enter qualification name
4. Click **"Save"**

**Examples**:
- First Aid Certified
- Food Safety Level 2
- Forklift License
- Management Training
- CPR Certified

**Limits**:
- Maximum 20 qualifications per employee
- Each qualification: 1-100 characters

**Use Cases**:
- Scheduling employees for specialized shifts
- Compliance reporting
- Training tracking

---

### Availability

Set weekly availability schedule for each employee.

**Setting Availability**:
1. Edit employee profile
2. Navigate to **"Availability"** section
3. For each day of week:
   - Check **"Available"** if employee can work
   - Set **Start Time** (e.g., 09:00)
   - Set **End Time** (e.g., 17:00)
4. Click **"Save"**

**Availability Format**:
```json
{
  "monday": {
    "available": true,
    "start": "09:00",
    "end": "17:00"
  },
  "tuesday": {
    "available": true,
    "start": "09:00",
    "end": "17:00"
  },
  "friday": {
    "available": false
  }
}
```

**Use Cases**:
- Automated schedule generation
- Conflict detection
- Workload balancing

---

### Hourly Rate

Set employee hourly pay rate.

**Setting Hourly Rate**:
1. Edit employee profile
2. Enter **"Hourly Rate"** (e.g., 25.50)
3. Click **"Save"**

**Constraints**:
- Range: $0.00 - $1000.00
- Precision: 2 decimal places
- Currency: USD (configurable)

**Use Cases**:
- Labor cost calculation
- Budget forecasting
- Payroll integration

---

### Maximum Hours per Week

Set maximum weekly hours limit for employee.

**Setting Max Hours**:
1. Edit employee profile
2. Enter **"Max Hours per Week"** (e.g., 40)
3. Click **"Save"**

**Constraints**:
- Range: 1 - 168 hours
- Integer value only

**Use Cases**:
- Compliance with labor laws
- Overtime prevention
- Work-life balance enforcement

**Common Values**:
- Full-time: 40 hours
- Part-time: 20-35 hours
- On-call: 10-15 hours

---

## Search and Filtering

### Searching Employees

Use the search bar to find employees:

**Search Fields**:
- First Name
- Last Name
- Email Address

**Search is**:
- Case-insensitive
- Partial match (e.g., "joh" finds "John")
- Searches all three fields simultaneously

**Example Searches**:
- `john` → Finds "John Doe", "Johnny Smith"
- `@example.com` → Finds all emails with @example.com
- `doe` → Finds "John Doe", "Jane Doe"

---

### Filtering Employees

Apply filters to narrow results:

**Available Filters**:

| Filter | Options | Description |
|--------|---------|-------------|
| **Department** | Dropdown list | Show only employees in selected department |
| **Role** | Admin, Manager, User, Guest | Filter by user role |
| **Active Status** | Active, Inactive | Show active or inactive employees |

**Applying Filters**:
1. Click **"Filters"** button
2. Select filter criteria
3. Click **"Apply"**
4. Click **"Clear Filters"** to reset

**Combining Filters**:
Filters work together. For example:
- Department: Engineering
- Role: Manager
- Active: Yes

Shows only active managers in Engineering department.

---

### Sorting Employees

Sort employee list by different columns:

**Sortable Fields**:
- First Name
- Last Name
- Email
- Department
- Role
- Hire Date

**Sorting**:
1. Click column header to sort
2. Click again to reverse order
3. Arrow indicates sort direction (▲ ascending, ▼ descending)

---

### Pagination

Navigate large employee lists:

**Controls**:
- **Items per Page**: 10, 25, 50, 100
- **Page Navigation**: Previous, Next, Page Numbers
- **Total Count**: "Showing 1-50 of 237 employees"

**Performance Tip**: Use filters to reduce result set before pagination.

---

## Audit Trails

All major actions are logged for compliance and auditing.

### Department Assignment History

View all department changes:

1. Navigate to employee profile
2. Click **"Department History"** tab

**Information Logged**:
- Employee name
- Previous department
- New department
- Changed by (admin/manager)
- Date and time
- Reason for change
- Additional metadata

**Use Cases**:
- Compliance audits
- Organizational change tracking
- Dispute resolution

---

### Role Change History

View all role changes:

1. Navigate to employee profile
2. Click **"Role History"** tab

**Information Logged**:
- Employee name
- Old role
- New role
- Changed by (admin)
- Date and time
- Reason for change

**Use Cases**:
- Security audits
- Permission tracking
- Promotion history

---

### Account Status History

View all status changes:

1. Navigate to employee profile
2. Click **"Status History"** tab

**Information Logged**:
- Employee name
- Old status
- New status
- Changed by (admin)
- Date and time
- Reason for change
- IP address (if applicable)

**Use Cases**:
- Security incidents
- Account lockout tracking
- Compliance reporting

---

### Password Change History

**Note**: Password hashes are stored, not actual passwords.

**Information Logged**:
- User ID
- Password hash (bcrypt)
- Changed at timestamp
- Change method (reset, self-change, admin-change)
- Changed by user ID
- IP address

**Privacy**:
- Actual passwords never stored or visible
- Only administrators can see password change events
- Users can see their own password change dates

---

## Troubleshooting

### Cannot Login

**Possible Causes**:

1. **Invalid Credentials**
   - Double-check email and password
   - Passwords are case-sensitive
   - Try "Forgot Password" if unsure

2. **Account Locked**
   - Contact administrator to unlock
   - May be locked after failed login attempts

3. **Account Inactive**
   - Contact administrator to reactivate
   - May be temporarily disabled

4. **Token Expired**
   - Refresh the page and login again
   - Access tokens expire after 15 minutes

---

### Cannot See Other Employees

**Possible Causes**:

1. **Insufficient Permissions**
   - Regular users can only see own profile
   - Contact administrator for role upgrade

2. **Department Filter Active**
   - Check if filters are applied
   - Click "Clear Filters" to reset

---

### Cannot Edit Employee

**Possible Causes**:

1. **Insufficient Permissions**
   - Only Admin/Manager can edit others
   - Users can only edit own profile

2. **Cannot Edit Own Role**
   - Only administrators can change roles
   - Request administrator assistance

3. **Account Locked/Inactive**
   - Inactive accounts may have editing restrictions

---

### Password Not Accepted

**Possible Causes**:

1. **Does Not Meet Requirements**
   - Check password requirements above
   - Must have uppercase, lowercase, digit, special char
   - Minimum 8 characters

2. **Recently Used**
   - Cannot reuse last 5 passwords
   - Try a completely different password

3. **Too Short**
   - Minimum 8 characters required

---

### Department Not Available

**Possible Causes**:

1. **Department Inactive**
   - Only active departments appear in dropdown
   - Contact administrator to activate department

2. **No Departments Created**
   - System requires at least one active department
   - Contact administrator to create departments

---

### Changes Not Saved

**Possible Causes**:

1. **Validation Errors**
   - Check for error messages on form
   - Fix validation errors and retry

2. **Network Issues**
   - Check internet connection
   - Retry after connection restored

3. **Session Expired**
   - Refresh page and login again
   - Access token expires after 15 minutes

4. **Concurrent Update**
   - Another user modified record simultaneously
   - Refresh and reapply changes

---

### Audit Trail Empty

**Possible Causes**:

1. **No Changes Made**
   - Audit trail only shows actual changes
   - No history until first change

2. **Insufficient Permissions**
   - Regular users see only own history
   - Managers see department history
   - Admins see all history

---

## Getting Help

### Contact Support

- **Email**: support@aischedulemanager.com
- **Phone**: (555) 123-4567
- **Hours**: Monday-Friday, 9am-5pm EST

### Additional Resources

- **API Documentation**: http://localhost:8000/docs
- **Developer Guide**: `/docs/DEVELOPER_GUIDE.md`
- **Migration Guide**: `/docs/MIGRATION_GUIDE.md`
- **GitHub Issues**: https://github.com/yourusername/AI-Schedule-Manager/issues

---

*Last Updated: 2025-01-15*
