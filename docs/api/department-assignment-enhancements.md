# Department Assignment Enhancements - API Documentation

**Version:** 1.0.0
**Last Updated:** 2025-11-20
**Status:** Production Ready

---

## Table of Contents

1. [API Endpoint Reference](#api-endpoint-reference)
2. [Request/Response Schemas](#requestresponse-schemas)
3. [Usage Examples](#usage-examples)
4. [Error Handling](#error-handling)
5. [Integration Guide](#integration-guide)
6. [Performance Considerations](#performance-considerations)
7. [OpenAPI Schema](#openapi-schema)

---

## API Endpoint Reference

### Employee Management Endpoints

#### 1. List Employees

**Endpoint:** `GET /api/employees`

**Description:** Retrieve a paginated list of employees with optional filtering by department.

**Authentication:** Required (JWT Token)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `role` | string | No | - | Filter by employee role |
| `is_active` | boolean | No | - | Filter by active status |
| `department_id` | integer | No | - | Filter by department ID |
| `skip` | integer | No | 0 | Number of records to skip (pagination) |
| `limit` | integer | No | 100 | Maximum records to return (1-1000) |

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "isActive": true,
    "departmentId": 2,
    "department": {
      "id": 2,
      "name": "Engineering",
      "description": "Engineering Department",
      "active": true,
      "parentId": null,
      "settings": {},
      "createdAt": "2025-11-20T10:00:00Z",
      "updatedAt": "2025-11-20T10:00:00Z"
    },
    "createdAt": "2025-11-20T12:00:00Z",
    "updatedAt": "2025-11-20T12:00:00Z"
  }
]
```

**HTTP Status Codes:**

- `200` - Success
- `401` - Unauthorized (missing or invalid JWT)
- `500` - Internal server error

---

#### 2. Get Single Employee

**Endpoint:** `GET /api/employees/{employee_id}`

**Description:** Retrieve a specific employee by ID with department details.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employee_id` | integer | Yes | Employee ID |

**Response:** `200 OK`

```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "isActive": true,
  "departmentId": 2,
  "department": {
    "id": 2,
    "name": "Engineering",
    "description": "Engineering Department",
    "active": true,
    "parentId": null,
    "settings": {},
    "createdAt": "2025-11-20T10:00:00Z",
    "updatedAt": "2025-11-20T10:00:00Z"
  },
  "createdAt": "2025-11-20T12:00:00Z",
  "updatedAt": "2025-11-20T12:00:00Z"
}
```

**HTTP Status Codes:**

- `200` - Success
- `404` - Employee not found
- `401` - Unauthorized
- `500` - Internal server error

---

#### 3. Create Employee

**Endpoint:** `POST /api/employees`

**Description:** Create a new employee with optional department assignment.

**Authentication:** Required

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "departmentId": 2
}
```

**Field Descriptions:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `firstName` | string | Yes | 1-50 chars | Employee first name |
| `lastName` | string | Yes | 1-50 chars | Employee last name |
| `email` | string | No | Valid email, unique | Email address (auto-generated if omitted) |
| `departmentId` | integer | No | Must exist & be active | Department ID (null for unassigned) |

**Response:** `201 Created`

```json
{
  "id": 3,
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "isActive": true,
  "departmentId": 2,
  "department": {
    "id": 2,
    "name": "Engineering",
    "description": "Engineering Department",
    "active": true,
    "parentId": null,
    "settings": {},
    "createdAt": "2025-11-20T10:00:00Z",
    "updatedAt": "2025-11-20T10:00:00Z"
  },
  "createdAt": "2025-11-20T15:00:00Z",
  "updatedAt": "2025-11-20T15:00:00Z"
}
```

**HTTP Status Codes:**

- `201` - Employee created successfully
- `400` - Invalid request (inactive department)
- `404` - Department not found
- `409` - Email already exists
- `401` - Unauthorized
- `500` - Internal server error

---

#### 4. Update Employee

**Endpoint:** `PATCH /api/employees/{employee_id}` or `PUT /api/employees/{employee_id}`

**Description:** Update an existing employee. Both PATCH (partial) and PUT (full) methods are supported.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employee_id` | integer | Yes | Employee ID to update |

**Request Body (Partial Update):**

```json
{
  "departmentId": 3,
  "isActive": true
}
```

**Field Descriptions:**

All fields are optional for PATCH requests:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `firstName` | string | 1-50 chars | Employee first name |
| `lastName` | string | 1-50 chars | Employee last name |
| `email` | string | Valid email, unique | Email address |
| `departmentId` | integer/null | Must exist & be active | Department ID (null to unassign) |
| `isActive` | boolean | - | Active status |

**Response:** `200 OK`

```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "isActive": true,
  "departmentId": 3,
  "department": {
    "id": 3,
    "name": "Sales",
    "description": "Sales Department",
    "active": true,
    "parentId": null,
    "settings": {},
    "createdAt": "2025-11-20T10:00:00Z",
    "updatedAt": "2025-11-20T10:00:00Z"
  },
  "createdAt": "2025-11-20T12:00:00Z",
  "updatedAt": "2025-11-20T16:00:00Z"
}
```

**HTTP Status Codes:**

- `200` - Employee updated successfully
- `400` - Invalid request (inactive department)
- `404` - Employee or department not found
- `409` - Email already exists
- `401` - Unauthorized
- `500` - Internal server error

---

#### 5. Delete Employee

**Endpoint:** `DELETE /api/employees/{employee_id}`

**Description:** Delete an employee from the system.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employee_id` | integer | Yes | Employee ID to delete |

**Response:** `204 No Content`

**HTTP Status Codes:**

- `204` - Employee deleted successfully
- `404` - Employee not found
- `401` - Unauthorized
- `500` - Internal server error

---

### Department Management Endpoints

#### 6. List Departments

**Endpoint:** `GET /api/departments`

**Description:** Retrieve a paginated list of departments with hierarchy support.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `active` | boolean | No | - | Filter by active status |
| `parent_id` | integer | No | - | Filter by parent department (null for root) |
| `search` | string | No | - | Search by department name |
| `page` | integer | No | 1 | Page number (starts at 1) |
| `size` | integer | No | 10 | Items per page (1-100) |
| `sort_by` | string | No | name | Field to sort by |
| `sort_order` | string | No | asc | Sort direction (asc/desc) |

**Response:** `200 OK`

```json
{
  "items": [
    {
      "id": 1,
      "name": "Engineering",
      "description": "Engineering Department",
      "parentId": null,
      "settings": {},
      "active": true,
      "createdAt": "2025-11-20T10:00:00Z",
      "updatedAt": "2025-11-20T10:00:00Z",
      "children": [
        {
          "id": 2,
          "name": "Backend Team",
          "description": "Backend Development Team",
          "parentId": 1,
          "settings": {},
          "active": true,
          "createdAt": "2025-11-20T10:30:00Z",
          "updatedAt": "2025-11-20T10:30:00Z",
          "children": []
        }
      ]
    }
  ],
  "total": 5,
  "page": 1,
  "size": 10,
  "pages": 1
}
```

---

## Request/Response Schemas

### EmployeeCreate Schema

```typescript
interface EmployeeCreate {
  firstName: string;        // Required, 1-50 characters
  lastName: string;         // Required, 1-50 characters
  email?: string;           // Optional, valid email format, unique
  departmentId?: number;    // Optional, must exist and be active
}
```

**Validation Rules:**
- `firstName` and `lastName` are required
- `email` is optional but must be unique if provided
- If `email` is omitted, system auto-generates unique email
- `departmentId` is optional but must reference active department if provided

---

### EmployeeUpdate Schema

```typescript
interface EmployeeUpdate {
  firstName?: string;       // Optional, 1-50 characters
  lastName?: string;        // Optional, 1-50 characters
  email?: string;           // Optional, valid email format, unique
  departmentId?: number | null;  // Optional, must exist and be active, null to unassign
  isActive?: boolean;       // Optional, active status
}
```

**Validation Rules:**
- All fields are optional
- `email` must be unique if changed
- `departmentId` must reference active department if provided
- `departmentId` can be set to `null` to unassign employee

---

### EmployeeResponse Schema

```typescript
interface EmployeeResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  departmentId: number | null;
  department: DepartmentResponse | null;
  createdAt: string;        // ISO 8601 datetime
  updatedAt: string;        // ISO 8601 datetime
}
```

---

### DepartmentResponse Schema

```typescript
interface DepartmentResponse {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  settings: Record<string, any>;
  active: boolean;
  createdAt: string;        // ISO 8601 datetime
  updatedAt: string;        // ISO 8601 datetime
  children: DepartmentResponse[];
}
```

---

## Usage Examples

### Example 1: Create Employee with Department

**Request:**

```bash
curl -X POST https://api.example.com/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Alice",
    "lastName": "Johnson",
    "email": "alice.johnson@example.com",
    "departmentId": 2
  }'
```

**Response (201 Created):**

```json
{
  "id": 5,
  "firstName": "Alice",
  "lastName": "Johnson",
  "email": "alice.johnson@example.com",
  "isActive": true,
  "departmentId": 2,
  "department": {
    "id": 2,
    "name": "Engineering",
    "description": "Engineering Department",
    "active": true,
    "parentId": null,
    "settings": {},
    "createdAt": "2025-11-20T10:00:00Z",
    "updatedAt": "2025-11-20T10:00:00Z"
  },
  "createdAt": "2025-11-20T15:30:00Z",
  "updatedAt": "2025-11-20T15:30:00Z"
}
```

---

### Example 2: Create Employee Without Email (Auto-generation)

**Request:**

```bash
curl -X POST https://api.example.com/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Bob",
    "lastName": "Wilson"
  }'
```

**Response (201 Created):**

```json
{
  "id": 6,
  "firstName": "Bob",
  "lastName": "Wilson",
  "email": "bob.wilson.a3f5e8c2@temp.example.com",
  "isActive": true,
  "departmentId": null,
  "department": null,
  "createdAt": "2025-11-20T15:35:00Z",
  "updatedAt": "2025-11-20T15:35:00Z"
}
```

---

### Example 3: Update Employee Department

**Request:**

```bash
curl -X PATCH https://api.example.com/api/employees/5 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "departmentId": 3
  }'
