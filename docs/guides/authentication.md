# Authentication

The AI Schedule Manager API uses JWT (JSON Web Tokens) for authentication and implements role-based access control to secure your scheduling data.

## Overview

- **Token Type**: JWT (JSON Web Tokens)
- **Token Location**: Authorization header or HTTP-only cookies
- **Token Expiration**: 15 minutes (access token), 30 days (refresh token)
- **Roles**: Manager, Employee
- **Security Features**: Rate limiting, account lockout, audit logging

## Authentication Flow

### 1. Login

Authenticate with email and password to receive JWT tokens:

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "password": "your-secure-password"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYW5hZ2VyQGV4YW1wbGUuY29tIiwiZXhwIjoxNjQwOTk1MjAwLCJyb2xlIjoibWFuYWdlciJ9.signature",
  "token_type": "bearer",
  "user": {
    "email": "manager@example.com",
    "role": "manager"
  }
}
```

### 2. Using Access Tokens

Include the access token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "http://localhost:8000/api/employees"
```

### 3. Token Refresh

When your access token expires, use the refresh token to get a new one:

```bash
curl -X POST "http://localhost:8000/api/auth/refresh" \
  -H "Cookie: refresh_token=YOUR_REFRESH_TOKEN"
```

**Response:**
```json
{
  "message": "Token refreshed successfully",
  "access_token": "new_access_token_here"
}
```

### 4. Logout

Invalidate your refresh token:

```bash
curl -X POST "http://localhost:8000/api/auth/logout" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Token Structure

### Access Token
- **Expiration**: 15 minutes
- **Purpose**: API access
- **Contains**: User ID, email, role, permissions
- **Storage**: Memory or secure storage (not localStorage)

### Refresh Token
- **Expiration**: 30 days
- **Purpose**: Generate new access tokens
- **Contains**: User ID, token ID (JTI)
- **Storage**: HTTP-only secure cookie

## Role-Based Access Control

### Manager Role
Managers have full access to the system:

```json
{
  "role": "manager",
  "permissions": [
    "employees:create",
    "employees:read",
    "employees:update",
    "employees:delete",
    "schedules:create",
    "schedules:read",
    "schedules:update",
    "schedules:delete",
    "rules:create",
    "rules:read",
    "rules:update",
    "rules:delete",
    "notifications:create",
    "notifications:read",
    "analytics:read",
    "schedule:generate",
    "schedule:optimize"
  ]
}
```

### Employee Role
Employees have limited access:

```json
{
  "role": "employee",
  "permissions": [
    "employees:read_own",
    "schedules:read_own",
    "notifications:read_own",
    "notifications:update_own"
  ]
}
```

## Security Features

### Rate Limiting

Authentication endpoints are rate-limited to prevent abuse:

- **Login**: 5 attempts per 5 minutes per IP
- **Refresh**: 10 attempts per hour per user
- **Password Reset**: 3 attempts per hour per IP

**Rate Limit Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1640995500
Retry-After: 300
```

### Account Lockout

After 5 failed login attempts, accounts are temporarily locked:

- **Lockout Duration**: 30 minutes
- **Reset Method**: Automatic after timeout or admin unlock
- **Notification**: Email sent to account owner

**Locked Account Response:**
```json
{
  "error": "Account is locked",
  "message": "Account locked until 2024-01-15T10:30:00Z",
  "locked_until": "2024-01-15T10:30:00Z"
}
```

### Password Requirements

Passwords must meet these criteria:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Not a common password

**Password Validation Response:**
```json
{
  "error": "Password does not meet requirements",
  "requirements": [
    "Must be at least 8 characters long",
    "Must contain uppercase letters",
    "Must contain numbers"
  ]
}
```

## Implementation Examples

### JavaScript/TypeScript

```javascript
class AuthService {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.accessToken = null;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.accessToken = data.access_token;

    // Store token securely (not in localStorage for security)
    sessionStorage.setItem('access_token', data.access_token);

    return data;
  }

  async apiCall(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Auto-refresh token if expired
    if (response.status === 401) {
      await this.refreshToken();
      headers.Authorization = `Bearer ${this.accessToken}`;

      response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }

    return response;
  }

  async refreshToken() {
    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    sessionStorage.setItem('access_token', data.access_token);
  }

  async logout() {
    await fetch(`${this.baseURL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      credentials: 'include',
    });

    this.accessToken = null;
    sessionStorage.removeItem('access_token');
  }
}

// Usage
const auth = new AuthService('http://localhost:8000');

try {
  await auth.login('manager@example.com', 'password123');

  // Make authenticated API calls
  const response = await auth.apiCall('/api/employees');
  const employees = await response.json();

} catch (error) {
  console.error('Authentication error:', error);
}
```

### Python

```python
import requests
from datetime import datetime, timedelta
import jwt

