"""
Unsubscribe management utilities.
"""

import secrets
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from ..models import NotificationPreference

logger = logging.getLogger(__name__)


class UnsubscribeManager:
    """Unsubscribe link and preference management."""

    def __init__(self, db_session: Session, base_url: str = "https://app.aischedulemanager.com"):
        """Initialize unsubscribe manager."""
        self.db_session = db_session
        self.base_url = base_url.rstrip('/')

    def generate_unsubscribe_token(self, user_id: int) -> str:
        """Generate secure unsubscribe token for user."""
        try:
            # Get or create notification preferences
            preferences = self.db_session.query(NotificationPreference).filter_by(
                user_id=user_id
            ).first()

            if not preferences:
                # Create default preferences
                preferences = NotificationPreference(
                    user_id=user_id,
                    email_enabled=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                self.db_session.add(preferences)

            # Generate new token if not exists
            if not preferences.unsubscribe_token:
                preferences.unsubscribe_token = secrets.token_urlsafe(32)
                self.db_session.commit()

            return preferences.unsubscribe_token

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Unsubscribe token generation error: {e}")
            raise

    def get_unsubscribe_url(self, user_id: int, email_type: Optional[str] = None) -> str:
        """Get unsubscribe URL for user."""
        try:
            token = self.generate_unsubscribe_token(user_id)

            url = f"{self.base_url}/unsubscribe/{token}"

            if email_type:
                url += f"?type={email_type}"

            return url

        except Exception as e:
            logger.error(f"Unsubscribe URL generation error: {e}")
            return f"{self.base_url}/unsubscribe"

    def process_unsubscribe(
        self,
        token: str,
        email_type: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process unsubscribe request."""
        try:
            # Find user by token
            preferences = self.db_session.query(NotificationPreference).filter_by(
                unsubscribe_token=token
            ).first()

            if not preferences:
                return {
                    'success': False,
                    'error': 'Invalid unsubscribe token'
                }

            # Check if already unsubscribed
            if preferences.unsubscribed_at:
                return {
                    'success': True,
                    'message': 'Already unsubscribed',
                    'unsubscribed_at': preferences.unsubscribed_at.isoformat()
                }

            # Process unsubscribe based on type
            if email_type:
                result = self._unsubscribe_from_type(preferences, email_type)
            else:
                # Unsubscribe from all emails
                result = self._unsubscribe_from_all(preferences)

            # Update unsubscribe info
            if result['success']:
                preferences.unsubscribed_at = datetime.now(timezone.utc)
                preferences.unsubscribe_reason = reason
                preferences.updated_at = datetime.now(timezone.utc)
                self.db_session.commit()

                logger.info(f"User {preferences.user_id} unsubscribed from {email_type or 'all'}")

            return result

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Unsubscribe processing error: {e}")
            return {
                'success': False,
                'error': f'Processing error: {str(e)}'
            }

    def _unsubscribe_from_type(
        self,
        preferences: NotificationPreference,
        email_type: str
    ) -> Dict[str, Any]:
        """Unsubscribe from specific email type."""
        type_map = {
            'welcome': 'welcome_emails',
            'password_reset': 'password_reset_emails',
            'schedule_notification': 'schedule_notifications',
            'shift_reminder': 'shift_reminders',
            'schedule_change': 'schedule_changes',
            'weekly_summary': 'weekly_summaries',
            'system_alert': 'system_alerts',
            'marketing': 'marketing_emails'
        }

        if email_type not in type_map:
            return {
                'success': False,
                'error': f'Unknown email type: {email_type}'
            }

        field_name = type_map[email_type]
        setattr(preferences, field_name, False)

        return {
            'success': True,
            'message': f'Unsubscribed from {email_type} emails',
            'email_type': email_type
        }

    def _unsubscribe_from_all(self, preferences: NotificationPreference) -> Dict[str, Any]:
        """Unsubscribe from all emails."""
        preferences.email_enabled = False
        preferences.welcome_emails = False
        preferences.schedule_notifications = False
        preferences.shift_reminders = False
        preferences.schedule_changes = False
        preferences.weekly_summaries = False
        preferences.system_alerts = False
        preferences.marketing_emails = False

        return {
            'success': True,
            'message': 'Unsubscribed from all emails',
            'email_type': 'all'
        }

    def resubscribe(
        self,
        token: str,
        email_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Resubscribe user to emails."""
        try:
            # Find user by token
            preferences = self.db_session.query(NotificationPreference).filter_by(
                unsubscribe_token=token
            ).first()

            if not preferences:
                return {
                    'success': False,
                    'error': 'Invalid unsubscribe token'
                }

            # Process resubscribe
            if email_type:
                result = self._resubscribe_to_type(preferences, email_type)
            else:
                # Resubscribe to all emails
                result = self._resubscribe_to_all(preferences)

            if result['success']:
                # Clear unsubscribe info if resubscribing to all
                if not email_type:
                    preferences.unsubscribed_at = None
                    preferences.unsubscribe_reason = None

                preferences.updated_at = datetime.now(timezone.utc)
                self.db_session.commit()

                logger.info(f"User {preferences.user_id} resubscribed to {email_type or 'all'}")

            return result

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Resubscribe processing error: {e}")
            return {
                'success': False,
                'error': f'Processing error: {str(e)}'
            }

    def _resubscribe_to_type(
        self,
        preferences: NotificationPreference,
        email_type: str
    ) -> Dict[str, Any]:
        """Resubscribe to specific email type."""
        type_map = {
            'welcome': 'welcome_emails',
            'schedule_notification': 'schedule_notifications',
            'shift_reminder': 'shift_reminders',
            'schedule_change': 'schedule_changes',
            'weekly_summary': 'weekly_summaries',
            'system_alert': 'system_alerts',
            'marketing': 'marketing_emails'
        }

        if email_type not in type_map:
            return {
                'success': False,
                'error': f'Unknown email type: {email_type}'
            }

        field_name = type_map[email_type]
        setattr(preferences, field_name, True)

        # Enable general email notifications if disabled
        if not preferences.email_enabled:
            preferences.email_enabled = True

        return {
            'success': True,
            'message': f'Resubscribed to {email_type} emails',
            'email_type': email_type
        }

    def _resubscribe_to_all(self, preferences: NotificationPreference) -> Dict[str, Any]:
        """Resubscribe to all emails."""
        preferences.email_enabled = True
        preferences.welcome_emails = True
        preferences.schedule_notifications = True
        preferences.shift_reminders = True
        preferences.schedule_changes = True
        preferences.weekly_summaries = True
        preferences.system_alerts = True
        # Keep marketing emails as they were

        return {
            'success': True,
            'message': 'Resubscribed to all emails',
            'email_type': 'all'
        }

    def get_preference_by_token(self, token: str) -> Optional[NotificationPreference]:
        """Get notification preferences by unsubscribe token."""
        try:
            return self.db_session.query(NotificationPreference).filter_by(
                unsubscribe_token=token
            ).first()

        except Exception as e:
            logger.error(f"Get preferences by token error: {e}")
            return None

    def update_preferences(
        self,
        token: str,
        preferences_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update notification preferences via unsubscribe token."""
        try:
            preferences = self.get_preference_by_token(token)
            if not preferences:
                return {
                    'success': False,
                    'error': 'Invalid token'
                }

            # Update allowed fields
            allowed_fields = [
                'email_enabled', 'welcome_emails', 'schedule_notifications',
                'shift_reminders', 'schedule_changes', 'weekly_summaries',
                'system_alerts', 'marketing_emails', 'schedule_notification_frequency',
                'summary_frequency', 'reminder_frequency', 'quiet_hours_start',
                'quiet_hours_end', 'preferred_send_time', 'timezone', 'language'
            ]

            updated_fields = []
            for field, value in preferences_data.items():
                if field in allowed_fields and hasattr(preferences, field):
                    setattr(preferences, field, value)
                    updated_fields.append(field)

            if updated_fields:
                preferences.updated_at = datetime.now(timezone.utc)
                self.db_session.commit()

                logger.info(f"Updated preferences for user {preferences.user_id}: {updated_fields}")

                return {
                    'success': True,
                    'message': 'Preferences updated successfully',
                    'updated_fields': updated_fields
                }
            else:
                return {
                    'success': False,
                    'error': 'No valid fields to update'
                }

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Update preferences error: {e}")
            return {
                'success': False,
                'error': f'Update error: {str(e)}'
            }

    def get_unsubscribe_stats(self) -> Dict[str, Any]:
        """Get unsubscribe statistics."""
        try:
            total_users = self.db_session.query(NotificationPreference).count()

            unsubscribed_users = self.db_session.query(NotificationPreference).filter(
                NotificationPreference.unsubscribed_at.isnot(None)
            ).count()

            disabled_email_users = self.db_session.query(NotificationPreference).filter_by(
                email_enabled=False
            ).count()

            # Count users with specific types disabled
            type_stats = {}
            notification_types = [
                'welcome_emails', 'schedule_notifications', 'shift_reminders',
                'schedule_changes', 'weekly_summaries', 'system_alerts', 'marketing_emails'
            ]

            for notification_type in notification_types:
                disabled_count = self.db_session.query(NotificationPreference).filter(
                    getattr(NotificationPreference, notification_type) == False
                ).count()

                type_stats[notification_type] = {
                    'disabled_count': disabled_count,
                    'enabled_count': total_users - disabled_count,
                    'disabled_percentage': (disabled_count / total_users * 100) if total_users > 0 else 0
                }

            return {
                'total_users': total_users,
                'unsubscribed_users': unsubscribed_users,
                'disabled_email_users': disabled_email_users,
                'active_email_users': total_users - disabled_email_users,
                'unsubscribe_rate': (unsubscribed_users / total_users * 100) if total_users > 0 else 0,
                'type_statistics': type_stats,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Unsubscribe stats error: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }