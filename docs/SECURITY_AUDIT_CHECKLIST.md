# Security Audit Checklist

## Overview
Comprehensive security audit checklist for production deployment validation.

## Authentication & Authorization

### Authentication Testing

#### Test 1: All Endpoints Require Authentication
```bash
# Test unauthenticated access to protected endpoints
curl -X GET http://localhost:8000/api/employees
# Expected: 401 Unauthorized

curl -X POST http://localhost:8000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Test", "last_name": "User"}'
# Expected: 401 Unauthorized

curl -X PUT http://localhost:8000/api/employees/1
# Expected: 401 Unauthorized

curl -X DELETE http://localhost:8000/api/employees/1
# Expected: 401 Unauthorized
```

**Checklist**:
- [ ] GET /api/employees requires authentication
- [ ] POST /api/employees requires authentication
- [ ] PUT /api/employees/{id} requires authentication
- [ ] DELETE /api/employees/{id} requires authentication
- [ ] GET /api/employees/{id} requires authentication
- [ ] All other protected endpoints require authentication

#### Test 2: Token Expiration
```bash
# Generate token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -d "username=admin&password=admin123" | jq -r .access_token)

# Wait for token expiration (default: 30 minutes)
sleep 1800

# Try to use expired token
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: Bearer $TOKEN"
# Expected: 401 Unauthorized - Token expired
```

**Checklist**:
- [ ] Tokens expire after configured time (30 minutes default)
- [ ] Expired tokens return 401 Unauthorized
- [ ] Error message indicates token expiration
- [ ] No sensitive data in error response

#### Test 3: Invalid Token Handling
```bash
# Test with invalid token
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: Bearer invalid_token_here"
# Expected: 401 Unauthorized

# Test with malformed authorization header
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: invalid_format"
# Expected: 401 Unauthorized

# Test with missing Bearer prefix
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: $TOKEN"
# Expected: 401 Unauthorized
```

**Checklist**:
- [ ] Invalid tokens rejected
- [ ] Malformed headers rejected
- [ ] Missing Bearer prefix rejected
- [ ] Clear error messages returned

### Authorization Testing (RBAC)

#### Test 4: Admin-Only Endpoints
```bash
# Login as regular employee
EMPLOYEE_TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -d "username=user1&password=password123" | jq -r .access_token)

# Try to access admin-only endpoints
# Test role change (admin only)
curl -X PUT http://localhost:8000/api/admin/users/2/role \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
# Expected: 403 Forbidden

# Test user deletion (admin only)
curl -X DELETE http://localhost:8000/api/admin/users/2 \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
# Expected: 403 Forbidden

# Test status change (admin only)
curl -X PUT http://localhost:8000/api/admin/users/2/status \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
# Expected: 403 Forbidden

# Test password reset (admin only)
curl -X POST http://localhost:8000/api/admin/users/2/reset-password \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
# Expected: 403 Forbidden
```

**Checklist**:
- [ ] Role change endpoint requires admin role
- [ ] User deletion requires admin role
- [ ] Status change requires admin role
- [ ] Password reset requires admin role
- [ ] All admin endpoints return 403 for non-admin users

#### Test 5: Resource-Based Access Control
```bash
# Employee should only access own data
EMPLOYEE1_TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -d "username=user1&password=password123" | jq -r .access_token)

EMPLOYEE2_TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -d "username=user2&password=password123" | jq -r .access_token)

# Employee 1 tries to update Employee 2's data
curl -X PUT http://localhost:8000/api/employees/2 \
  -H "Authorization: Bearer $EMPLOYEE1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Hacked"}'
# Expected: 403 Forbidden (not own resource)

# Employee 1 can update own data
curl -X PUT http://localhost:8000/api/employees/1 \
  -H "Authorization: Bearer $EMPLOYEE1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Updated"}'
# Expected: 200 OK
```

**Checklist**:
- [ ] Employees cannot modify other employees' data
- [ ] Employees can only view/edit own profile
- [ ] Admin can modify all employee data
- [ ] Proper 403 responses for unauthorized access

## Input Validation

### Test 6: SQL Injection Protection
```bash
# Test SQL injection in search
curl -X GET "http://localhost:8000/api/employees?search=' OR '1'='1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: Safe handling, no SQL injection

# Test SQL injection in filters
curl -X GET "http://localhost:8000/api/employees?department='; DROP TABLE users; --" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: Safe handling, no tables dropped
```

