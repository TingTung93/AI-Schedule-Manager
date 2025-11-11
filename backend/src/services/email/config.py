"""
Email service configuration module.
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class EmailProvider(Enum):
    """Available email providers."""

    SENDGRID = "sendgrid"
    AWS_SES = "aws_ses"
    SMTP = "smtp"


@dataclass
class EmailConfig:
    """Email service configuration."""

    # Provider settings
    provider: EmailProvider = EmailProvider.SENDGRID

    # SendGrid configuration
    sendgrid_api_key: Optional[str] = None

    # AWS SES configuration
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"

    # SMTP configuration
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: bool = True

    # General settings
    default_from_email: str = "noreply@aischedulemanager.com"
    default_from_name: str = "AI Schedule Manager"
    reply_to_email: Optional[str] = None

    # Queue settings
    use_celery: bool = True
    redis_url: str = "redis://localhost:6379/0"

    # Retry settings
    max_retries: int = 3
    retry_delay: int = 60  # seconds
    exponential_backoff: bool = True

    # Rate limiting
    rate_limit_per_hour: int = 1000
    rate_limit_per_minute: int = 100

    # Tracking
    enable_tracking: bool = True
    track_opens: bool = True
    track_clicks: bool = True
    track_unsubscribes: bool = True

    # Template settings
    template_cache_ttl: int = 3600  # seconds
    template_directory: str = "templates"

    # Security
    enable_dkim: bool = True
    enable_spf: bool = True
    enable_dmarc: bool = True

    # Testing
    test_mode: bool = False
    test_email_recipient: Optional[str] = None

    @classmethod
    def from_env(cls) -> "EmailConfig":
        """Create configuration from environment variables."""
        provider_str = os.getenv("EMAIL_PROVIDER", "sendgrid").lower()
        try:
            provider = EmailProvider(provider_str)
        except ValueError:
            provider = EmailProvider.SENDGRID

        return cls(
            provider=provider,
            sendgrid_api_key=os.getenv("SENDGRID_API_KEY"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            smtp_host=os.getenv("SMTP_HOST"),
            smtp_port=int(os.getenv("SMTP_PORT", "587")),
            smtp_username=os.getenv("SMTP_USERNAME"),
            smtp_password=os.getenv("SMTP_PASSWORD"),
            smtp_use_tls=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
            default_from_email=os.getenv("DEFAULT_FROM_EMAIL", "noreply@aischedulemanager.com"),
            default_from_name=os.getenv("DEFAULT_FROM_NAME", "AI Schedule Manager"),
            reply_to_email=os.getenv("REPLY_TO_EMAIL"),
            use_celery=os.getenv("USE_CELERY", "true").lower() == "true",
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            max_retries=int(os.getenv("EMAIL_MAX_RETRIES", "3")),
            retry_delay=int(os.getenv("EMAIL_RETRY_DELAY", "60")),
            enable_tracking=os.getenv("EMAIL_ENABLE_TRACKING", "true").lower() == "true",
            track_opens=os.getenv("EMAIL_TRACK_OPENS", "true").lower() == "true",
            track_clicks=os.getenv("EMAIL_TRACK_CLICKS", "true").lower() == "true",
            test_mode=os.getenv("EMAIL_TEST_MODE", "false").lower() == "true",
            test_email_recipient=os.getenv("EMAIL_TEST_RECIPIENT"),
        )

    def validate(self) -> None:
        """Validate configuration."""
        if self.provider == EmailProvider.SENDGRID:
            if not self.sendgrid_api_key:
                raise ValueError("SendGrid API key is required")

        elif self.provider == EmailProvider.AWS_SES:
            if not self.aws_access_key_id or not self.aws_secret_access_key:
                raise ValueError("AWS credentials are required")

        elif self.provider == EmailProvider.SMTP:
            if not all([self.smtp_host, self.smtp_username, self.smtp_password]):
                raise ValueError("SMTP configuration is incomplete")

        if not self.default_from_email:
            raise ValueError("Default from email is required")


# Global configuration instance
email_config = EmailConfig.from_env()
