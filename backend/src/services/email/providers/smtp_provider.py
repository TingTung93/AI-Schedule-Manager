"""
SMTP email provider implementation.
"""

import asyncio
import logging
import smtplib
import ssl
from typing import Dict, Any, List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import aiosmtplib

from .base import BaseEmailProvider, EmailMessage, EmailResponse

logger = logging.getLogger(__name__)


class SMTPProvider(BaseEmailProvider):
    """SMTP email provider."""

    def _initialize(self) -> None:
        """Initialize SMTP configuration."""
        required_config = ["host", "port", "username", "password"]
        for key in required_config:
            if not self.config.get(key):
                raise ValueError(f"SMTP {key} is required")

        self.host = self.config["host"]
        self.port = self.config["port"]
        self.username = self.config["username"]
        self.password = self.config["password"]
        self.use_tls = self.config.get("use_tls", True)
        self.use_ssl = self.config.get("use_ssl", False)
        self.timeout = self.config.get("timeout", 60)

    async def send_email(self, message: EmailMessage) -> EmailResponse:
        """Send a single email via SMTP."""
        try:
            # Validate message
            validation_errors = self.validate_message(message)
            if validation_errors:
                return EmailResponse(success=False, error_message=f"Validation errors: {', '.join(validation_errors)}")

            # Create email message
            email_message = self._create_email_message(message)

            # Send email
            await self._send_via_aiosmtplib(email_message, message)

            # Generate message ID (SMTP doesn't return one)
            import uuid

            message_id = str(uuid.uuid4())

            return EmailResponse(success=True, message_id=message_id, provider_response={"status": "sent"}, status_code=250)

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication error: {e}")
            return EmailResponse(success=False, error_message=f"SMTP authentication failed: {str(e)}", status_code=535)

        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"SMTP recipients refused: {e}")
            return EmailResponse(success=False, error_message=f"Recipients refused: {str(e)}", status_code=550)

        except smtplib.SMTPDataError as e:
            logger.error(f"SMTP data error: {e}")
            return EmailResponse(success=False, error_message=f"SMTP data error: {str(e)}", status_code=e.smtp_code)

        except Exception as e:
            logger.error(f"SMTP send error: {e}")
            return EmailResponse(success=False, error_message=f"SMTP error: {str(e)}")

    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResponse]:
        """Send multiple emails in batch."""
        # Use connection pooling for batch sending
        semaphore = asyncio.Semaphore(5)  # Limit concurrent connections

        async def send_with_semaphore(message):
            async with semaphore:
                return await self.send_email(message)

        tasks = [send_with_semaphore(message) for message in messages]
        return await asyncio.gather(*tasks)

    def _create_email_message(self, message: EmailMessage) -> MIMEMultipart:
        """Create email message object."""
        # Create message container
        if message.html_content and message.text_content:
            email_message = MIMEMultipart("alternative")
        else:
            email_message = MIMEMultipart()

        # Set headers
        email_message["From"] = self._format_address(
            message.from_email or self.config.get("default_from_email"),
            message.from_name or self.config.get("default_from_name"),
        )
        email_message["To"] = self._format_address(message.to_email, message.to_name)
        email_message["Subject"] = message.subject

        # Add CC/BCC
        if message.cc:
            email_message["Cc"] = ", ".join(message.cc)
        if message.bcc:
            email_message["Bcc"] = ", ".join(message.bcc)

        # Add reply-to
        if message.reply_to:
            email_message["Reply-To"] = message.reply_to

        # Add custom headers
        headers = self.prepare_headers(message)
        for key, value in headers.items():
            email_message[key] = value

        # Add content
        if message.text_content:
            text_part = MIMEText(message.text_content, "plain", "utf-8")
            email_message.attach(text_part)

        if message.html_content:
            html_part = MIMEText(message.html_content, "html", "utf-8")
            email_message.attach(html_part)

        # Add attachments
        if message.attachments:
            for attachment_data in message.attachments:
                self._add_attachment(email_message, attachment_data)

        return email_message

    def _format_address(self, email: str, name: Optional[str] = None) -> str:
        """Format email address with optional name."""
        if name:
            return f'"{name}" <{email}>'
        return email

    def _add_attachment(self, email_message: MIMEMultipart, attachment_data: Dict[str, Any]) -> None:
        """Add attachment to email message."""
        try:
            part = MIMEBase("application", "octet-stream")
            content = attachment_data.get("content", "")

            # Handle base64 encoded content
            if isinstance(content, str):
                import base64

                content = base64.b64decode(content)

            part.set_payload(content)
            encoders.encode_base64(part)

            filename = attachment_data.get("filename", "attachment")
            part.add_header("Content-Disposition", f"attachment; filename= {filename}")

            email_message.attach(part)

        except Exception as e:
            logger.error(f"Failed to add attachment: {e}")

    async def _send_via_aiosmtplib(self, email_message: MIMEMultipart, message: EmailMessage) -> None:
        """Send email using aiosmtplib."""
        # Prepare recipient list
        recipients = [message.to_email]
        if message.cc:
            recipients.extend(message.cc)
        if message.bcc:
            recipients.extend(message.bcc)

        # Configure SMTP
        smtp_kwargs = {
            "hostname": self.host,
            "port": self.port,
            "username": self.username,
            "password": self.password,
            "timeout": self.timeout,
        }

        if self.use_ssl:
            smtp_kwargs["use_tls"] = False
            smtp_kwargs["start_tls"] = False
        elif self.use_tls:
            smtp_kwargs["use_tls"] = True
            smtp_kwargs["start_tls"] = True

        # Send email
        await aiosmtplib.send(email_message, recipients=recipients, **smtp_kwargs)

    async def verify_email(self, email: str) -> bool:
        """Verify email address using SMTP VRFY command."""
        try:
            # Create SSL context
            context = ssl.create_default_context()

            # Connect to SMTP server
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port, context=context, timeout=self.timeout)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=self.timeout)
                if self.use_tls:
                    server.starttls(context=context)

            # Login
            server.login(self.username, self.password)

            # Verify email
            code, message = server.verify(email)
            server.quit()

            # SMTP response codes for valid emails are typically 250 or 252
            return code in [250, 252]

        except Exception as e:
            logger.error(f"Email verification error: {e}")
            return False

    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status for a message."""
        # SMTP doesn't provide delivery status tracking
        logger.warning("SMTP doesn't support delivery status tracking")
        return {}

    async def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle webhook events."""
        # SMTP doesn't support webhooks
        logger.warning("SMTP doesn't support webhook events")
        return {"events": []}

    async def get_bounce_list(self) -> List[Dict[str, Any]]:
        """Get list of bounced emails."""
        # SMTP doesn't maintain bounce lists
        logger.warning("SMTP doesn't maintain bounce lists")
        return []

    async def remove_from_bounce_list(self, email: str) -> bool:
        """Remove email from bounce list."""
        # SMTP doesn't maintain bounce lists
        logger.warning("SMTP doesn't maintain bounce lists")
        return True

    async def test_connection(self) -> bool:
        """Test SMTP connection."""
        try:
            # Create SSL context
            context = ssl.create_default_context()

            # Connect to SMTP server
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port, context=context, timeout=self.timeout)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=self.timeout)
                if self.use_tls:
                    server.starttls(context=context)

            # Login
            server.login(self.username, self.password)
            server.quit()

            return True

        except Exception as e:
            logger.error(f"SMTP connection test failed: {e}")
            return False
