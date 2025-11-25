#!/usr/bin/env python3
"""
Script to add CSRF protection and security headers to main.py
"""

import re

# Read the current main.py
with open('src/main.py', 'r') as f:
    content = f.read()

# 1. Add CSRF imports
imports_pattern = r'from pydantic import ValidationError as PydanticValidationError'
imports_replacement = '''from fastapi_csrf_protect import CsrfProtect
from fastapi_csrf_protect.exceptions import CsrfProtectError
from pydantic import BaseModel, ValidationError as PydanticValidationError'''

if 'fastapi_csrf_protect' not in content:
    content = content.replace(imports_pattern, imports_replacement)
    print("✓ Added CSRF imports")
else:
    print("- CSRF imports already present")

# 2. Add CSRF configuration after SECRET_KEY validation
csrf_config = '''
# CSRF configuration
class CsrfSettings(BaseModel):
    secret_key: str = os.getenv("CSRF_SECRET_KEY", settings.SECRET_KEY)
    cookie_samesite: str = "lax"
    cookie_secure: bool = os.getenv("ENVIRONMENT", "development") == "production"
    cookie_httponly: bool = True

@CsrfProtect.load_config
def get_csrf_config():
    return CsrfSettings()

'''

csrf_pattern = r'# Initialize rate limiter\nlimiter = Limiter'

if '# CSRF configuration' not in content:
    content = content.replace(csrf_pattern, csrf_config + '# Initialize rate limiter\nlimiter = Limiter')
    print("✓ Added CSRF configuration")
else:
    print("- CSRF configuration already present")

# 3. Add CSRF exception handler after rate limit handler
csrf_handler = '''

# CSRF exception handler
@app.exception_handler(CsrfProtectError)
async def csrf_protect_exception_handler(request: Request, exc: CsrfProtectError):
    """
    Custom exception handler for CSRF protection errors.
    Returns 403 Forbidden when CSRF token is invalid or missing.
    """
    logger.warning(f"CSRF validation failed for {request.method} {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "detail": "CSRF token validation failed. Please refresh and try again.",
            "error_code": "CSRF_VALIDATION_FAILED"
        }
    )
'''

handler_pattern = r'app\.add_exception_handler\(RateLimitExceeded, _rate_limit_exceeded_handler\)'

if 'CsrfProtectError' not in content:
    content = content.replace(handler_pattern, handler_pattern + csrf_handler)
    print("✓ Added CSRF exception handler")
else:
    print("- CSRF exception handler already present")

# 4. Add security headers middleware before CORS
security_middleware = '''
# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Add security headers to all responses for defense in depth.
    """
    response = await call_next(request)

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Force HTTPS in production
    if os.getenv("ENVIRONMENT", "development") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' http://localhost:* ws://localhost:*"
    )

    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Permissions policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    return response


'''

# Insert before CORS middleware or request_size_limit_middleware
if '# Security headers middleware' not in content:
    if '# Request size limit middleware' in content:
        content = content.replace('# Request size limit middleware', security_middleware + '# Request size limit middleware')
    else:
        content = content.replace('app.add_middleware(\n    CORSMiddleware,', security_middleware + 'app.add_middleware(\n    CORSMiddleware,')
    print("✓ Added security headers middleware")
else:
    print("- Security headers middleware already present")

# 5. Update CORS to use environment variable for allowed origins and expose CSRF header
cors_pattern = r'app\.add_middleware\(\s*CORSMiddleware,\s*allow_origins=\["http://localhost:3000", "http://localhost:80"\],'
cors_replacement = '''# CORS middleware - restrict origins properly
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:80").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,'''

if 'allowed_origins = os.getenv("ALLOWED_ORIGINS"' not in content:
    content = re.sub(cors_pattern, cors_replacement, content)
    print("✓ Updated CORS configuration")
else:
    print("- CORS configuration already updated")

# Ensure expose_headers includes X-CSRF-Token
if 'expose_headers=["X-CSRF-Token"]' not in content:
    # Add expose_headers after allow_headers
    content = content.replace(
        'allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],',
        'allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],\n    expose_headers=["X-CSRF-Token"],'
    )
    print("✓ Added expose_headers to CORS")
else:
    print("- expose_headers already configured")

# 6. Add CSRF token endpoint
csrf_endpoint = '''

# CSRF token endpoint
@app.get("/api/csrf-token")
async def get_csrf_token(csrf_protect: CsrfProtect = Depends()):
    """
    Get CSRF token for subsequent requests.
    Frontend should call this on app initialization and store the token.
    """
    response = JSONResponse(content={"message": "CSRF token set in cookie"})
    csrf_protect.set_csrf_cookie(response)
    return response
'''

# Insert before @app.get("/")
if '@app.get("/api/csrf-token")' not in content:
    content = content.replace('# Health and info endpoints\n@app.get("/")', '# Health and info endpoints' + csrf_endpoint + '\n\n@app.get("/")')
    print("✓ Added CSRF token endpoint")
else:
    print("- CSRF token endpoint already present")

# 7. Update root endpoint to include CSRF Protection in features
features_pattern = r'"features": \["CRUD operations", "Database integration", "Authentication", "Pagination"\],'
features_replacement = '"features": ["CRUD operations", "Database integration", "Authentication", "Pagination", "CSRF Protection", "Security Headers"],'

if 'CSRF Protection' not in content:
    content = content.replace(features_pattern, features_replacement)
    print("✓ Updated features list")
else:
    print("- Features list already updated")

# 8. Sanitize error messages for production
error_sanitize = '''
        logger.error(f"Rule parsing error: {e}")
        # Sanitize error message for production
        detail = "Failed to parse rule" if os.getenv("ENVIRONMENT") == "production" else f"Failed to parse rule: {str(e)}"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)'''

error_pattern = r'logger\.error\(f"Rule parsing error: \{e\}"\)\s*raise HTTPException\(status_code=status\.HTTP_400_BAD_REQUEST, detail=f"Failed to parse rule: \{str\(e\)\}"\)'

if 'Sanitize error message for production' not in content:
    content = re.sub(error_pattern, error_sanitize, content)
    print("✓ Added error message sanitization")
else:
    print("- Error message sanitization already present")

# Write the updated content
with open('src/main.py', 'w') as f:
    f.write(content)

print("\n✅ Successfully updated main.py with CSRF protection and security headers!")
print("\nNext steps:")
print("1. Run the test: python tests/test_csrf_security.py")
print("2. Verify with curl: curl -I http://localhost:8000/health")
print("3. Commit changes: git add . && git commit -m 'feat: Add CSRF protection and security headers'")