```

**Response (200 OK):**

```json
{
  "id": 5,
  "firstName": "Alice",
  "lastName": "Johnson",
  "email": "alice.johnson@example.com",
  "isActive": true,
  "departmentId": 3,
  "department": {
    "id": 3,
    "name": "Sales",
    "description": "Sales Department",
    "active": true,
    "parentId": null,
    "settings": {},
    "createdAt": "2025-11-20T10:00:00Z",
    "updatedAt": "2025-11-20T10:00:00Z"
  },
  "createdAt": "2025-11-20T15:30:00Z",
  "updatedAt": "2025-11-20T16:00:00Z"
}
```

---

### Example 4: Unassign Employee from Department

**Request:**

```bash
curl -X PATCH https://api.example.com/api/employees/5 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "departmentId": null
  }'
```

**Response (200 OK):**

```json
{
  "id": 5,
  "firstName": "Alice",
  "lastName": "Johnson",
  "email": "alice.johnson@example.com",
  "isActive": true,
  "departmentId": null,
  "department": null,
  "createdAt": "2025-11-20T15:30:00Z",
  "updatedAt": "2025-11-20T16:15:00Z"
}
```

---

### Example 5: List Employees by Department

**Request:**

```bash
curl -X GET "https://api.example.com/api/employees?department_id=2&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**