**Checklist**:
- [ ] Search parameters properly escaped
- [ ] Filter parameters properly escaped
- [ ] All queries use parameterized statements
- [ ] No raw SQL concatenation
- [ ] Database still intact after injection attempts

### Test 7: XSS Protection
```bash
# Test XSS in employee creation
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "<script>alert(\"XSS\")</script>",
    "last_name": "Test",
    "department": "Engineering",
    "position": "Engineer"
  }'

# Retrieve employee and check if script is escaped
curl -X GET http://localhost:8000/api/employees/999 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: HTML entities escaped or rejected
```

**Checklist**:
- [ ] HTML/script tags properly escaped
- [ ] No JavaScript execution in responses
- [ ] Input sanitization active
- [ ] Content-Type headers set correctly

### Test 8: Request Validation
```bash
# Test with invalid data types
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": 12345,
    "last_name": true,
    "hire_date": "not-a-date"
  }'
# Expected: 400 Bad Request with validation errors

# Test with missing required fields
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test"
  }'
# Expected: 400 Bad Request - missing required fields

# Test with extra fields
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "malicious_field": "hack",
    "department": "Engineering"
  }'
# Expected: Extra fields ignored or rejected
```

**Checklist**:
- [ ] Invalid data types rejected
- [ ] Missing required fields rejected
- [ ] Extra/unknown fields handled safely
- [ ] Clear validation error messages
- [ ] No sensitive data in error messages

### Test 9: Rate Limiting
```bash
# Test rate limiting (100+ rapid requests)
for i in {1..150}; do
  curl -X GET http://localhost:8000/api/employees \
    -H "Authorization: Bearer $ADMIN_TOKEN" &
done
wait

# Expected: Some requests return 429 Too Many Requests
```

**Checklist**:
- [ ] Rate limiting enforced
- [ ] 429 status returned when limit exceeded
- [ ] Rate limit headers present (X-RateLimit-Limit, X-RateLimit-Remaining)
- [ ] Retry-After header included in 429 responses

### Test 10: Request Size Limits
```bash
# Test with oversized request body (>1MB)
python3 <<EOF
import requests
import json

large_payload = {
    "first_name": "Test",
    "last_name": "User",
    "extended_fields": {"data": "x" * 2000000}  # 2MB of data
}

response = requests.post(
    "http://localhost:8000/api/employees",
    headers={"Authorization": "Bearer $ADMIN_TOKEN"},
    json=large_payload
)
print(f"Status: {response.status_code}")
# Expected: 413 Payload Too Large
EOF
```

**Checklist**:
- [ ] Request size limit enforced (1MB max)
- [ ] 413 status returned for oversized requests
- [ ] No memory exhaustion from large payloads

## CSRF Protection

### Test 11: CSRF Token Validation
```bash
# Test mutating endpoint without CSRF token
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "department": "Engineering"
  }'
# Expected: 403 Forbidden - CSRF token missing (if CSRF enabled)

# Test with invalid CSRF token
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-CSRF-Token: invalid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "department": "Engineering"
  }'
# Expected: 403 Forbidden - CSRF token invalid
```

**Checklist**:
- [ ] CSRF protection active on mutating endpoints (POST, PUT, DELETE)
- [ ] Missing CSRF token rejected
- [ ] Invalid CSRF token rejected
- [ ] GET requests don't require CSRF token
- [ ] CSRF tokens properly generated and validated

## Security Headers

### Test 12: HTTP Security Headers
```bash
# Check security headers
curl -I http://localhost:8000/api/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Content-Security-Policy: default-src 'self'
# Referrer-Policy: strict-origin-when-cross-origin
```

**Checklist**:
- [ ] X-Content-Type-Options: nosniff present
- [ ] X-Frame-Options: DENY present
- [ ] X-XSS-Protection: 1; mode=block present
- [ ] Strict-Transport-Security (HSTS) present
- [ ] Content-Security-Policy present
- [ ] Referrer-Policy present

## Data Protection

### Test 13: Password Security
```bash
# Verify passwords are hashed in database
psql $DATABASE_URL -c "SELECT username, hashed_password FROM users LIMIT 5;"

# Expected: Hashed passwords (bcrypt format: $2b$...)
# Should NOT see plaintext passwords
```

