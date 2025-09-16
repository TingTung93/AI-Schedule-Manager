"""
AWS SES email provider implementation.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
import boto3
from botocore.exceptions import ClientError, BotoCoreError

from .base import BaseEmailProvider, EmailMessage, EmailResponse

logger = logging.getLogger(__name__)


class AWSProvider(BaseEmailProvider):
    """AWS SES email provider."""

    def _initialize(self) -> None:
        """Initialize AWS SES client."""
        try:
            self.client = boto3.client(
                'ses',
                aws_access_key_id=self.config.get('aws_access_key_id'),
                aws_secret_access_key=self.config.get('aws_secret_access_key'),
                region_name=self.config.get('aws_region', 'us-east-1')
            )
        except Exception as e:
            raise ValueError(f"Failed to initialize AWS SES client: {e}")

    async def send_email(self, message: EmailMessage) -> EmailResponse:
        """Send a single email via AWS SES."""
        try:
            # Validate message
            validation_errors = self.validate_message(message)
            if validation_errors:
                return EmailResponse(
                    success=False,
                    error_message=f"Validation errors: {', '.join(validation_errors)}"
                )

            # Prepare email data
            destinations = [message.to_email]
            if message.cc:
                destinations.extend(message.cc)
            if message.bcc:
                destinations.extend(message.bcc)

            email_data = {
                'Source': message.from_email or self.config.get('default_from_email'),
                'Destination': {
                    'ToAddresses': [message.to_email],
                },
                'Message': {
                    'Subject': {
                        'Data': message.subject,
                        'Charset': 'UTF-8'
                    },
                    'Body': {}
                }
            }

            # Add CC/BCC if present
            if message.cc:
                email_data['Destination']['CcAddresses'] = message.cc
            if message.bcc:
                email_data['Destination']['BccAddresses'] = message.bcc

            # Add content
            if message.text_content:
                email_data['Message']['Body']['Text'] = {
                    'Data': message.text_content,
                    'Charset': 'UTF-8'
                }

            if message.html_content:
                email_data['Message']['Body']['Html'] = {
                    'Data': message.html_content,
                    'Charset': 'UTF-8'
                }

            # Add reply-to
            if message.reply_to:
                email_data['ReplyToAddresses'] = [message.reply_to]

            # Add headers
            headers = self.prepare_headers(message)
            if headers:
                email_data['Tags'] = [
                    {'Name': key, 'Value': value}
                    for key, value in headers.items()
                ]

            # Send email
            response = await asyncio.get_event_loop().run_in_executor(
                None, self.client.send_email, **email_data
            )

            return EmailResponse(
                success=True,
                message_id=response['MessageId'],
                provider_response=response,
                status_code=200
            )

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.error(f"AWS SES ClientError ({error_code}): {error_message}")

            return EmailResponse(
                success=False,
                error_message=f"AWS SES error ({error_code}): {error_message}",
                provider_response=e.response,
                status_code=e.response.get('ResponseMetadata', {}).get('HTTPStatusCode')
            )

        except Exception as e:
            logger.error(f"AWS SES send error: {e}")
            return EmailResponse(
                success=False,
                error_message=f"AWS SES error: {str(e)}"
            )

    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResponse]:
        """Send multiple emails in batch."""
        # AWS SES doesn't have a true batch API, so we send individually
        # but with concurrency control
        semaphore = asyncio.Semaphore(10)  # Limit concurrent requests

        async def send_with_semaphore(message):
            async with semaphore:
                return await self.send_email(message)

        tasks = [send_with_semaphore(message) for message in messages]
        return await asyncio.gather(*tasks)

    async def verify_email(self, email: str) -> bool:
        """Verify email address using AWS SES."""
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None, self.client.get_identity_verification_attributes,
                {'Identities': [email]}
            )

            attributes = response.get('VerificationAttributes', {})
            email_attributes = attributes.get(email, {})
            return email_attributes.get('VerificationStatus') == 'Success'

        except Exception as e:
            logger.error(f"Email verification error: {e}")
            return False

    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get delivery status for a message."""
        # AWS SES doesn't provide direct message status lookup
        # This would typically be handled through SNS notifications
        logger.warning("AWS SES doesn't support direct message status lookup")
        return {}

    async def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle AWS SES webhook events (SNS notifications)."""
        events = []

        # Handle SNS notification
        if 'Type' in payload and payload['Type'] == 'Notification':
            message = payload.get('Message', '{}')

            try:
                import json
                event_data = json.loads(message) if isinstance(message, str) else message

                if event_data.get('notificationType'):
                    processed_event = self._process_sns_event(event_data)
                    if processed_event:
                        events.append(processed_event)
            except json.JSONDecodeError:
                logger.error("Failed to parse SNS message")

        return {'events': events}

    def _process_sns_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process SNS event data."""
        notification_type = event.get('notificationType')
        mail = event.get('mail', {})

        if notification_type == 'bounce':
            bounce = event.get('bounce', {})
            return {
                'message_id': mail.get('messageId'),
                'email': bounce.get('bouncedRecipients', [{}])[0].get('emailAddress'),
                'event_type': 'bounced',
                'timestamp': bounce.get('timestamp'),
                'reason': bounce.get('bouncedRecipients', [{}])[0].get('diagnosticCode'),
                'bounce_type': bounce.get('bounceType'),
                'bounce_subtype': bounce.get('bounceSubType')
            }

        elif notification_type == 'complaint':
            complaint = event.get('complaint', {})
            return {
                'message_id': mail.get('messageId'),
                'email': complaint.get('complainedRecipients', [{}])[0].get('emailAddress'),
                'event_type': 'complaint',
                'timestamp': complaint.get('timestamp'),
                'complaint_type': complaint.get('complaintFeedbackType')
            }

        elif notification_type == 'delivery':
            delivery = event.get('delivery', {})
            return {
                'message_id': mail.get('messageId'),
                'email': delivery.get('recipients', [None])[0],
                'event_type': 'delivered',
                'timestamp': delivery.get('timestamp'),
                'processing_time': delivery.get('processingTimeMillis')
            }

        return None

    async def get_bounce_list(self) -> List[Dict[str, Any]]:
        """Get list of bounced emails."""
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None, self.client.list_suppressed_destinations
            )

            bounces = []
            for item in response.get('SuppressedDestinationSummaries', []):
                bounces.append({
                    'email': item.get('EmailAddress'),
                    'reason': item.get('Reason'),
                    'last_update_time': item.get('LastUpdateTime')
                })

            return bounces

        except Exception as e:
            logger.error(f"Bounce list error: {e}")
            return []

    async def remove_from_bounce_list(self, email: str) -> bool:
        """Remove email from bounce list."""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, self.client.delete_suppressed_destination,
                {'EmailAddress': email}
            )
            return True

        except Exception as e:
            logger.error(f"Bounce removal error: {e}")
            return False

    async def get_sending_quota(self) -> Dict[str, Any]:
        """Get AWS SES sending quota."""
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None, self.client.get_send_quota
            )
            return response
        except Exception as e:
            logger.error(f"Send quota error: {e}")
            return {}

    async def get_sending_rate(self) -> Dict[str, Any]:
        """Get AWS SES sending rate."""
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None, self.client.get_send_statistics
            )
            return response
        except Exception as e:
            logger.error(f"Send statistics error: {e}")
            return {}