```json
[
  {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "isActive": true,
    "departmentId": 2,
    "department": {
      "id": 2,
      "name": "Engineering",
      "description": "Engineering Department",
      "active": true,
      "parentId": null,
      "settings": {},
      "createdAt": "2025-11-20T10:00:00Z",
      "updatedAt": "2025-11-20T10:00:00Z"
    },
    "createdAt": "2025-11-20T12:00:00Z",
    "updatedAt": "2025-11-20T12:00:00Z"
  },
  {
    "id": 5,
    "firstName": "Alice",
    "lastName": "Johnson",
    "email": "alice.johnson@example.com",
    "isActive": true,
    "departmentId": 2,
    "department": {
      "id": 2,
      "name": "Engineering",
      "description": "Engineering Department",
      "active": true,
      "parentId": null,
      "settings": {},
      "createdAt": "2025-11-20T10:00:00Z",
      "updatedAt": "2025-11-20T10:00:00Z"
    },
    "createdAt": "2025-11-20T15:30:00Z",
    "updatedAt": "2025-11-20T15:30:00Z"
  }
]
```

---

## Error Handling

### Error Response Format

All error responses follow a consistent structure:

```json
{
  "detail": "Clear description of the error with actionable guidance"
}
```

### Common Error Scenarios

#### 1. Department Not Found (404)

