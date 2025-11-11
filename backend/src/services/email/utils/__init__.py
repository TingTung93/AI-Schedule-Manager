"""
Email service utilities.
"""

from .cache import TemplateCache
from .formatter import EmailFormatter
from .rate_limiter import RateLimiter
from .unsubscribe import UnsubscribeManager
from .validator import EmailValidator

__all__ = ["EmailValidator", "RateLimiter", "TemplateCache", "EmailFormatter", "UnsubscribeManager"]