class AuthService:
    def __init__(self, base_url):
        self.base_url = base_url
        self.access_token = None
        self.refresh_token = None
        self.session = requests.Session()

    def login(self, email, password):
        """Login and store tokens"""
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()

        data = response.json()
        self.access_token = data["access_token"]

        # Extract refresh token from cookies
        if 'refresh_token' in response.cookies:
            self.refresh_token = response.cookies['refresh_token']

        return data

    def api_call(self, method, endpoint, **kwargs):
        """Make authenticated API call with auto-refresh"""
        headers = kwargs.get('headers', {})

        if self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'

        kwargs['headers'] = headers

        response = self.session.request(
            method,
            f"{self.base_url}{endpoint}",
            **kwargs
        )

        # Auto-refresh if token expired
        if response.status_code == 401:
            self.refresh_access_token()
            headers['Authorization'] = f'Bearer {self.access_token}'
            kwargs['headers'] = headers

            response = self.session.request(
                method,
                f"{self.base_url}{endpoint}",
                **kwargs
            )

        return response

    def refresh_access_token(self):
        """Refresh the access token"""
        if self.refresh_token:
            # Set refresh token cookie
            self.session.cookies['refresh_token'] = self.refresh_token

        response = self.session.post(f"{self.base_url}/api/auth/refresh")
        response.raise_for_status()

        data = response.json()
        self.access_token = data["access_token"]

    def logout(self):
        """Logout and clear tokens"""
        if self.access_token:
            self.session.post(
                f"{self.base_url}/api/auth/logout",
                headers={'Authorization': f'Bearer {self.access_token}'}
            )

        self.access_token = None
        self.refresh_token = None
        self.session.cookies.clear()

    def is_token_expired(self):
        """Check if access token is expired"""
        if not self.access_token:
            return True

        try:
            # Decode without verification to check expiration
            payload = jwt.decode(self.access_token, options={"verify_signature": False})
            exp = payload.get('exp')

            if exp:
                return datetime.utcnow() > datetime.fromtimestamp(exp)
        except jwt.InvalidTokenError:
            return True

        return False

# Usage
auth = AuthService('http://localhost:8000')

try:
    # Login
    user_data = auth.login('manager@example.com', 'password123')
    print(f"Logged in as: {user_data['user']['email']}")

    # Make authenticated API calls
    response = auth.api_call('GET', '/api/employees')
    employees = response.json()

    # Create a new employee
    new_employee = {
        "name": "Jane Doe",
        "email": "jane.doe@example.com",
        "role": "server"
    }

    response = auth.api_call(
        'POST',
        '/api/employees',
        json=new_employee
    )

    if response.status_code == 201:
        print("Employee created successfully")

except requests.exceptions.RequestException as e:
    print(f"API error: {e}")
```

### cURL Examples

#### Login and Store Cookies
```bash
# Login and save cookies
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "manager@example.com", "password": "password123"}' \
  -c cookies.txt \
  | jq -r '.access_token' > token.txt

# Use stored token
TOKEN=$(cat token.txt)

# Make authenticated requests
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/employees"

# Refresh token using cookies
curl -X POST "http://localhost:8000/api/auth/refresh" \
  -b cookies.txt \
  | jq -r '.access_token' > token.txt
```

## Error Handling

### Common Authentication Errors

#### Invalid Credentials
```json
{
  "detail": "Invalid credentials"
}
```

#### Token Expired
```json
{
  "detail": "Token has expired"
}
```

#### Insufficient Permissions
```json
{
  "detail": "Insufficient permissions"
}
```

#### Rate Limit Exceeded
```json
{
  "detail": "Rate limit exceeded. Try again in 60 seconds.",
  "retry_after": 60
}
```

## Security Best Practices

### For Frontend Applications

1. **Store tokens securely**:
   - Use `sessionStorage` for access tokens (not `localStorage`)
   - Let HTTP-only cookies handle refresh tokens
   - Never store tokens in plain text

2. **Implement token refresh**:
   - Automatically refresh expired tokens
   - Handle refresh failures gracefully
   - Redirect to login when refresh fails

3. **Use HTTPS in production**:
   - All authentication requests must use HTTPS
   - Secure cookie flags are enforced

### For Backend Applications

1. **Store tokens securely**:
   - Use environment variables
   - Encrypt tokens at rest
   - Implement proper key rotation

2. **Validate tokens properly**:
   - Verify token signatures
   - Check expiration times
   - Validate user permissions

3. **Handle errors gracefully**:
   - Don't expose sensitive information
   - Log security events
   - Implement proper retry logic

## Troubleshooting

### Token Issues

**Problem**: 401 Unauthorized
- **Cause**: Missing or invalid token
- **Solution**: Check token format and expiration

**Problem**: 403 Forbidden
- **Cause**: Insufficient permissions
- **Solution**: Verify user role and endpoint requirements

**Problem**: Rate limit exceeded
- **Cause**: Too many requests
- **Solution**: Implement exponential backoff

### Login Issues

**Problem**: Account locked
- **Cause**: Too many failed attempts
- **Solution**: Wait 30 minutes or contact support

**Problem**: Invalid credentials
- **Cause**: Wrong email/password
- **Solution**: Verify credentials or reset password

## Support

For authentication-related issues:

- 📧 Security Team: [security@ai-schedule-manager.com](mailto:security@ai-schedule-manager.com)
- 📚 Documentation: [Authentication Guide](https://docs.ai-schedule-manager.com/authentication)
- 🔒 Security Issues: [security@ai-schedule-manager.com](mailto:security@ai-schedule-manager.com)