**Request:**

```bash
curl -X POST https://api.example.com/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "departmentId": 999
  }'
```

**Response (404 Not Found):**

```json
{
  "detail": "Department with ID 999 not found. Please select a valid department or leave unassigned."
}
```

---

#### 2. Inactive Department (400)

**Request:**

```bash
curl -X POST https://api.example.com/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "departmentId": 5
  }'
```

**Response (400 Bad Request):**

```json
{
  "detail": "Cannot assign employee to inactive department 'Marketing'. Please select an active department."
}
```

---

#### 3. Duplicate Email (409)

**Request:**

```bash
curl -X POST https://api.example.com/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "existing@example.com"
  }'
```

**Response (409 Conflict):**

```json
{
  "detail": "Employee with email existing@example.com already exists. Suggestions: Use a different email or leave it empty to auto-generate."
}
```

---

#### 4. Employee Not Found (404)

**Request:**

```bash
curl -X GET https://api.example.com/api/employees/999 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (404 Not Found):**

```json
{
  "detail": "Employee with ID 999 not found"
}
```

---

#### 5. Unauthorized Access (401)

**Request:**

```bash
curl -X GET https://api.example.com/api/employees
```

**Response (401 Unauthorized):**

```json
{
  "detail": "Not authenticated"
}
```

---

### HTTP Status Code Reference

| Status Code | Meaning | When Used |
|-------------|---------|-----------|
| `200` | OK | Successful GET, PATCH, PUT requests |
| `201` | Created | Successful POST (employee created) |
| `204` | No Content | Successful DELETE (no response body) |
| `400` | Bad Request | Invalid data (e.g., inactive department) |
| `401` | Unauthorized | Missing or invalid authentication |
| `404` | Not Found | Resource doesn't exist (employee/department) |
| `409` | Conflict | Duplicate constraint violation (email) |
| `500` | Internal Server Error | Unexpected server error |

---

## Integration Guide

### Frontend Integration (TypeScript/React)

#### 1. TypeScript Interfaces

```typescript
// API Response Types
interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  departmentId: number | null;
  department: Department | null;
  createdAt: string;
  updatedAt: string;
}

interface Department {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  settings: Record<string, any>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  children: Department[];
}

// API Request Types
interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  email?: string;
  departmentId?: number;
}

