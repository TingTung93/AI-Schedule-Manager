"""
SendGrid email provider implementation.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import aiohttp
from python_http_client.exceptions import HTTPError
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Attachment, Content, Email, Header, Mail, To

from .base import BaseEmailProvider, EmailMessage, EmailResponse

logger = logging.getLogger(__name__)


class SendGridProvider(BaseEmailProvider):
    """SendGrid email provider."""

    def _initialize(self) -> None:
        """Initialize SendGrid client."""
        api_key = self.config.get("api_key")
        if not api_key:
            raise ValueError("SendGrid API key is required")

        self.client = SendGridAPIClient(api_key=api_key)
        self.api_key = api_key

    async def send_email(self, message: EmailMessage) -> EmailResponse:
        """Send a single email via SendGrid."""
        try:
            # Validate message
            validation_errors = self.validate_message(message)
            if validation_errors:
                return EmailResponse(success=False, error_message=f"Validation errors: {', '.join(validation_errors)}")

            # Create SendGrid mail object
            mail = self._create_mail_object(message)

            # Send email
            response = await asyncio.get_event_loop().run_in_executor(None, self.client.send, mail)

            # Parse response
            if response.status_code in [200, 202]:
                return EmailResponse(
                    success=True,
                    message_id=response.headers.get("X-Message-Id"),
                    provider_response={"status_code": response.status_code, "headers": dict(response.headers)},
                    status_code=response.status_code,
                )
            else:
                return EmailResponse(
                    success=False,
                    error_message=f"SendGrid returned status {response.status_code}",
                    provider_response={"status_code": response.status_code, "body": response.body},
                    status_code=response.status_code,
                )

        except HTTPError as e:
            logger.error(f"SendGrid HTTP error: {e}")
            return EmailResponse(
                success=False,
                error_message=f"SendGrid HTTP error: {str(e)}",
                provider_response=getattr(e, "body", None),
                status_code=getattr(e, "status_code", None),
            )
        except Exception as e:
            logger.error(f"SendGrid send error: {e}")
            return EmailResponse(success=False, error_message=f"SendGrid error: {str(e)}")

    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResponse]:
        """Send multiple emails in batch."""
        tasks = [self.send_email(message) for message in messages]
        return await asyncio.gather(*tasks)

    def _create_mail_object(self, message: EmailMessage) -> Mail:
        """Create SendGrid Mail object from EmailMessage."""
        # From email
        from_email = Email(
            email=message.from_email or self.config.get("default_from_email"),
            name=message.from_name or self.config.get("default_from_name"),
        )

        # To email
        to_email = To(email=message.to_email, name=message.to_name)

        # Subject
        subject = message.subject

        # Create mail object
        mail = Mail(from_email=from_email, to_emails=to_email, subject=subject)

        # Add content
        if message.text_content:
            mail.add_content(Content("text/plain", message.text_content))
        if message.html_content:
            mail.add_content(Content("text/html", message.html_content))

        # Add CC/BCC
        if message.cc:
            for cc_email in message.cc:
                mail.add_cc(Email(cc_email))

        if message.bcc:
            for bcc_email in message.bcc:
                mail.add_bcc(Email(bcc_email))

        # Add reply-to
        if message.reply_to:
            mail.reply_to = Email(message.reply_to)

        # Add attachments
        if message.attachments:
            for attachment_data in message.attachments:
                attachment = Attachment()
                attachment.file_content = attachment_data.get("content")
                attachment.file_name = attachment_data.get("filename")
                attachment.file_type = attachment_data.get("type")
                attachment.disposition = attachment_data.get("disposition", "attachment")
                mail.add_attachment(attachment)

        # Add headers
        headers = self.prepare_headers(message)
        for key, value in headers.items():
            mail.add_header(Header(key, value))

        # Add tracking settings
        if message.tracking_settings:
            tracking_settings = mail.tracking_settings

            if "open_tracking" in message.tracking_settings:
                tracking_settings.open_tracking.enable = message.tracking_settings["open_tracking"]

            if "click_tracking" in message.tracking_settings:
                tracking_settings.click_tracking.enable = message.tracking_settings["click_tracking"]
                tracking_settings.click_tracking.enable_text = message.tracking_settings.get("click_tracking_text", False)

        return mail

    async def verify_email(self, email: str) -> bool:
        """Verify email address using SendGrid validation API."""
        try:
            url = f"https://api.sendgrid.com/v3/validations/email"
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            data = {"email": email}

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result.get("result", {}).get("verdict") == "Valid"
                    return False

        except Exception as e:
            logger.error(f"Email verification error: {e}")
            return False

    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status for a message."""
        try:
            url = f"https://api.sendgrid.com/v3/messages/{message_id}"
            headers = {"Authorization": f"Bearer {self.api_key}"}

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
                    return {}

        except Exception as e:
            logger.error(f"Status check error: {e}")
            return {}

    async def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle SendGrid webhook events."""
        events = []

        if isinstance(payload, list):
            for event in payload:
                processed_event = self._process_webhook_event(event)
                if processed_event:
                    events.append(processed_event)
        else:
            processed_event = self._process_webhook_event(payload)
            if processed_event:
                events.append(processed_event)

        return {"events": events}

    def _process_webhook_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process individual webhook event."""
        event_type = event.get("event")
        if not event_type:
            return None

        return {
            "message_id": event.get("sg_message_id"),
            "email": event.get("email"),
            "event_type": event_type,
            "timestamp": event.get("timestamp"),
            "reason": event.get("reason"),
            "status": event.get("status"),
            "response": event.get("response"),
            "attempt": event.get("attempt"),
            "url": event.get("url"),  # For click events
            "user_agent": event.get("useragent"),
            "ip": event.get("ip"),
        }

    async def get_bounce_list(self) -> List[Dict[str, Any]]:
        """Get list of bounced emails."""
        try:
            url = "https://api.sendgrid.com/v3/suppression/bounces"
            headers = {"Authorization": f"Bearer {self.api_key}"}

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
                    return []

        except Exception as e:
            logger.error(f"Bounce list error: {e}")
            return []

    async def remove_from_bounce_list(self, email: str) -> bool:
        """Remove email from bounce list."""
        try:
            url = f"https://api.sendgrid.com/v3/suppression/bounces/{email}"
            headers = {"Authorization": f"Bearer {self.api_key}"}

            async with aiohttp.ClientSession() as session:
                async with session.delete(url, headers=headers) as response:
                    return response.status == 204

        except Exception as e:
            logger.error(f"Bounce removal error: {e}")
            return False
