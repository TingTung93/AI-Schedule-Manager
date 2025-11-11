"""
Email service utilities.
"""

from .validator import EmailValidator
from .rate_limiter import RateLimiter
from .cache import TemplateCache
from .formatter import EmailFormatter
from .unsubscribe import UnsubscribeManager

__all__ = ["EmailValidator", "RateLimiter", "TemplateCache", "EmailFormatter", "UnsubscribeManager"]
