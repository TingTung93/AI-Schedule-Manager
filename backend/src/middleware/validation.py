"""
Input validation middleware for AI Schedule Manager.
Provides request validation, sanitization, and security checks.
"""

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Any, List, Optional
import json
import re
import html
from urllib.parse import urlparse
import asyncio

from src.core.security import sanitize_input


class ValidationMiddleware(BaseHTTPMiddleware):
    """Middleware for validating and sanitizing incoming requests."""
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Maximum request size (10MB)
        self.max_content_length = 10 * 1024 * 1024
        
        # Allowed content types
        self.allowed_content_types = {
            'application/json',
            'application/x-www-form-urlencoded',
            'multipart/form-data'
        }
        
        # SQL injection patterns
        self.sql_patterns = [
            r'(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE)\b)',
            r'(--|#|\/\*|\*\/)',
            r'(\bOR\b\s*\d+\s*=\s*\d+)',
            r'(\bAND\b\s*\d+\s*=\s*\d+)',
            r'(;\s*(DROP|DELETE|INSERT|UPDATE)\b)',
        ]
        
        # XSS patterns
        self.xss_patterns = [
            r'<script[^>]*>.*?</script>',
            r'javascript:',
            r'on\w+\s*=',
            r'<iframe[^>]*>',
            r'<object[^>]*>',
            r'<embed[^>]*>',
        ]
        
        # Path traversal patterns
        self.path_traversal_patterns = [
            r'\.\./|\.\.\\'
        ]
    
    async def dispatch(self, request: Request, call_next):
        """Validate request before processing."""
        
        # Check content length
        content_length = request.headers.get('content-length')
        if content_length and int(content_length) > self.max_content_length:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request body too large"}
            )
        
        # Validate content type for POST/PUT/PATCH requests
        if request.method in ['POST', 'PUT', 'PATCH']:
            content_type = request.headers.get('content-type', '').split(';')[0]
            if content_type not in self.allowed_content_types:
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content={"detail": f"Unsupported content type: {content_type}"}
                )
        
        # Validate request body if present
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                body = await self._get_body(request)
                if body:
                    validation_result = self._validate_body(body)
                    if not validation_result['valid']:
                        return JSONResponse(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            content={
                                "detail": "Invalid request data",
                                "errors": validation_result['errors']
                            }
                        )
            except Exception as e:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": f"Invalid request body: {str(e)}"}
                )
        
        # Validate URL parameters
        validation_result = self._validate_query_params(request.query_params)
        if not validation_result['valid']:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "detail": "Invalid query parameters",
                    "errors": validation_result['errors']
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response
    
    async def _get_body(self, request: Request) -> Optional[Dict[str, Any]]:
        """Get and parse request body."""
        body = await request.body()
        if not body:
            return None
        
        content_type = request.headers.get('content-type', '').split(';')[0]
        
        if content_type == 'application/json':
            return json.loads(body)
        elif content_type == 'application/x-www-form-urlencoded':
            # Parse form data
            from urllib.parse import parse_qs
            return parse_qs(body.decode())
        else:
            return {'raw': body.decode()}
    
    def _validate_body(self, body: Any) -> Dict[str, Any]:
        """Validate request body for security issues."""
        errors = []
        
        if isinstance(body, dict):
            for key, value in body.items():
                # Validate key
                key_errors = self._validate_string(str(key), f"field '{key}'")
                errors.extend(key_errors)
                
                # Validate value
                if isinstance(value, str):
                    value_errors = self._validate_string(value, f"value for '{key}'")
                    errors.extend(value_errors)
                elif isinstance(value, list):
                    for i, item in enumerate(value):
                        if isinstance(item, str):
                            item_errors = self._validate_string(item, f"item {i} in '{key}'")
                            errors.extend(item_errors)
                elif isinstance(value, dict):
                    # Recursive validation
                    nested_result = self._validate_body(value)
                    errors.extend([f"{key}.{e}" for e in nested_result['errors']])
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def _validate_query_params(self, params: Dict[str, str]) -> Dict[str, Any]:
        """Validate query parameters."""
        errors = []
        
        for key, value in params.items():
            # Validate parameter name
            if not re.match(r'^[a-zA-Z0-9_\-]+$', key):
                errors.append(f"Invalid parameter name: {key}")
            
            # Validate parameter value
            value_errors = self._validate_string(value, f"parameter '{key}'")
            errors.extend(value_errors)
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def _validate_string(self, value: str, context: str) -> List[str]:
        """Validate a string value for security issues."""
        errors = []
        
        # Check for SQL injection
        for pattern in self.sql_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                errors.append(f"Potential SQL injection in {context}")
                break
        
        # Check for XSS
        for pattern in self.xss_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                errors.append(f"Potential XSS attack in {context}")
                break
        
        # Check for path traversal
        for pattern in self.path_traversal_patterns:
            if re.search(pattern, value):
                errors.append(f"Potential path traversal in {context}")
                break
        
        # Check for null bytes
        if '\x00' in value:
            errors.append(f"Null byte detected in {context}")
        
        # Check for excessive length
        if len(value) > 10000:
            errors.append(f"Value too long in {context}")
        
        return errors


