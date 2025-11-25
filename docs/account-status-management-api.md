# Account Status Management API

## Overview

The Account Status Management API provides administrators with comprehensive control over user account states including activation status, security locks, and verification flags. All status changes are tracked in a detailed audit trail.

## Features

- ✅ Account activation/deactivation
- ✅ Security lock/unlock functionality
- ✅ Email verification status management
- ✅ Comprehensive audit trail
- ✅ Self-modification protection
- ✅ Role-based access control
- ✅ Reason validation for sensitive operations

## API Endpoints

### Update Account Status

**PATCH** `/api/employees/{employee_id}/status`

Update an employee's account status flags.

#### Authorization
- **Required role**: `admin` only
- **Restrictions**: Cannot modify own account status

#### Request Body

```json
{
  "status": "active|inactive|locked|unlocked|verified|unverified",
  "reason": "Optional explanation (required for lock/inactive)"
}
```

#### Status Actions

| Action | Effect | Reason Required |
|--------|--------|-----------------|
| `active` | Enable account login | No |
| `inactive` | Disable account login | **Yes** |
| `locked` | Lock account for security | **Yes** |
| `unlocked` | Unlock account, reset failed attempts | No |
| `verified` | Mark email as verified | No |
| `unverified` | Mark email as unverified | No |

#### Example Request

```bash
curl -X PATCH http://localhost:8000/api/employees/123/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "locked",
    "reason": "Multiple failed login attempts detected"
  }'
```

#### Response

```json
{
  "id": 123,
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "is_active": true,
  "is_locked": true,
  "is_verified": true,
  "department_id": 5,
  "roles": ["user"]
}
```

#### Error Codes

- `403 Forbidden`: Attempting to modify own account or insufficient permissions
- `404 Not Found`: Employee not found
- `422 Unprocessable Entity`: Invalid status or missing required reason
- `400 Bad Request`: Invalid status action

---

### Get Status History

**GET** `/api/employees/{employee_id}/status-history`

Retrieve paginated audit trail of account status changes.

#### Authorization

- **Admins**: Can view any employee's history
- **Managers**: Can view their department employees' history
- **Users**: Can only view their own history

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | integer | 0 | Number of records to skip (pagination) |
| `limit` | integer | 50 | Maximum records to return (max 500) |

#### Example Request

```bash
curl -X GET "http://localhost:8000/api/employees/123/status-history?skip=0&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Response

```json
{
  "total": 15,
  "items": [
    {
      "id": 45,
      "user_id": 123,
      "old_status": "unlocked",
      "new_status": "locked",
      "changed_by_id": 1,
      "changed_at": "2024-11-25T04:30:00Z",
      "reason": "Multiple failed login attempts detected",
      "metadata_json": {
        "action": "status_change",
        "status_type": "locked",
        "api_endpoint": "/api/employees/123/status",
        "changed_by_email": "admin@example.com"
      },
      "user_name": "John Doe",
      "changed_by_name": "Admin User"
    },
    {
      "id": 44,
      "user_id": 123,
      "old_status": "inactive",
      "new_status": "active",
      "changed_by_id": 1,
      "changed_at": "2024-11-24T10:15:00Z",
      "reason": "Account approved after verification",
      "metadata_json": {
        "action": "status_change",
        "status_type": "active",
        "api_endpoint": "/api/employees/123/status",
        "changed_by_email": "admin@example.com"
      },
      "user_name": "John Doe",
      "changed_by_name": "Admin User"
    }
  ],
  "skip": 0,
  "limit": 10
}
```

## Database Schema

### account_status_history Table

```sql
CREATE TABLE account_status_history (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    metadata_json JSON
);

-- Indexes for performance
CREATE INDEX ix_account_status_history_user_id ON account_status_history(user_id);
CREATE INDEX ix_account_status_history_changed_by_id ON account_status_history(changed_by_id);
CREATE INDEX ix_account_status_history_changed_at ON account_status_history(changed_at);
```

## Security Considerations

### Self-Modification Protection

Administrators cannot modify their own account status to prevent:
- Accidental self-lockout
- Privilege escalation attacks
- Audit trail manipulation

```python
if employee_id == current_user.id:
    raise HTTPException(
        status_code=403,
        detail="Cannot modify your own account status"
    )
```

### Reason Validation

Sensitive operations (lock/deactivate) require mandatory explanation:

```python
@field_validator('reason')
def validate_reason_for_restrictive_actions(cls, v, info):
    if info.data.get('status') in ['locked', 'inactive'] and not v:
        raise ValueError('Reason required for lock/deactivate')
    return v
```

### Audit Trail

All status changes are logged with:
- Old and new status values
- Administrator who made the change
- Timestamp of the change
- Reason for the change
- Additional metadata (endpoint, email, etc.)

## Common Use Cases

### 1. Lock Compromised Account

```bash
curl -X PATCH http://localhost:8000/api/employees/123/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "locked",
    "reason": "Suspicious activity detected from unknown IP"
  }'