interface UpdateEmployeeRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentId?: number | null;
  isActive?: boolean;
}
```

---

#### 2. API Service Implementation

```typescript
// services/employeeService.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class EmployeeService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async listEmployees(filters?: {
    departmentId?: number;
    isActive?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<Employee[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.departmentId) params.append('department_id', filters.departmentId.toString());
      if (filters?.isActive !== undefined) params.append('is_active', filters.isActive.toString());
      if (filters?.skip) params.append('skip', filters.skip.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await axios.get(`${API_BASE_URL}/api/employees?${params}`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async getEmployee(id: number): Promise<Employee> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/employees/${id}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async createEmployee(data: CreateEmployeeRequest): Promise<Employee> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/employees`, data, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async updateEmployee(id: number, data: UpdateEmployeeRequest): Promise<Employee> {
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/employees/${id}`, data, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async deleteEmployee(id: number): Promise<void> {
    try {
      await axios.delete(`${API_BASE_URL}/api/employees/${id}`, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: any) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || 'Unknown error';

        // Log error for debugging
        console.error(`API Error ${status}:`, detail);

        // Handle specific error cases
        switch (status) {
          case 404:
            throw new Error(detail);
          case 409:
            throw new Error(detail);
          case 400:
            throw new Error(detail);
          case 401:
            // Redirect to login
            window.location.href = '/login';
            throw new Error('Session expired. Please login again.');
          default:
            throw new Error(detail);
        }
      }
    }
    throw new Error('Network error. Please check your connection.');
  }
}

export const employeeService = new EmployeeService();
```

---

#### 3. React Hook Integration

```typescript
// hooks/useEmployees.ts
import { useState, useEffect, useCallback } from 'react';
import { employeeService } from '../services/employeeService';

