"""
Base email provider interface.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class EmailMessage:
    """Email message data structure."""

    to_email: str
    to_name: Optional[str] = None
    subject: str = ""
    html_content: str = ""
    text_content: str = ""
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    headers: Optional[Dict[str, str]] = None
    template_id: Optional[str] = None
    template_data: Optional[Dict[str, Any]] = None
    tracking_settings: Optional[Dict[str, bool]] = None


@dataclass
class EmailResponse:
    """Email provider response."""

    success: bool
    message_id: Optional[str] = None
    provider_response: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    status_code: Optional[int] = None


class BaseEmailProvider(ABC):
    """Base class for email providers."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize provider with configuration."""
        self.config = config
        self._initialize()

    @abstractmethod
    def _initialize(self) -> None:
        """Initialize provider-specific settings."""
        pass

    @abstractmethod
    async def send_email(self, message: EmailMessage) -> EmailResponse:
        """Send a single email."""
        pass

    @abstractmethod
    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResponse]:
        """Send multiple emails in batch."""
        pass

    @abstractmethod
    async def verify_email(self, email: str) -> bool:
        """Verify if email address is valid."""
        pass

    @abstractmethod
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status for a message."""
        pass

    @abstractmethod
    async def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle webhook events from provider."""
        pass

    @abstractmethod
    async def get_bounce_list(self) -> List[Dict[str, Any]]:
        """Get list of bounced emails."""
        pass

    @abstractmethod
    async def remove_from_bounce_list(self, email: str) -> bool:
        """Remove email from bounce list."""
        pass

    def validate_message(self, message: EmailMessage) -> List[str]:
        """Validate email message."""
        errors = []

        if not message.to_email:
            errors.append("Recipient email is required")

        if not message.subject and not message.template_id:
            errors.append("Subject or template ID is required")

        if not message.html_content and not message.text_content and not message.template_id:
            errors.append("Email content or template ID is required")

        # Basic email validation
        if message.to_email and "@" not in message.to_email:
            errors.append("Invalid recipient email format")

        return errors

    def prepare_headers(self, message: EmailMessage) -> Dict[str, str]:
        """Prepare email headers."""
        headers = {}

        if message.headers:
            headers.update(message.headers)

        # Add tracking headers if enabled
        if message.tracking_settings:
            if message.tracking_settings.get("open_tracking"):
                headers["X-Track-Opens"] = "true"
            if message.tracking_settings.get("click_tracking"):
                headers["X-Track-Clicks"] = "true"

        return headers