class InputSanitizer:
    """Utility class for sanitizing various input types."""
    
    @staticmethod
    def sanitize_html(text: str) -> str:
        """Remove HTML tags and entities from text."""
        # Escape HTML entities
        text = html.escape(text)
        
        # Remove any remaining tags
        text = re.sub(r'<[^>]+>', '', text)
        
        return text
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent directory traversal."""
        # Remove path separators
        filename = filename.replace('/', '').replace('\\', '')
        
        # Remove null bytes
        filename = filename.replace('\x00', '')
        
        # Remove leading dots
        filename = filename.lstrip('.')
        
        # Limit length
        max_length = 255
        if len(filename) > max_length:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:max_length - len(ext) - 1] + '.' + ext if ext else name[:max_length]
        
        # Ensure filename is not empty
        if not filename:
            filename = 'unnamed'
        
        return filename
    
    @staticmethod
    def sanitize_url(url: str) -> Optional[str]:
        """Sanitize and validate URL."""
        try:
            parsed = urlparse(url)
            
            # Only allow http and https
            if parsed.scheme not in ['http', 'https']:
                return None
            
            # Validate hostname
            if not parsed.hostname:
                return None
            
            # Rebuild URL with only safe components
            safe_url = f"{parsed.scheme}://{parsed.hostname}"
            if parsed.port:
                safe_url += f":{parsed.port}"
            if parsed.path:
                safe_url += parsed.path
            if parsed.query:
                safe_url += f"?{parsed.query}"
            
            return safe_url
        except Exception:
            return None
    
    @staticmethod
    def sanitize_email(email: str) -> Optional[str]:
        """Sanitize and validate email address."""
        # Basic email pattern
        email_pattern = re.compile(
            r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        )
        
        email = email.strip().lower()
        
        if email_pattern.match(email):
            return email
        return None
    
    @staticmethod
    def sanitize_phone(phone: str) -> Optional[str]:
        """Sanitize and validate phone number."""
        # Remove all non-digit characters except +
        phone = re.sub(r'[^\d+]', '', phone)
        
        # Validate length (10-15 digits with optional + prefix)
        if re.match(r'^\+?\d{10,15}$', phone):
            return phone
        return None
    
    @staticmethod
    def sanitize_json(data: Any, max_depth: int = 10) -> Any:
        """Recursively sanitize JSON data."""
        if max_depth <= 0:
            return None
        
        if isinstance(data, str):
            return sanitize_input(data)
        elif isinstance(data, dict):
            return {
                InputSanitizer.sanitize_json(k, max_depth - 1): 
                InputSanitizer.sanitize_json(v, max_depth - 1)
                for k, v in data.items()
            }
        elif isinstance(data, list):
            return [
                InputSanitizer.sanitize_json(item, max_depth - 1)
                for item in data
            ]
        else:
            return data