export function useEmployees(departmentId?: number) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeService.listEmployees({
        departmentId,
        limit: 1000
      });
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = async (data: CreateEmployeeRequest) => {
    try {
      setLoading(true);
      const newEmployee = await employeeService.createEmployee(data);
      setEmployees(prev => [...prev, newEmployee]);
      return newEmployee;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create employee';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateEmployee = async (id: number, data: UpdateEmployeeRequest) => {
    try {
      setLoading(true);
      const updated = await employeeService.updateEmployee(id, data);
      setEmployees(prev => prev.map(emp => emp.id === id ? updated : emp));
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update employee';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async (id: number) => {
    try {
      setLoading(true);
      await employeeService.deleteEmployee(id);
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete employee';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    employees,
    loading,
    error,
    fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee
  };
}
```

---

### Error Handling Patterns

#### 1. Client-Side Validation

```typescript
function validateEmployeeData(data: CreateEmployeeRequest): string[] {
  const errors: string[] = [];

  // Validate first name
  if (!data.firstName || data.firstName.trim().length === 0) {
    errors.push('First name is required');
  } else if (data.firstName.length > 50) {
    errors.push('First name must be less than 50 characters');
  }

  // Validate last name
  if (!data.lastName || data.lastName.trim().length === 0) {
    errors.push('Last name is required');
  } else if (data.lastName.length > 50) {
    errors.push('Last name must be less than 50 characters');
  }

  // Validate email format if provided
  if (data.email && data.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }

  return errors;
}
```

---

#### 2. User-Friendly Error Display

```typescript
// components/EmployeeForm.tsx
function EmployeeForm() {
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setFormErrors([]);
    setApiError(null);

    // Client-side validation
    const validationErrors = validateEmployeeData(formData);
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    // API call
    try {
      await createEmployee(formData);
      // Show success message and close form
    } catch (error) {
      if (error instanceof Error) {
        setApiError(error.message);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Display validation errors */}
      {formErrors.length > 0 && (
        <Alert severity="error">
          <AlertTitle>Validation Errors</AlertTitle>
          <ul>
            {formErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Display API errors */}
      {apiError && (
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {apiError}
        </Alert>
      )}

      {/* Form fields */}
    </form>
  );
}
```

---

## Performance Considerations

### 1. Rate Limiting

**Current Configuration:**
- Rate limiting is **disabled** for LAN-only deployments
- For production deployments, implement rate limiting at API gateway level

**Recommended Limits:**
- Employee list endpoint: 100 requests/minute per IP
- Create/Update endpoints: 20 requests/minute per IP
- Authentication endpoints: 5 requests/minute per IP

---

### 2. Bulk Operation Size Limits

**Current Limits:**

| Operation | Default Limit | Max Limit | Recommendation |
|-----------|---------------|-----------|----------------|
| List Employees | 100 | 1000 | Use pagination for large datasets |
| Department Filter | N/A | N/A | Filter on server-side, not client-side |

**Best Practices:**
- Use pagination (`skip` and `limit` parameters) for large datasets
- Request only necessary fields (consider adding field selection in future)
- Cache department data on client-side (departments change infrequently)

---

### 3. Caching Strategies

#### Client-Side Caching

```typescript
// Simple in-memory cache for departments
class DepartmentCache {
  private cache: Map<number, Department> = new Map();
  private cacheTime: number = 5 * 60 * 1000; // 5 minutes
  private lastFetch: number = 0;

  async getDepartments(): Promise<Department[]> {
    const now = Date.now();

    // Use cache if fresh
    if (this.cache.size > 0 && (now - this.lastFetch) < this.cacheTime) {
      return Array.from(this.cache.values());
    }

    // Fetch fresh data
    const departments = await departmentService.list();
    this.cache.clear();
    departments.forEach(dept => this.cache.set(dept.id, dept));
    this.lastFetch = now;

    return departments;
  }

  invalidate() {
    this.cache.clear();
    this.lastFetch = 0;
  }
}

export const departmentCache = new DepartmentCache();
```

---

#### Server-Side Caching (Future Enhancement)

```python
# Recommended: Add Redis caching for department data
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache

@router.get("/api/departments")
@cache(expire=300)  # Cache for 5 minutes
async def get_departments(...):
    # Department data changes infrequently
    pass
```

---

### 4. Query Optimization Tips

#### Database Indexing

Current indexes in place:
- `users.email` (unique index for fast email lookups)
- `users.department_id` (index for department filtering)
- `users.is_active` (index for active status filtering)
- `departments.name` (unique index)
- `departments.active` (index for active departments)

#### N+1 Query Prevention

The API currently prevents N+1 queries by:
- Manual department loading in single queries
- Avoiding lazy loading in list endpoints

**Future Improvement:** Implement `selectinload` for better performance:

```python
# Future optimization
from sqlalchemy.orm import selectinload

query = select(User).options(selectinload(User.department))
```

---

### 5. Monitoring Recommendations

**Key Metrics to Track:**

1. **Response Times**
   - GET /api/employees: Target < 200ms
   - POST /api/employees: Target < 300ms
   - GET /api/employees/{id}: Target < 100ms

2. **Error Rates**
   - 4xx errors (client errors): Monitor for validation issues
   - 5xx errors (server errors): Alert if > 0.1%

3. **Request Volume**
   - Peak times and usage patterns
   - Department filtering usage

**Logging Best Practices:**

```python
# Add structured logging
import structlog

logger = structlog.get_logger()

@router.post("/api/employees")
async def create_employee(...):
    logger.info(
        "employee.create.start",
        department_id=employee_data.department_id,
        has_email=bool(employee_data.email)
    )

    # ... create employee ...

    logger.info(
        "employee.create.success",
        employee_id=new_user.id,
        department_id=new_user.department_id,
        duration_ms=processing_time
    )
```

---

## OpenAPI Schema

### Complete OpenAPI 3.0 Specification

```yaml
openapi: 3.0.0
info:
  title: AI Schedule Manager - Employee & Department API
  version: 1.0.0
  description: |
    Enhanced employee management API with department assignment capabilities.

    **Features:**
    - Complete CRUD operations for employees
    - Department assignment with validation
    - Hierarchical department support
    - Comprehensive error handling
    - JWT authentication

  contact:
    name: API Support
    email: support@example.com

servers:
  - url: http://localhost:8000
    description: Local development
  - url: https://api.example.com
    description: Production

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from /api/auth/login

  schemas:
    Employee:
      type: object
      required:
        - id
        - firstName
        - lastName
        - email
        - isActive
        - createdAt
        - updatedAt
      properties:
        id:
          type: integer
          example: 1
          description: Unique employee identifier
        firstName:
          type: string
          minLength: 1
          maxLength: 50
          example: John
          description: Employee first name
        lastName:
          type: string
          minLength: 1
          maxLength: 50
          example: Doe
          description: Employee last name
        email:
          type: string
          format: email
          example: john.doe@example.com
          description: Employee email address (unique)
        isActive:
          type: boolean
          example: true
          description: Employee active status
        departmentId:
          type: integer
          nullable: true
          example: 2
          description: Assigned department ID (null if unassigned)
        department:
          $ref: '#/components/schemas/Department'
          nullable: true
          description: Full department object (included in responses)
        createdAt:
          type: string
          format: date-time
          example: "2025-11-20T12:00:00Z"
          description: Employee creation timestamp
        updatedAt:
          type: string
          format: date-time
          example: "2025-11-20T12:00:00Z"
          description: Last update timestamp

    Department:
      type: object
      required:
        - id
        - name
        - active
        - createdAt
        - updatedAt
      properties:
        id:
          type: integer
          example: 2
          description: Unique department identifier
        name:
          type: string
          minLength: 1
          maxLength: 100
          example: Engineering
          description: Department name (unique)
        description:
          type: string
          nullable: true
          example: Engineering Department
          description: Department description
        parentId:
          type: integer
          nullable: true
          example: null
          description: Parent department ID for hierarchy
        settings:
          type: object
          additionalProperties: true
          example: {}
          description: JSON settings object
        active:
          type: boolean
          example: true
          description: Department active status
        createdAt:
          type: string
          format: date-time
          example: "2025-11-20T10:00:00Z"
        updatedAt:
          type: string
          format: date-time
          example: "2025-11-20T10:00:00Z"
        children:
          type: array
          items:
            $ref: '#/components/schemas/Department'
          description: Child departments (hierarchical)

    EmployeeCreate:
      type: object
      required:
        - firstName
        - lastName
      properties:
        firstName:
          type: string
          minLength: 1
          maxLength: 50
          example: Jane
          description: Employee first name
        lastName:
          type: string
          minLength: 1
          maxLength: 50
          example: Smith
          description: Employee last name
        email:
          type: string
          format: email
          example: jane.smith@example.com
          description: Employee email (auto-generated if omitted)
        departmentId:
          type: integer
          example: 2
          description: Department ID to assign (must exist and be active)

    EmployeeUpdate:
      type: object
      properties:
        firstName:
          type: string
          minLength: 1
          maxLength: 50
          example: Jane
        lastName:
          type: string
          minLength: 1
          maxLength: 50
          example: Smith
        email:
          type: string
          format: email
          example: jane.smith@example.com
        departmentId:
          type: integer
          nullable: true
          example: 3
          description: Department ID (null to unassign)
        isActive:
          type: boolean
          example: true

    Error:
      type: object
      required:
        - detail
      properties:
        detail:
          type: string
          example: "Department with ID 999 not found. Please select a valid department or leave unassigned."
          description: Error message with actionable guidance

paths:
  /api/employees:
    get:
      summary: List Employees
      description: Retrieve a paginated list of employees with optional filtering
      operationId: listEmployees
      tags:
        - Employees
      parameters:
        - name: role
          in: query
          schema:
            type: string
          description: Filter by employee role
        - name: is_active
          in: query
          schema:
            type: boolean
          description: Filter by active status
        - name: department_id
          in: query
          schema:
            type: integer
          description: Filter by department ID
        - name: skip
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
          description: Number of records to skip (pagination)
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 1000
            default: 100
          description: Maximum records to return
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Employee'
              example:
                - id: 1
                  firstName: John
                  lastName: Doe
                  email: john.doe@example.com
                  isActive: true
                  departmentId: 2
                  department:
                    id: 2
                    name: Engineering
                    description: Engineering Department
                    active: true
                    parentId: null
                    settings: {}
                    createdAt: "2025-11-20T10:00:00Z"
                    updatedAt: "2025-11-20T10:00:00Z"
                  createdAt: "2025-11-20T12:00:00Z"
                  updatedAt: "2025-11-20T12:00:00Z"
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      summary: Create Employee
      description: Create a new employee with optional department assignment
      operationId: createEmployee
      tags:
        - Employees
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EmployeeCreate'
            examples:
              withDepartment:
                summary: Create with department
                value:
                  firstName: Alice
                  lastName: Johnson
                  email: alice.johnson@example.com
                  departmentId: 2
              withoutEmail:
                summary: Create without email (auto-generate)
                value:
                  firstName: Bob
                  lastName: Wilson
              unassigned:
                summary: Create without department
                value:
                  firstName: Carol
                  lastName: Davis
                  email: carol.davis@example.com
      responses:
        '201':
          description: Employee created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Employee'
        '400':
          description: Bad request (inactive department)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                detail: "Cannot assign employee to inactive department 'Marketing'. Please select an active department."
        '404':
          description: Department not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                detail: "Department with ID 999 not found. Please select a valid department or leave unassigned."
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example:
                detail: "Employee with email existing@example.com already exists. Suggestions: Use a different email or leave it empty to auto-generate."
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /api/employees/{employee_id}:
    get:
      summary: Get Employee
      description: Retrieve a specific employee by ID
      operationId: getEmployee
      tags:
        - Employees
      parameters:
        - name: employee_id
          in: path
          required: true
          schema:
            type: integer
          description: Employee ID
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Employee'
        '404':
          description: Employee not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    patch:
      summary: Update Employee (Partial)
      description: Partially update an existing employee
      operationId: patchEmployee
      tags:
        - Employees
      parameters:
        - name: employee_id
          in: path
          required: true
          schema:
            type: integer
          description: Employee ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EmployeeUpdate'
            examples:
              changeDepartment:
                summary: Change department
                value:
                  departmentId: 3
              unassignDepartment:
                summary: Unassign from department
                value:
                  departmentId: null
              updateEmail:
                summary: Update email
                value:
                  email: newemail@example.com
      responses:
        '200':
          description: Employee updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Employee'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Employee or department not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    put:
      summary: Update Employee (Full)
      description: Fully update an existing employee (same as PATCH)
      operationId: putEmployee
      tags:
        - Employees
      parameters:
        - name: employee_id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EmployeeUpdate'
      responses:
        '200':
          description: Employee updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Employee'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Employee or department not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    delete:
      summary: Delete Employee
      description: Delete an employee from the system
      operationId: deleteEmployee
      tags:
        - Employees
      parameters:
        - name: employee_id
          in: path
          required: true
          schema:
            type: integer
          description: Employee ID
      responses:
        '204':
          description: Employee deleted successfully
        '404':
          description: Employee not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

tags:
  - name: Employees
    description: Employee management operations
  - name: Departments
    description: Department management operations (see /api/departments endpoints)
```

---

## Summary

This comprehensive API documentation covers all department assignment enhancements including:

✅ **Complete Endpoint Reference** - All CRUD operations documented
✅ **Request/Response Schemas** - TypeScript interfaces and validation rules
✅ **Usage Examples** - curl commands with real-world scenarios
✅ **Error Handling** - All HTTP status codes with examples
✅ **Integration Guide** - TypeScript/React implementation patterns
✅ **Performance Optimization** - Caching, rate limiting, and query tips
✅ **OpenAPI 3.0 Schema** - Full specification for code generation

**Next Steps:**
1. Import Postman collection (see `postman-collection.json`)
2. Test all endpoints in your environment
3. Implement client-side service using provided TypeScript examples
4. Set up monitoring for key metrics
5. Configure caching strategies based on your usage patterns

---

**Related Documentation:**
- [409 Error Handling Enhancements](/docs/409_ERROR_HANDLING_ENHANCEMENTS.md)
- [Employee-Department Integration](/docs/api-employee-department-integration.md)
- [Architecture Diagrams](/docs/architecture/)