**Checklist**:
- [ ] Passwords hashed with bcrypt
- [ ] Plaintext passwords never stored
- [ ] Hash format: $2b$12$... (bcrypt with cost factor 12+)
- [ ] Passwords never returned in API responses

### Test 14: Sensitive Data Exposure
```bash
# Check user endpoint response
curl -X GET http://localhost:8000/api/users/me \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: No hashed_password field in response
```

**Checklist**:
- [ ] Passwords excluded from API responses
- [ ] Sensitive fields filtered from serialization
- [ ] No internal IDs exposed unnecessarily
- [ ] Error messages don't expose system details

### Test 15: HTTPS Enforcement
```bash
# Test HTTP access (should redirect to HTTPS in production)
curl -I http://localhost:8000/api/employees

# Expected in production:
# 301 Moved Permanently
# Location: https://localhost:8000/api/employees
```

**Checklist**:
- [ ] HTTPS enforced in production
- [ ] HTTP redirects to HTTPS
- [ ] Secure flag on cookies
- [ ] HSTS header present

## Audit Trails

### Test 16: Critical Operation Logging
```bash
# Perform critical operations and check logs
# 1. Role change
curl -X PUT http://localhost:8000/api/admin/users/2/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "manager"}'

# 2. Status change
curl -X PUT http://localhost:8000/api/admin/users/2/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# 3. Password reset
curl -X POST http://localhost:8000/api/admin/users/2/reset-password \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check audit logs
tail -f backend/logs/audit.log
# Expected: All operations logged with user, timestamp, action
```

**Checklist**:
- [ ] Role changes logged
- [ ] Status changes logged
- [ ] Password resets logged
- [ ] Department changes logged
- [ ] Failed login attempts logged
- [ ] Logs include: timestamp, user, action, target, IP address

## Environment Security

### Test 17: No Secrets in Code
```bash
# Search for potential secrets in code
grep -r "password\s*=\s*['\"]" backend/src/
grep -r "api_key\s*=\s*['\"]" backend/src/
grep -r "secret\s*=\s*['\"]" backend/src/
grep -r "token\s*=\s*['\"]" backend/src/

# Expected: No hardcoded secrets found
```

**Checklist**:
- [ ] No hardcoded passwords
- [ ] No hardcoded API keys
- [ ] No hardcoded secrets
- [ ] All secrets in environment variables
- [ ] .env file in .gitignore

### Test 18: Environment Variable Validation
```bash
# Run environment validation script
python backend/scripts/production_validation.py

# Expected: All required environment variables present
```

**Checklist**:
- [ ] DATABASE_URL configured
- [ ] SECRET_KEY configured (32+ random characters)
- [ ] CORS_ORIGINS configured
- [ ] All sensitive data in environment variables
- [ ] Environment variables not committed to git

## Final Security Assessment

### Security Score Calculation

**Critical Issues (Block Deployment)**:
- [ ] SQL injection vulnerabilities
- [ ] Authentication bypass
- [ ] Authorization bypass
- [ ] Password storage in plaintext
- [ ] Secrets in code

**High Severity Issues (Fix Before Deployment)**:
- [ ] Missing CSRF protection
- [ ] Missing rate limiting
- [ ] Weak password hashing
- [ ] Missing security headers
- [ ] No HTTPS enforcement

**Medium Severity Issues (Fix Soon)**:
- [ ] Missing audit logs
- [ ] Insufficient input validation
- [ ] Missing request size limits
- [ ] Incomplete error handling

**Low Severity Issues (Enhancement)**:
- [ ] Missing CSP directives
- [ ] Missing rate limit headers
- [ ] Verbose error messages

### Assessment Criteria

**Security Level**:
- **Production Ready**: 0 critical, 0-2 high severity issues
- **Needs Work**: 1+ critical or 3+ high severity issues
- **Not Ready**: Multiple critical issues

### Sign-Off

**Security Audit Completed By**: _________________
**Date**: _________________
**Security Level**: [ ] Production Ready  [ ] Needs Work  [ ] Not Ready

**Critical Issues Found**: _______
**High Severity Issues**: _______
**Medium Severity Issues**: _______
**Low Severity Issues**: _______

**Deployment Approval**: [ ] Approved  [ ] Rejected

**Notes**:
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
