"""
Global error handling middleware for FastAPI
"""

import logging
import traceback
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from ..exceptions.custom_exceptions import (
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ResourceNotFoundError,
    BusinessLogicError,
    ExternalServiceError,
    RateLimitError,
)
from ..utils.logger import get_logger

logger = get_logger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware"""

    async def dispatch(self, request: Request, call_next):
        error_id = str(uuid.uuid4())

        try:
            response = await call_next(request)
            return response

        except Exception as exc:
            return await self.handle_exception(request, exc, error_id)

    async def handle_exception(self, request: Request, exc: Exception, error_id: str) -> JSONResponse:
        """Handle different types of exceptions"""

        # Get client info for logging
        client_host = getattr(request.client, "host", "unknown")
        user_agent = request.headers.get("user-agent", "unknown")

        # Create error context
        error_context = {
            "error_id": error_id,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
            "method": request.method,
            "client_host": client_host,
            "user_agent": user_agent,
            "query_params": dict(request.query_params),
        }

        # Handle different exception types
        if isinstance(exc, ValidationError):
            return await self._handle_validation_error(exc, error_context)
        elif isinstance(exc, AuthenticationError):
            return await self._handle_auth_error(exc, error_context)
        elif isinstance(exc, AuthorizationError):
            return await self._handle_authorization_error(exc, error_context)
        elif isinstance(exc, ResourceNotFoundError):
            return await self._handle_not_found_error(exc, error_context)
        elif isinstance(exc, BusinessLogicError):
            return await self._handle_business_logic_error(exc, error_context)
        elif isinstance(exc, ExternalServiceError):
            return await self._handle_external_service_error(exc, error_context)
        elif isinstance(exc, RateLimitError):
            return await self._handle_rate_limit_error(exc, error_context)
        elif isinstance(exc, HTTPException):
            return await self._handle_http_exception(exc, error_context)
        else:
            return await self._handle_unexpected_error(exc, error_context)

    async def _handle_validation_error(self, exc: ValidationError, context: Dict[str, Any]) -> JSONResponse:
        """Handle validation errors"""
        logger.warning(
            "Validation error",
            extra={"error_type": "validation_error", "error_message": str(exc), "validation_errors": exc.details, **context},
        )

        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "type": "validation_error",
                    "message": "Invalid input data",
                    "details": exc.details,
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
        )

    async def _handle_auth_error(self, exc: AuthenticationError, context: Dict[str, Any]) -> JSONResponse:
        """Handle authentication errors"""
        logger.warning(
            "Authentication error", extra={"error_type": "authentication_error", "error_message": str(exc), **context}
        )

        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "type": "authentication_error",
                    "message": "Authentication failed",
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
        )

    async def _handle_authorization_error(self, exc: AuthorizationError, context: Dict[str, Any]) -> JSONResponse:
        """Handle authorization errors"""
        logger.warning(
            "Authorization error", extra={"error_type": "authorization_error", "error_message": str(exc), **context}
        )

        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "type": "authorization_error",
                    "message": "Access denied",
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
        )

    async def _handle_not_found_error(self, exc: ResourceNotFoundError, context: Dict[str, Any]) -> JSONResponse:
        """Handle resource not found errors"""
        logger.info(
            "Resource not found",
            extra={
                "error_type": "not_found_error",
                "error_message": str(exc),
                "resource_type": exc.resource_type,
                "resource_id": exc.resource_id,
                **context,
            },
        )

        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "type": "not_found_error",
                    "message": f"{exc.resource_type} not found",
                    "resource_type": exc.resource_type,
                    "resource_id": exc.resource_id,
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
        )

    async def _handle_business_logic_error(self, exc: BusinessLogicError, context: Dict[str, Any]) -> JSONResponse:
        """Handle business logic errors"""
        logger.warning(
            "Business logic error",
            extra={"error_type": "business_logic_error", "error_message": str(exc), "error_code": exc.error_code, **context},
        )

        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "type": "business_logic_error",
                    "message": str(exc),
                    "error_code": exc.error_code,
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
        )

    async def _handle_external_service_error(self, exc: ExternalServiceError, context: Dict[str, Any]) -> JSONResponse:
        """Handle external service errors"""
        logger.error(
            "External service error",
            extra={
                "error_type": "external_service_error",
                "error_message": str(exc),
                "service_name": exc.service_name,
                "operation": exc.operation,
                **context,
            },
        )

        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "type": "external_service_error",
                    "message": "External service temporarily unavailable",
                    "service_name": exc.service_name,
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
        )

    async def _handle_rate_limit_error(self, exc: RateLimitError, context: Dict[str, Any]) -> JSONResponse:
        """Handle rate limit errors"""
        logger.warning(
            "Rate limit exceeded",
            extra={
                "error_type": "rate_limit_error",
                "error_message": str(exc),
                "limit": exc.limit,
                "window": exc.window,
                **context,
            },
        )

        headers = {}
        if exc.retry_after:
            headers["Retry-After"] = str(exc.retry_after)

        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "type": "rate_limit_error",
                    "message": "Rate limit exceeded",
                    "limit": exc.limit,
                    "window": exc.window,
                    "retry_after": exc.retry_after,
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
            headers=headers,
        )

    async def _handle_http_exception(self, exc: HTTPException, context: Dict[str, Any]) -> JSONResponse:
        """Handle HTTP exceptions"""
        logger.warning(
            "HTTP exception",
            extra={
                "error_type": "http_exception",
                "status_code": exc.status_code,
                "error_message": str(exc.detail),
                **context,
            },
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "type": "http_error",
                    "message": str(exc.detail),
                    "status_code": exc.status_code,
                    "error_id": context["error_id"],
                    "timestamp": context["timestamp"],
                }
            },
        )

    async def _handle_unexpected_error(self, exc: Exception, context: Dict[str, Any]) -> JSONResponse:
        """Handle unexpected errors"""

        # Log full traceback for unexpected errors
        logger.error(
            "Unexpected error",
            extra={
                "error_type": "unexpected_error",
                "error_message": str(exc),
                "exception_type": exc.__class__.__name__,
                "traceback": traceback.format_exc(),
                **context,
            },
        )

        # Don't expose internal error details in production
        message = str(exc) if context.get("environment") == "development" else "An unexpected error occurred"

        response_content = {
            "error": {
                "type": "internal_server_error",
                "message": message,
                "error_id": context["error_id"],
                "timestamp": context["timestamp"],
            }
        }

        # Include traceback in development
        if context.get("environment") == "development":
            response_content["error"]["traceback"] = traceback.format_exc()

        return JSONResponse(status_code=500, content=response_content)


# Custom exception handlers for specific cases
async def validation_exception_handler(request: Request, exc: Exception):
    """Handle validation exceptions from Pydantic"""
    error_id = str(uuid.uuid4())

    logger.warning(
        "Validation exception",
        extra={
            "error_id": error_id,
            "error_type": "validation_exception",
            "error_message": str(exc),
            "path": request.url.path,
        },
    )

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "type": "validation_error",
                "message": "Invalid request data",
                "details": str(exc),
                "error_id": error_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        },
    )


async def not_found_exception_handler(request: Request, exc: HTTPException):
    """Handle 404 errors"""
    error_id = str(uuid.uuid4())

    logger.info(
        "Not found",
        extra={
            "error_id": error_id,
            "path": request.url.path,
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "type": "not_found",
                "message": f"Endpoint not found: {request.method} {request.url.path}",
                "error_id": error_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        },
    )
