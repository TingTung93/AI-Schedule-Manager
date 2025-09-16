"""
Custom exception classes for structured error handling
"""
from typing import Any, Dict, List, Optional


class BaseCustomException(Exception):
    """Base class for all custom exceptions"""

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(BaseCustomException):
    """Raised when input validation fails"""

    def __init__(
        self,
        message: str = "Validation failed",
        field_errors: Optional[Dict[str, List[str]]] = None,
        error_code: str = "VALIDATION_ERROR"
    ):
        self.field_errors = field_errors or {}
        details = {"field_errors": self.field_errors}
        super().__init__(message, error_code, details)

    @property
    def details(self) -> Dict[str, Any]:
        return self._details

    @details.setter
    def details(self, value: Dict[str, Any]):
        self._details = value


class AuthenticationError(BaseCustomException):
    """Raised when authentication fails"""

    def __init__(
        self,
        message: str = "Authentication failed",
        error_code: str = "AUTHENTICATION_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class AuthorizationError(BaseCustomException):
    """Raised when authorization fails"""

    def __init__(
        self,
        message: str = "Access denied",
        error_code: str = "AUTHORIZATION_ERROR",
        required_permissions: Optional[List[str]] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.required_permissions = required_permissions or []
        if details is None:
            details = {}
        if self.required_permissions:
            details["required_permissions"] = self.required_permissions
        super().__init__(message, error_code, details)


class ResourceNotFoundError(BaseCustomException):
    """Raised when a requested resource is not found"""

    def __init__(
        self,
        resource_type: str,
        resource_id: Any,
        message: Optional[str] = None,
        error_code: str = "RESOURCE_NOT_FOUND"
    ):
        self.resource_type = resource_type
        self.resource_id = resource_id
        if message is None:
            message = f"{resource_type} with id '{resource_id}' not found"
        details = {
            "resource_type": resource_type,
            "resource_id": str(resource_id)
        }
        super().__init__(message, error_code, details)


class BusinessLogicError(BaseCustomException):
    """Raised when business logic constraints are violated"""

    def __init__(
        self,
        message: str,
        error_code: str = "BUSINESS_LOGIC_ERROR",
        constraint_type: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.constraint_type = constraint_type
        if details is None:
            details = {}
        if constraint_type:
            details["constraint_type"] = constraint_type
        super().__init__(message, error_code, details)


class ExternalServiceError(BaseCustomException):
    """Raised when external service calls fail"""

    def __init__(
        self,
        service_name: str,
        operation: str,
        message: Optional[str] = None,
        error_code: str = "EXTERNAL_SERVICE_ERROR",
        status_code: Optional[int] = None,
        response_data: Optional[Dict[str, Any]] = None
    ):
        self.service_name = service_name
        self.operation = operation
        self.status_code = status_code
        self.response_data = response_data or {}

        if message is None:
            message = f"Failed to {operation} with {service_name}"

        details = {
            "service_name": service_name,
            "operation": operation,
            "status_code": status_code,
            "response_data": self.response_data
        }
        super().__init__(message, error_code, details)


class RateLimitError(BaseCustomException):
    """Raised when rate limits are exceeded"""

    def __init__(
        self,
        limit: int,
        window: int,
        retry_after: Optional[int] = None,
        message: Optional[str] = None,
        error_code: str = "RATE_LIMIT_EXCEEDED"
    ):
        self.limit = limit
        self.window = window
        self.retry_after = retry_after

        if message is None:
            message = f"Rate limit exceeded: {limit} requests per {window} seconds"

        details = {
            "limit": limit,
            "window": window,
            "retry_after": retry_after
        }
        super().__init__(message, error_code, details)


class DatabaseError(BaseCustomException):
    """Raised when database operations fail"""

    def __init__(
        self,
        operation: str,
        table: Optional[str] = None,
        message: Optional[str] = None,
        error_code: str = "DATABASE_ERROR",
        original_error: Optional[Exception] = None
    ):
        self.operation = operation
        self.table = table
        self.original_error = original_error

        if message is None:
            table_part = f" on table '{table}'" if table else ""
            message = f"Database {operation} failed{table_part}"

        details = {
            "operation": operation,
            "table": table,
            "original_error": str(original_error) if original_error else None
        }
        super().__init__(message, error_code, details)


class ConfigurationError(BaseCustomException):
    """Raised when configuration is invalid or missing"""

    def __init__(
        self,
        config_key: str,
        message: Optional[str] = None,
        error_code: str = "CONFIGURATION_ERROR",
        expected_type: Optional[str] = None
    ):
        self.config_key = config_key
        self.expected_type = expected_type

        if message is None:
            type_part = f" (expected {expected_type})" if expected_type else ""
            message = f"Invalid or missing configuration for '{config_key}'{type_part}"

        details = {
            "config_key": config_key,
            "expected_type": expected_type
        }
        super().__init__(message, error_code, details)


class ConcurrencyError(BaseCustomException):
    """Raised when concurrency conflicts occur"""

    def __init__(
        self,
        resource_type: str,
        resource_id: Any,
        message: Optional[str] = None,
        error_code: str = "CONCURRENCY_ERROR",
        conflict_type: str = "version_mismatch"
    ):
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.conflict_type = conflict_type

        if message is None:
            message = f"Concurrency conflict on {resource_type} '{resource_id}'"

        details = {
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "conflict_type": conflict_type
        }
        super().__init__(message, error_code, details)


class ScheduleConflictError(BusinessLogicError):
    """Raised when schedule conflicts occur"""

    def __init__(
        self,
        conflicting_events: List[Dict[str, Any]],
        message: Optional[str] = None,
        error_code: str = "SCHEDULE_CONFLICT"
    ):
        self.conflicting_events = conflicting_events

        if message is None:
            message = f"Schedule conflict detected with {len(conflicting_events)} events"

        details = {
            "conflicting_events": conflicting_events,
            "conflict_count": len(conflicting_events)
        }
        super().__init__(message, error_code, "schedule_conflict", details)


class AIServiceError(ExternalServiceError):
    """Raised when AI service calls fail"""

    def __init__(
        self,
        operation: str,
        provider: str = "openai",
        model: Optional[str] = None,
        message: Optional[str] = None,
        error_code: str = "AI_SERVICE_ERROR",
        **kwargs
    ):
        self.provider = provider
        self.model = model

        if message is None:
            model_part = f" (model: {model})" if model else ""
            message = f"AI service {operation} failed with {provider}{model_part}"

        super().__init__(
            service_name=f"ai_{provider}",
            operation=operation,
            message=message,
            error_code=error_code,
            **kwargs
        )
        self.details.update({
            "provider": provider,
            "model": model
        })


class QuotaExceededError(BaseCustomException):
    """Raised when usage quotas are exceeded"""

    def __init__(
        self,
        quota_type: str,
        limit: int,
        current_usage: int,
        message: Optional[str] = None,
        error_code: str = "QUOTA_EXCEEDED"
    ):
        self.quota_type = quota_type
        self.limit = limit
        self.current_usage = current_usage

        if message is None:
            message = f"{quota_type} quota exceeded: {current_usage}/{limit}"

        details = {
            "quota_type": quota_type,
            "limit": limit,
            "current_usage": current_usage
        }
        super().__init__(message, error_code, details)


# Exception mapping for common HTTP status codes
EXCEPTION_STATUS_MAPPING = {
    ValidationError: 400,
    AuthenticationError: 401,
    AuthorizationError: 403,
    ResourceNotFoundError: 404,
    BusinessLogicError: 422,
    ConcurrencyError: 409,
    RateLimitError: 429,
    QuotaExceededError: 429,
    ExternalServiceError: 503,
    DatabaseError: 500,
    ConfigurationError: 500,
    ScheduleConflictError: 422,
    AIServiceError: 503,
}