```

### 2. Deactivate Resigned Employee

```bash
curl -X PATCH http://localhost:8000/api/employees/456/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive",
    "reason": "Employee resignation effective 2024-11-25"
  }'
```

### 3. Unlock After Identity Verification

```bash
curl -X PATCH http://localhost:8000/api/employees/789/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "unlocked",
    "reason": "Identity verified via security questions"
  }'
```

### 4. Mark Email as Verified

```bash
curl -X PATCH http://localhost:8000/api/employees/101/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "verified",
    "reason": "Email verification link clicked"
  }'
```

### 5. Review Account History

```bash
# View all status changes for an employee
curl -X GET "http://localhost:8000/api/employees/123/status-history?limit=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Integration Guide

### Frontend Integration

1. **Display Status Badges**

```jsx
function StatusBadge({ employee }) {
  const getStatusColor = () => {
    if (!employee.is_active) return 'red';
    if (employee.is_locked) return 'orange';
    if (!employee.is_verified) return 'yellow';
    return 'green';
  };

  return (
    <div>
      <Badge color={getStatusColor()}>
        {!employee.is_active && 'Inactive'}
        {employee.is_locked && 'Locked'}
        {!employee.is_verified && 'Unverified'}
        {employee.is_active && !employee.is_locked && employee.is_verified && 'Active'}
      </Badge>
    </div>
  );
}
```

2. **Status Change Dialog**

```jsx
function StatusChangeDialog({ employee, onUpdate }) {
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');

  const requiresReason = ['locked', 'inactive'].includes(status);

  const handleSubmit = async () => {
    await api.patch(`/api/employees/${employee.id}/status`, {
      status,
      reason: reason || undefined
    });
    onUpdate();
  };

  return (
    <Dialog>
      <Select value={status} onChange={setStatus}>
        <Option value="active">Activate Account</Option>
        <Option value="inactive">Deactivate Account</Option>
        <Option value="locked">Lock Account</Option>
        <Option value="unlocked">Unlock Account</Option>
        <Option value="verified">Mark as Verified</Option>
        <Option value="unverified">Mark as Unverified</Option>
      </Select>

      <TextArea
        placeholder="Reason (required for lock/deactivate)"
        value={reason}
        onChange={setReason}
        required={requiresReason}
      />

      <Button onClick={handleSubmit}>Update Status</Button>
    </Dialog>
  );
}
```

3. **Status History Timeline**

```jsx
function StatusHistoryTimeline({ employeeId }) {
  const { data } = useQuery(['status-history', employeeId], () =>
    api.get(`/api/employees/${employeeId}/status-history?limit=20`)
  );

  return (
    <Timeline>
      {data?.items.map(item => (
        <TimelineItem key={item.id}>
          <TimelineDate>{formatDate(item.changed_at)}</TimelineDate>
          <TimelineContent>
            <strong>{item.old_status}</strong> → <strong>{item.new_status}</strong>
            <p>{item.reason}</p>
            <small>By {item.changed_by_name}</small>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}
```

## Testing

Comprehensive test suite included in `backend/tests/test_account_status.py`:

```bash
# Run account status tests
pytest backend/tests/test_account_status.py -v

# Test coverage includes:
# - All status transitions (active/inactive, lock/unlock, verify/unverify)
# - Reason validation for sensitive operations
# - Self-modification protection
# - RBAC permissions
# - Audit trail creation
# - History pagination
# - Metadata tracking
```

## Migration

Apply the database migration:

```bash
cd backend
alembic upgrade head
```

This creates the `account_status_history` table with appropriate indexes and foreign keys.

## Monitoring and Analytics

### Query Recent Status Changes

```sql
-- Find all locked accounts in last 24 hours
SELECT u.email, ash.changed_at, ash.reason
FROM account_status_history ash
JOIN users u ON ash.user_id = u.id
WHERE ash.new_status = 'locked'
  AND ash.changed_at > NOW() - INTERVAL '24 hours'
ORDER BY ash.changed_at DESC;
```

### Identify Frequently Modified Accounts

```sql
-- Accounts with most status changes (potential security issue)
SELECT
    u.email,
    COUNT(*) as change_count,
    MAX(ash.changed_at) as last_change
FROM account_status_history ash
JOIN users u ON ash.user_id = u.id
GROUP BY u.email
HAVING COUNT(*) > 5
ORDER BY change_count DESC;
```

## Future Enhancements

- [ ] Automatic status change notifications via email
- [ ] Scheduled status changes (e.g., auto-deactivate after date)
- [ ] Bulk status operations
- [ ] Status change approval workflow
- [ ] Integration with security monitoring systems
- [ ] Custom status types beyond active/locked/verified

## Support

For issues or questions:
- Backend API: `/backend/src/api/employees.py`
- Models: `/backend/src/models/account_status_history.py`
- Tests: `/backend/tests/test_account_status.py`
- Migration: `/backend/migrations/versions/009_create_account_status_history.py`
