# Authentication & Authorization Guide

Complete guide to authentication and authorization in the AI Schedule Manager API.

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [Registration & Login](#registration--login)
- [Token Management](#token-management)
- [Authorization & Permissions](#authorization--permissions)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Best Practices](#best-practices)

---

## Overview

The AI Schedule Manager uses **JWT (JSON Web Tokens)** for stateless authentication with the following features:

- **Dual Token System**: Access tokens (short-lived) + Refresh tokens (long-lived)
- **HTTP-Only Cookies**: Secure token storage for browser clients
- **Bearer Authentication**: Standard Authorization header for API clients
- **Role-Based Access Control (RBAC)**: Hierarchical permission system
- **Security Hardening**: Account locking, rate limiting, audit logging

### Authentication Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ POST /api/auth/register or /api/auth/login
     │ (email + password)
     ▼
┌─────────────┐
│   Backend   │
│   (FastAPI) │
└──────┬──────┘
       │
       │ Validate credentials
       │ Hash password (bcrypt)
       │ Generate JWT tokens
       ▼
┌──────────────────────────┐
│ Access Token (15 min)    │
│ Refresh Token (30 days)  │
└──────────┬───────────────┘
           │
           │ Set HTTP-only cookies
           │ Return tokens in response
           ▼
       ┌──────────┐
       │  Client  │
       └──────────┘
       │
       │ Subsequent requests with token
       │ Authorization: Bearer <access_token>
       ▼
   ┌─────────────┐
   │   Backend   │
   │  (verifies) │
   └─────────────┘
```

---

## Authentication Methods

### Method 1: HTTP-Only Cookies (Recommended for Web)

Tokens are automatically included in cookies with `HttpOnly`, `Secure`, and `SameSite` flags.

**Advantages:**
- Protection against XSS attacks (JavaScript cannot access tokens)
- Automatic inclusion in requests
- Secure by default

**Usage:**
```javascript
// Login with credentials option to include cookies
fetch('http://localhost:8000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important!
  body: JSON.stringify({ email, password })
});

// Subsequent requests automatically include cookies
fetch('http://localhost:8000/api/schedules', {
  credentials: 'include'
});
```

### Method 2: Bearer Token (API Clients)

Manually manage tokens in Authorization header.

**Advantages:**
- Works with non-browser clients (mobile apps, CLIs)
- Full control over token storage
- Suitable for testing

**Usage:**
```bash
# Get token from login response
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  > response.json

# Extract access_token from response
TOKEN=$(jq -r '.access_token' response.json)

# Use token in subsequent requests
curl -X GET http://localhost:8000/api/schedules \
  -H "Authorization: Bearer $TOKEN"
```

---

## Registration & Login

### User Registration

Create a new user account with email and password.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecureP@ss123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Success Response (201 Created):**
```json
{
  "message": "Registration successful",
  "user": {
    "id": 42,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user"],
    "isActive": true
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies Set:**
```
Set-Cookie: access_token=eyJhbGci...; HttpOnly; SameSite=Strict; Max-Age=900
Set-Cookie: refresh_token=eyJhbGci...; HttpOnly; SameSite=Strict; Max-Age=2592000
```

**Error Responses:**

**400 Bad Request** - Weak password:
```json
{
  "error": "Password does not meet requirements",
  "requirements": [
    "Must be at least 8 characters",
    "Must contain uppercase letter",
    "Must contain number"
  ]
}
```

**409 Conflict** - Email already registered:
```json
{
  "detail": "Email already registered"
}
```

---

### User Login

Authenticate with existing credentials.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecureP@ss123"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 42,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user", "manager"],
    "permissions": [
      "read:schedules",
      "write:schedules",
      "manage:employees"
    ],
    "lastSuccessfulLogin": "2025-01-12T10:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

**401 Unauthorized** - Invalid credentials:
```json
{
  "error": "Invalid credentials",
  "remaining_attempts": 3
}
```

**423 Locked** - Account locked:
```json
{
  "error": "Account is locked",
  "message": "Account locked until 2025-01-12T10:30:00Z",
  "locked_until": "2025-01-12T10:30:00Z"
}
```

**403 Forbidden** - Account deactivated:
```json
{
  "detail": "Account is deactivated"
}
```

---

### User Logout

Revoke refresh token and clear cookies.

**Endpoint:** `POST /api/auth/logout`

**Headers:** `Authorization: Bearer <token>` OR Cookie

**Success Response (200 OK):**
```json
{
  "message": "Logout successful"
}
```

**Cookie Clearing:**
```
Set-Cookie: access_token=; Max-Age=0
Set-Cookie: refresh_token=; Max-Age=0
```

---

## Token Management

### Token Structure

#### Access Token (JWT)

**Lifetime:** 15 minutes

**Payload:**
```json
{
  "user_id": 42,
  "sub": 42,
  "email": "john.doe@example.com",
  "roles": ["user", "manager"],
  "permissions": ["read:schedules", "write:schedules"],
  "exp": 1642089900,
  "iat": 1642089000,
  "type": "access"
}
```

**Purpose:**
- Short-lived for security
- Contains user identity and permissions
- Used for API authorization

#### Refresh Token (JWT)

**Lifetime:** 30 days

**Payload:**
```json
{
  "user_id": 42,
  "sub": 42,
  "exp": 1644681000,
  "iat": 1642089000,
  "type": "refresh"
}
```

**Purpose:**
- Long-lived for convenience
- Only used to obtain new access tokens
- Cannot be used for API access

---

### Token Refresh

Get a new access token without re-authentication.

**Endpoint:** `POST /api/auth/refresh`

**Request:** Requires `refresh_token` cookie OR in body

**Request Body (optional):**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**
```json
{
  "message": "Token refreshed successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Updated Cookie:**
```
Set-Cookie: access_token=eyJhbGci...; HttpOnly; SameSite=Strict; Max-Age=900
```

**Error Response (401):**
```json
{
  "detail": "Invalid or expired refresh token"
}
```

---

### Get Current User

Retrieve authenticated user's profile.

**Endpoint:** `GET /api/auth/me`

**Headers:** `Authorization: Bearer <token>` OR Cookie

**Success Response (200 OK):**
```json
{
  "user": {
    "id": 42,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user", "manager"],
    "permissions": [
      "read:schedules",
      "write:schedules",
      "manage:employees",
      "approve:schedules"
    ],
    "isActive": true,
    "emailVerified": true,
    "lastSuccessfulLogin": "2025-01-12T10:00:00Z",
    "createdAt": "2024-06-15T08:00:00Z"
  }
}
```

**Error Response (401):**
```json
{
  "detail": "Authentication required"
}
```

---

## Authorization & Permissions

### Role Hierarchy

The system implements a hierarchical role-based access control:

```
┌────────┐
│ admin  │ (Full system access)
└───┬────┘
    │ inherits all permissions from manager
    ▼
┌────────────┐
│  manager   │ (Department/schedule management)
└─────┬──────┘
      │ inherits all permissions from supervisor
      ▼
┌──────────────┐
│  supervisor  │ (Limited management)
└───────┬──────┘
        │ inherits all permissions from employee
        ▼
┌──────────────┐
│   employee   │ (Basic access)
└──────────────┘
```

### Role Permissions

#### Employee Role
- ✅ View own schedule
- ✅ View own profile
- ✅ Update own availability
- ✅ Confirm/decline own assignments
- ❌ View other employees' schedules
- ❌ Create/modify schedules
- ❌ Manage other employees

#### Supervisor Role
All employee permissions, plus:
- ✅ View department schedules
- ✅ View department employees
- ✅ Suggest schedule changes
- ❌ Approve schedules
- ❌ Create employees
- ❌ Modify other departments

#### Manager Role
All supervisor permissions, plus:
- ✅ Create/edit/delete schedules
- ✅ Approve/reject schedules
- ✅ Create/edit/delete employees
- ✅ Assign shifts to employees
- ✅ View all departments
- ✅ Export data
- ✅ Import data
- ❌ Manage system settings
- ❌ Manage other managers

#### Admin Role
All permissions (unrestricted access)

### Permission Checks

Permissions are checked at two levels:

**1. Route-level (Dependency Injection)**

```python
from ..dependencies import get_current_user, get_current_manager, get_current_admin

# Requires any authenticated user
@router.get("/schedules")
async def get_schedules(current_user = Depends(get_current_user)):
    pass

# Requires manager or admin role
@router.post("/schedules")
async def create_schedule(current_user = Depends(get_current_manager)):
    pass

# Requires admin role only
@router.delete("/employees/{id}")
async def delete_employee(current_user = Depends(get_current_admin)):
    pass
```

**2. Object-level (Model Methods)**

```python
# Check if user can approve schedule
can_approve, reason = schedule.can_approve(current_user)
if not can_approve:
    raise HTTPException(status_code=403, detail=reason)

# Check if user can modify assignment
can_modify, reason = assignment.can_modify(current_user)
if not can_modify:
    raise HTTPException(status_code=403, detail=reason)
```

---

## Security Features

### 1. Password Hashing

**Algorithm:** bcrypt with salt rounds

```python
import bcrypt

# Hash password during registration
password_hash = bcrypt.hashpw(
    password.encode('utf-8'),
    bcrypt.gensalt(rounds=12)
)

# Verify password during login
is_valid = bcrypt.checkpw(
    password.encode('utf-8'),
    stored_hash
)
```

**Benefits:**
- Computationally expensive (prevents brute force)
- Automatic salting
- Adaptive (can increase rounds as hardware improves)

---

### 2. Account Locking

**Trigger:** 5 failed login attempts

**Lock Duration:** 30 minutes

**Process:**
```python
# Track failed attempts
if not verify_password(password, user.password_hash):
    user.failed_login_attempts += 1
    user.last_login_attempt = datetime.utcnow()

    # Lock after 5 attempts
    if user.failed_login_attempts >= 5:
        user.is_locked = True
        user.account_locked_until = datetime.utcnow() + timedelta(minutes=30)
```

**Response when locked:**
```json
{
  "error": "Account is locked",
  "message": "Account locked until 2025-01-12T10:30:00Z",
  "locked_until": "2025-01-12T10:30:00Z"
}
```

**Automatic unlock:** Account automatically unlocks after lock duration expires

---

### 3. Audit Logging

All authentication events are logged to `audit_logs` table:

**Logged Events:**
- Registration attempts (success/failure)
- Login attempts (success/failure with reason)
- Logout events
- Token refresh
- Account locking
- Password changes

**Audit Log Structure:**
```python
{
    "user_id": 42,
    "event_type": "login",
    "resource": "user",
    "action": "login",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "success": True,
    "failure_reason": None,
    "timestamp": "2025-01-12T10:00:00Z"
}
```

**Login Attempt Tracking:**
```python
{
    "user_id": 42,
    "email": "john.doe@example.com",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "success": False,
    "failure_reason": "invalid_password",
    "timestamp": "2025-01-12T09:55:00Z"
}
```

---

### 4. Token Security

**JWT Signing:**
- Algorithm: HS256 (HMAC SHA-256)
- Secret key from environment variable
- Signature prevents tampering

**Token Verification:**
```python
try:
    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=["HS256"]
    )
    # Check expiration
    if payload['exp'] < time.time():
        raise AuthenticationError("Token expired")
except jwt.InvalidTokenError:
    raise AuthenticationError("Invalid token")
```

**Refresh Token Revocation:**
- Tokens can be revoked on logout
- Revoked tokens stored in blacklist
- Expired tokens automatically cleaned up

---

### 5. Cookie Security

**Flags Set:**
```python
response.set_cookie(
    key="access_token",
    value=access_token,
    max_age=900,              # 15 minutes
    httponly=True,            # Prevents JavaScript access (XSS protection)
    secure=True,              # HTTPS only in production
    samesite="strict"         # CSRF protection
)
```

**Security Benefits:**
- **HttpOnly**: Protects against XSS attacks
- **Secure**: Prevents transmission over HTTP
- **SameSite=Strict**: Prevents CSRF attacks

---

### 6. Rate Limiting

**Per-IP Limits:**
- Login: 10 requests/minute
- Registration: 5 requests/minute
- Token refresh: 20 requests/minute

**Per-User Limits:**
- API calls: 100 requests/minute
- Write operations: 30 requests/minute

**Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642089660
```

**Response when rate limited (429):**
```json
{
  "detail": "Rate limit exceeded. Try again in 42 seconds."
}
```

---

## Error Handling

### Authentication Errors

**401 Unauthorized:**
- Invalid credentials
- Missing authentication token
- Expired access token
- Invalid token signature

**403 Forbidden:**
- Account deactivated
- Insufficient permissions
- Access to forbidden resource

**423 Locked:**
- Account locked due to failed login attempts
- Includes unlock time

### Example Error Handler

```python
try:
    response = requests.post(f"{API_URL}/api/auth/login", json=credentials)
    response.raise_for_status()
    data = response.json()
    return data['access_token']

except requests.HTTPError as e:
    if e.response.status_code == 401:
        error = e.response.json()
        print(f"Authentication failed: {error.get('detail')}")
        if 'remaining_attempts' in error:
            print(f"Remaining attempts: {error['remaining_attempts']}")

    elif e.response.status_code == 423:
        error = e.response.json()
        print(f"Account locked until: {error.get('locked_until')}")

    elif e.response.status_code == 403:
        print("Account is deactivated or forbidden")

    raise
```

---

## Code Examples

### Complete Authentication Flow (Python)

```python
import requests
from datetime import datetime, timedelta

class AuthClient:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None

    def register(self, email, password, first_name, last_name):
        """Register new user"""
        response = requests.post(
            f"{self.base_url}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "first_name": first_name,
                "last_name": last_name
            }
        )
        response.raise_for_status()
        data = response.json()

        self.access_token = data['access_token']
        self.token_expiry = datetime.utcnow() + timedelta(minutes=15)

        return data['user']

    def login(self, email, password):
        """Login with credentials"""
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        data = response.json()

        self.access_token = data['access_token']
        self.token_expiry = datetime.utcnow() + timedelta(minutes=15)

        # Extract refresh token from cookies if available
        if 'Set-Cookie' in response.headers:
            self._extract_refresh_token(response.cookies)

        return data['user']

    def _extract_refresh_token(self, cookies):
        """Extract refresh token from cookies"""
        self.refresh_token = cookies.get('refresh_token')

    def is_token_expired(self):
        """Check if access token is expired"""
        if not self.token_expiry:
            return True
        return datetime.utcnow() >= self.token_expiry

    def refresh_access_token(self):
        """Refresh access token using refresh token"""
        if not self.refresh_token:
            raise Exception("No refresh token available")

        response = requests.post(
            f"{self.base_url}/api/auth/refresh",
            json={"refresh_token": self.refresh_token}
        )
        response.raise_for_status()
        data = response.json()

        self.access_token = data['access_token']
        self.token_expiry = datetime.utcnow() + timedelta(minutes=15)

        return self.access_token

    def get_headers(self):
        """Get authorization headers for API requests"""
        # Refresh token if expired
        if self.is_token_expired():
            self.refresh_access_token()

        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

    def logout(self):
        """Logout and clear tokens"""
        if self.access_token:
            requests.post(
                f"{self.base_url}/api/auth/logout",
                headers=self.get_headers()
            )

        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None

# Usage
auth = AuthClient()

# Register
user = auth.register(
    email="john.doe@example.com",
    password="SecureP@ss123",
    first_name="John",
    last_name="Doe"
)
print(f"Registered user: {user['email']}")

# Make authenticated request
response = requests.get(
    f"{auth.base_url}/api/schedules",
    headers=auth.get_headers()
)
schedules = response.json()

# Logout
auth.logout()
```

### Browser JavaScript with Cookies

```javascript
class AuthClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  async register(email, password, firstName, lastName) {
    const response = await fetch(`${this.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return await response.json();
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 423) {
        throw new Error(`Account locked until ${error.locked_until}`);
      }
      throw new Error(error.detail || 'Login failed');
    }

    return await response.json();
  }

  async logout() {
    await fetch(`${this.baseURL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  }

  async getCurrentUser() {
    const response = await fetch(`${this.baseURL}/api/auth/me`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    return await response.json();
  }

  async apiRequest(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: 'include', // Always include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Handle 401 - try to refresh token
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry original request
        return fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
      }
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    return await response.json();
  }

  async refreshToken() {
    try {
      await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Usage
const auth = new AuthClient();

// Login
try {
  const result = await auth.login('john.doe@example.com', 'SecureP@ss123');
  console.log('Logged in:', result.user.email);

  // Get current user
  const userData = await auth.getCurrentUser();
  console.log('User:', userData.user);

  // Make API request
  const schedules = await auth.apiRequest('/api/schedules?status=published');
  console.log('Schedules:', schedules);

  // Logout
  await auth.logout();
  console.log('Logged out');

} catch (error) {
  console.error('Error:', error.message);
}
```

---

## Best Practices

### 1. Token Storage

**Browser Applications:**
- ✅ Use HTTP-only cookies (recommended)
- ✅ Never store tokens in localStorage (vulnerable to XSS)
- ✅ Never store tokens in sessionStorage (vulnerable to XSS)

**Mobile/Desktop Applications:**
- ✅ Use secure platform-specific storage (Keychain, Keystore)
- ✅ Encrypt tokens before storage
- ❌ Don't store in plain text files

**CLI/Script Applications:**
- ✅ Use environment variables for long-lived tokens
- ✅ Prompt for credentials when possible
- ✅ Use OAuth device flow for better security

### 2. Token Refresh Strategy

**Proactive Refresh:**
```javascript
// Refresh before expiration (e.g., at 80% of lifetime)
if (tokenAge > 0.8 * tokenLifetime) {
  await refreshToken();
}
```

**Reactive Refresh:**
```javascript
// Refresh on 401 error
try {
  await apiRequest('/api/schedules');
} catch (error) {
  if (error.status === 401) {
    await refreshToken();
    // Retry original request
    await apiRequest('/api/schedules');
  }
}
```

### 3. Password Management

**Client-side Validation:**
```javascript
function validatePassword(password) {
  const requirements = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*]/.test(password)
  };

  const isValid = Object.values(requirements).every(Boolean);

  return {
    isValid,
    requirements,
    missing: Object.keys(requirements).filter(key => !requirements[key])
  };
}
```

**Never:**
- ❌ Log passwords (even hashed)
- ❌ Include passwords in error messages
- ❌ Send passwords in GET requests
- ❌ Store passwords in browser history

### 4. Error Handling

**Handle Specific Error Cases:**
```python
def handle_auth_error(response):
    if response.status_code == 401:
        error = response.json()
        if 'remaining_attempts' in error:
            # Warn user about remaining attempts
            show_warning(f"{error['remaining_attempts']} attempts remaining")

    elif response.status_code == 423:
        error = response.json()
        # Show account locked message with unlock time
        show_error(f"Account locked until {error['locked_until']}")

    elif response.status_code == 403:
        # Redirect to login or show insufficient permissions
        show_error("Access forbidden")
```

### 5. Logout on Token Expiration

Always logout user when refresh token expires:

```javascript
async function apiRequest(endpoint) {
  try {
    return await fetch(endpoint, { credentials: 'include' });
  } catch (error) {
    if (error.status === 401) {
      // Try refresh
      const refreshed = await refreshToken();
      if (!refreshed) {
        // Refresh failed - logout user
        await logout();
        redirectToLogin();
      }
    }
  }
}
```

### 6. CSRF Protection

For state-changing requests, include CSRF token:

```javascript
// Get CSRF token
const csrfResponse = await fetch('/api/auth/csrf-token');
const { csrf_token } = await csrfResponse.json();

// Include in POST/PUT/DELETE requests
await fetch('/api/schedules', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrf_token
  },
  credentials: 'include',
  body: JSON.stringify(scheduleData)
});
```

---

For more information:
- [API Reference](./API_REFERENCE.md)
- [Data Models](./DATA_MODELS.md)
- [OpenAPI Specification](./openapi.yaml)
