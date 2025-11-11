"""
Structured logging utility for the AI Schedule Manager backend
"""

import json
import logging
import logging.handlers
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import os

from pythonjsonlogger import jsonlogger


class StructuredLogger:
    """Enhanced logger with structured JSON output and context management"""

    def __init__(
        self,
        name: str,
        level: str = "INFO",
        log_file: Optional[str] = None,
        max_bytes: int = 10 * 1024 * 1024,  # 10MB
        backup_count: int = 5,
        include_traceback: bool = True,
    ):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))
        self.include_traceback = include_traceback
        self.context = {}

        # Clear existing handlers
        self.logger.handlers.clear()

        # Setup formatters
        self._setup_formatters()

        # Setup handlers
        self._setup_console_handler()
        if log_file:
            self._setup_file_handler(log_file, max_bytes, backup_count)

    def _setup_formatters(self):
        """Setup JSON and console formatters"""
        # JSON formatter for file output
        self.json_formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s", datefmt="%Y-%m-%dT%H:%M:%S"
        )

        # Console formatter for development
        self.console_formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )

    def _setup_console_handler(self):
        """Setup console handler"""
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(self.console_formatter)
        self.logger.addHandler(console_handler)

    def _setup_file_handler(self, log_file: str, max_bytes: int, backup_count: int):
        """Setup rotating file handler"""
        # Ensure log directory exists
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # Setup rotating file handler
        file_handler = logging.handlers.RotatingFileHandler(log_file, maxBytes=max_bytes, backupCount=backup_count)
        file_handler.setFormatter(self.json_formatter)
        self.logger.addHandler(file_handler)

    def set_context(self, **kwargs):
        """Set persistent context that will be included in all log messages"""
        self.context.update(kwargs)

    def clear_context(self):
        """Clear all context"""
        self.context.clear()

    def _build_extra(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Build extra data for logging"""
        log_extra = {
            "timestamp_iso": datetime.utcnow().isoformat(),
            "environment": os.getenv("ENVIRONMENT", "development"),
            **self.context,
        }

        if extra:
            log_extra.update(extra)

        return log_extra

    def debug(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log debug message"""
        self.logger.debug(message, extra=self._build_extra(extra))

    def info(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log info message"""
        self.logger.info(message, extra=self._build_extra(extra))

    def warning(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log warning message"""
        self.logger.warning(message, extra=self._build_extra(extra))

    def error(self, message: str, extra: Optional[Dict[str, Any]] = None, exc_info: bool = True):
        """Log error message with optional exception info"""
        log_extra = self._build_extra(extra)

        if exc_info and self.include_traceback:
            log_extra["traceback"] = traceback.format_exc()

        self.logger.error(message, extra=log_extra, exc_info=False)

    def critical(self, message: str, extra: Optional[Dict[str, Any]] = None, exc_info: bool = True):
        """Log critical message"""
        log_extra = self._build_extra(extra)

        if exc_info and self.include_traceback:
            log_extra["traceback"] = traceback.format_exc()

        self.logger.critical(message, extra=log_extra, exc_info=False)

    def exception(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log exception with full traceback"""
        self.error(message, extra=extra, exc_info=True)


class PerformanceLogger:
    """Logger specifically for performance metrics"""

    def __init__(self, logger: StructuredLogger):
        self.logger = logger

    def log_request_metrics(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[str] = None,
        request_size: Optional[int] = None,
        response_size: Optional[int] = None,
    ):
        """Log HTTP request metrics"""
        self.logger.info(
            "HTTP request completed",
            extra={
                "metric_type": "http_request",
                "method": method,
                "path": path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "user_id": user_id,
                "request_size_bytes": request_size,
                "response_size_bytes": response_size,
            },
        )

    def log_database_metrics(
        self,
        operation: str,
        table: str,
        duration_ms: float,
        rows_affected: Optional[int] = None,
        query_hash: Optional[str] = None,
    ):
        """Log database operation metrics"""
        self.logger.info(
            "Database operation completed",
            extra={
                "metric_type": "database_operation",
                "operation": operation,
                "table": table,
                "duration_ms": duration_ms,
                "rows_affected": rows_affected,
                "query_hash": query_hash,
            },
        )

    def log_external_service_metrics(
        self, service_name: str, operation: str, duration_ms: float, status_code: Optional[int] = None, success: bool = True
    ):
        """Log external service call metrics"""
        self.logger.info(
            "External service call completed",
            extra={
                "metric_type": "external_service",
                "service_name": service_name,
                "operation": operation,
                "duration_ms": duration_ms,
                "status_code": status_code,
                "success": success,
            },
        )

    def log_business_metrics(self, metric_name: str, value: float, unit: str = "count", tags: Optional[Dict[str, str]] = None):
        """Log business metrics"""
        extra = {"metric_type": "business_metric", "metric_name": metric_name, "value": value, "unit": unit}

        if tags:
            extra["tags"] = tags

        self.logger.info(f"Business metric: {metric_name} = {value} {unit}", extra=extra)


class SecurityLogger:
    """Logger specifically for security events"""

    def __init__(self, logger: StructuredLogger):
        self.logger = logger

    def log_authentication_attempt(
        self, user_email: str, success: bool, ip_address: str, user_agent: str, failure_reason: Optional[str] = None
    ):
        """Log authentication attempts"""
        self.logger.info(
            f"Authentication {'successful' if success else 'failed'}",
            extra={
                "event_type": "authentication",
                "user_email": user_email,
                "success": success,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "failure_reason": failure_reason,
            },
        )

    def log_authorization_failure(self, user_id: str, resource: str, action: str, ip_address: str):
        """Log authorization failures"""
        self.logger.warning(
            "Authorization denied",
            extra={
                "event_type": "authorization_failure",
                "user_id": user_id,
                "resource": resource,
                "action": action,
                "ip_address": ip_address,
            },
        )

    def log_suspicious_activity(
        self,
        activity_type: str,
        description: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        severity: str = "medium",
    ):
        """Log suspicious activities"""
        self.logger.warning(
            f"Suspicious activity detected: {activity_type}",
            extra={
                "event_type": "suspicious_activity",
                "activity_type": activity_type,
                "description": description,
                "user_id": user_id,
                "ip_address": ip_address,
                "severity": severity,
            },
        )

    def log_rate_limit_hit(self, identifier: str, limit: int, window: int, ip_address: str):
        """Log rate limit violations"""
        self.logger.warning(
            "Rate limit exceeded",
            extra={
                "event_type": "rate_limit_hit",
                "identifier": identifier,
                "limit": limit,
                "window_seconds": window,
                "ip_address": ip_address,
            },
        )


# Global logger instances
_loggers: Dict[str, StructuredLogger] = {}


def get_logger(name: str, level: str = None, log_file: str = None) -> StructuredLogger:
    """Get or create a logger instance"""
    if name not in _loggers:
        # Get configuration from environment
        level = level or os.getenv("LOG_LEVEL", "INFO")
        log_file = log_file or os.getenv("LOG_FILE")

        _loggers[name] = StructuredLogger(name=name, level=level, log_file=log_file)

    return _loggers[name]


def get_performance_logger(name: str = "performance") -> PerformanceLogger:
    """Get performance logger instance"""
    logger = get_logger(name)
    return PerformanceLogger(logger)


def get_security_logger(name: str = "security") -> SecurityLogger:
    """Get security logger instance"""
    logger = get_logger(name)
    return SecurityLogger(logger)


# Setup default loggers
application_logger = get_logger("application")
api_logger = get_logger("api")
database_logger = get_logger("database")
performance_logger = get_performance_logger()
security_logger = get_security_logger()


# Logging middleware context manager
class LogContext:
    """Context manager for adding context to all log messages"""

    def __init__(self, logger: StructuredLogger, **context):
        self.logger = logger
        self.context = context
        self.original_context = {}

    def __enter__(self):
        # Save original context
        self.original_context = self.logger.context.copy()
        # Add new context
        self.logger.set_context(**self.context)
        return self.logger

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore original context
        self.logger.context = self.original_context
