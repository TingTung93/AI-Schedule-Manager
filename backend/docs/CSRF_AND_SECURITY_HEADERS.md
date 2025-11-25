# CSRF Protection and Security Headers Implementation

## Overview

This document describes the CSRF protection and security headers implementation added to the AI Schedule Manager backend API.

## CSRF Protection

### Implementation Details

**Library**: `fastapi-csrf-protect` v1.0.7

**Configuration**:
- CSRF secret key: Uses `CSRF_SECRET_KEY` environment variable, falls back to `SECRET_KEY`
- Cookie settings:
  - `SameSite`: `lax` (prevents CSRF in most scenarios)
  - `Secure`: `true` in production (HTTPS only)
  - `HttpOnly`: `true` (prevents JavaScript access)

### CSRF Token Endpoint

**GET /api/csrf-token**
- Returns CSRF token in a secure HTTP-only cookie
- Frontend should call this on app initialization
- Token must be included in `X-CSRF-Token` header for protected requests

### Protected Endpoints

CSRF validation is enforced on all mutating endpoints (POST, PATCH, DELETE):

- `/api/rules/parse` (POST)
- `/api/rules/{id}` (PATCH, DELETE)
- `/api/schedules/{id}` (PATCH, DELETE)
- `/api/schedules/{id}/shifts/{shift_id}` (PATCH)
- `/api/notifications` (POST)
- `/api/notifications/{id}/read` (PATCH)
- `/api/notifications/{id}` (DELETE)
- `/api/notifications/mark-all-read` (POST)
- `/api/schedule/generate` (POST)
- `/api/schedule/optimize` (POST)

### Frontend Integration

```javascript
// 1. Get CSRF token on app initialization
async function initializeCsrf() {
  await fetch('http://localhost:8000/api/csrf-token', {
    credentials: 'include'  // Include cookies
  });
}

// 2. Include CSRF token in mutating requests
async function createRule(ruleData) {
  const response = await fetch('http://localhost:8000/api/rules/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfTokenFromCookie()  // Extract from cookie
    },
    credentials: 'include',
    body: JSON.stringify(ruleData)
  });
}
```

### Error Handling

Invalid or missing CSRF tokens return:
```json
{
  "detail": "CSRF token validation failed. Please refresh and try again.",
  "error_code": "CSRF_VALIDATION_FAILED"
}
```
Status code: `403 Forbidden`

## Security Headers

All responses include comprehensive security headers for defense in depth:

### X-Content-Type-Options: nosniff
Prevents browsers from MIME-sniffing responses away from the declared content-type.
- **Protection**: Prevents execution of non-executable MIME types
- **Attack Vector Mitigated**: MIME confusion attacks

### X-Frame-Options: DENY
Prevents the page from being displayed in a frame, iframe, embed, or object.
- **Protection**: Prevents clickjacking attacks
- **Attack Vector Mitigated**: UI redress attacks, clickjacking

### X-XSS-Protection: 1; mode=block
Enables the browser's built-in XSS filter.
- **Protection**: Stops pages from loading when XSS attacks are detected
- **Attack Vector Mitigated**: Reflected XSS attacks

### Strict-Transport-Security (HSTS)
Forces HTTPS connections (production only).
- **Header**: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **Protection**: Prevents protocol downgrade attacks and cookie hijacking
- **Attack Vector Mitigated**: Man-in-the-middle attacks

### Content-Security-Policy (CSP)
Restricts resource loading to prevent XSS and data injection.
- **Policy**:
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' http://localhost:* ws://localhost:*
  ```
- **Protection**: Prevents unauthorized resource loading
- **Attack Vector Mitigated**: XSS, code injection, data exfiltration

### Referrer-Policy: strict-origin-when-cross-origin
Controls how much referrer information is included with requests.
- **Protection**: Prevents leaking sensitive information in URLs
- **Attack Vector Mitigated**: Information disclosure

### Permissions-Policy
Restricts access to browser features and APIs.
- **Policy**: `geolocation=(), microphone=(), camera=()`
- **Protection**: Prevents unauthorized access to device features
- **Attack Vector Mitigated**: Privacy violations, unauthorized tracking

## CORS Configuration

### Environment-Based Origins

Allowed origins are configured via the `ALLOWED_ORIGINS` environment variable:

```bash
# .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:80,https://myapp.com
```

Default: `http://localhost:3000,http://localhost:80`

### CORS Headers

- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE
- **Allowed Headers**: Content-Type, Authorization, X-CSRF-Token
- **Exposed Headers**: X-CSRF-Token (allows frontend to read CSRF token)
- **Credentials**: Enabled (allows cookies)

## Error Message Sanitization

Production error messages are sanitized to prevent information leakage:

**Development**:
```json
{
  "detail": "Failed to parse rule: Invalid employee ID 'abc123'"
}
```

**Production** (when `ENVIRONMENT=production`):
```json
{
  "detail": "Failed to parse rule"
}
```

Detailed errors are always logged server-side for debugging.

## Testing

### Verification Script

```bash
cd backend
source venv/bin/activate
python tests/verify_csrf_code.py
```

### Manual Testing with curl

```bash
# 1. Test security headers
curl -I http://localhost:8000/health

# 2. Get CSRF token
curl -c /tmp/cookies.txt http://localhost:8000/api/csrf-token

# 3. Test POST without CSRF token (should fail with 403)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  http://localhost:8000/api/rules/parse

# 4. Test POST with CSRF token (requires authentication)
curl -X POST \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token>" \
  -d '{"rule_text": "test"}' \
  http://localhost:8000/api/rules/parse
```

## Security Checklist

- [x] CSRF protection on all mutating endpoints
- [x] Secure CSRF token generation and validation
- [x] HTTP-only, Secure, SameSite cookies
- [x] X-Content-Type-Options header
- [x] X-Frame-Options header
- [x] X-XSS-Protection header
- [x] Content-Security-Policy header
- [x] Referrer-Policy header
- [x] Permissions-Policy header
- [x] HSTS in production
- [x] CORS origin restrictions
- [x] Error message sanitization
- [x] Security logging for failed CSRF validations

## Dependencies

- `fastapi-csrf-protect==1.0.7`
- `itsdangerous>=2.0.1` (CSRF token signing)
- `pydantic-settings>=2.0.0` (configuration)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CSRF_SECRET_KEY` | Secret key for CSRF token generation | Falls back to `SECRET_KEY` |
| `ENVIRONMENT` | Environment mode (`development`/`production`) | `development` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000,http://localhost:80` |

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [fastapi-csrf-protect Documentation](https://github.com/aekasitt/fastapi-csrf-protect)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)

## Compliance

This implementation helps meet security requirements for:
- OWASP Top 10 (A01:2021 - Broken Access Control)
- OWASP Top 10 (A03:2021 - Injection)
- OWASP Top 10 (A05:2021 - Security Misconfiguration)
- PCI-DSS 6.5.9 (CSRF Protection)
- CWE-352 (Cross-Site Request Forgery)

---

**Last Updated**: 2025-11-24
**Status**: ✅ Implemented and Verified
