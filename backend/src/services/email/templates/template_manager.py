"""
Email template management with Jinja2 templating.
"""

import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pathlib import Path
import jinja2
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from ..models import EmailTemplate, NotificationType
from ..utils.cache import TemplateCache

logger = logging.getLogger(__name__)


class EmailTemplateManager:
    """Email template manager with Jinja2 templating."""

    def __init__(self, template_dir: str, db_session: Session, cache_ttl: int = 3600):
        """Initialize template manager."""
        self.template_dir = Path(template_dir)
        self.db_session = db_session
        self.cache = TemplateCache(ttl=cache_ttl)

        # Create Jinja2 environment
        self.env = Environment(
            loader=FileSystemLoader(
                [str(self.template_dir / "html"), str(self.template_dir / "text"), str(self.template_dir)]
            ),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

        # Add custom filters
        self._add_custom_filters()

        # Ensure template directories exist
        self._ensure_directories()

    def _add_custom_filters(self) -> None:
        """Add custom Jinja2 filters."""

        @self.env.filter("datetime")
        def datetime_filter(value, format="%Y-%m-%d %H:%M:%S"):
            """Format datetime values."""
            if isinstance(value, str):
                try:
                    value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                except ValueError:
                    return value

            if isinstance(value, datetime):
                return value.strftime(format)
            return value

        @self.env.filter("currency")
        def currency_filter(value, currency="USD"):
            """Format currency values."""
            try:
                return f"${float(value):,.2f}"
            except (ValueError, TypeError):
                return value

        @self.env.filter("capitalize_words")
        def capitalize_words_filter(value):
            """Capitalize each word."""
            return " ".join(word.capitalize() for word in str(value).split())

        @self.env.filter("truncate_words")
        def truncate_words_filter(value, length=50):
            """Truncate to specific word count."""
            words = str(value).split()
            if len(words) <= length:
                return value
            return " ".join(words[:length]) + "..."

    def _ensure_directories(self) -> None:
        """Ensure template directories exist."""
        directories = [
            self.template_dir,
            self.template_dir / "html",
            self.template_dir / "text",
            self.template_dir / "layouts",
            self.template_dir / "partials",
        ]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

    async def render_template(
        self, template_name: str, variables: Dict[str, Any], language: str = "en", content_type: str = "html"
    ) -> str:
        """Render template with variables."""
        try:
            # Get template from cache or database
            template = await self._get_template(template_name, language, content_type)

            if not template:
                raise ValueError(f"Template not found: {template_name}")

            # Prepare template variables
            template_vars = self._prepare_variables(variables)

            # Render template
            if content_type == "html" and template.html_content:
                jinja_template = self.env.from_string(template.html_content)
                return jinja_template.render(**template_vars)
            elif content_type == "text" and template.text_content:
                jinja_template = self.env.from_string(template.text_content)
                return jinja_template.render(**template_vars)
            else:
                # Try file-based template
                template_file = f"{template_name}_{language}.{content_type}"
                if not self._template_file_exists(template_file):
                    template_file = f"{template_name}.{content_type}"

                if self._template_file_exists(template_file):
                    jinja_template = self.env.get_template(template_file)
                    return jinja_template.render(**template_vars)

                raise ValueError(f"Template content not found for {template_name}")

        except jinja2.TemplateError as e:
            logger.error(f"Template rendering error: {e}")
            raise ValueError(f"Template rendering failed: {str(e)}")
        except Exception as e:
            logger.error(f"Template processing error: {e}")
            raise

    def _prepare_variables(self, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare template variables with common utilities."""
        # Start with provided variables
        template_vars = variables.copy()

        # Add common variables
        template_vars.update(
            {
                "current_year": datetime.now().year,
                "current_date": datetime.now().strftime("%Y-%m-%d"),
                "current_datetime": datetime.now(),
                "app_name": "AI Schedule Manager",
                "support_email": "support@aischedulemanager.com",
                "website_url": "https://aischedulemanager.com",
            }
        )

        # Add utility functions
        template_vars.update(
            {
                "format_date": lambda date: date.strftime("%B %d, %Y") if date else "",
                "format_time": lambda time: time.strftime("%I:%M %p") if time else "",
                "format_datetime": lambda dt: dt.strftime("%B %d, %Y at %I:%M %p") if dt else "",
            }
        )

        return template_vars

    async def _get_template(self, template_name: str, language: str, content_type: str) -> Optional[EmailTemplate]:
        """Get template from cache or database."""
        cache_key = f"{template_name}:{language}:{content_type}"

        # Check cache first
        template = self.cache.get(cache_key)
        if template:
            return template

        # Query database
        template = (
            self.db_session.query(EmailTemplate).filter_by(name=template_name, language=language, is_active=True).first()
        )

        if template:
            self.cache.set(cache_key, template)

        return template

    def _template_file_exists(self, template_file: str) -> bool:
        """Check if template file exists."""
        for search_path in self.env.loader.searchpath:
            if (Path(search_path) / template_file).exists():
                return True
        return False

    async def create_template(
        self,
        name: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        template_type: str = "custom",
        language: str = "en",
        variables: Optional[Dict[str, Any]] = None,
        created_by: Optional[int] = None,
    ) -> EmailTemplate:
        """Create new email template."""
        try:
            # Check if template already exists
            existing = self.db_session.query(EmailTemplate).filter_by(name=name, language=language).first()

            if existing:
                raise ValueError(f"Template '{name}' already exists for language '{language}'")

            # Create template
            template = EmailTemplate(
                name=name,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                template_type=template_type,
                language=language,
                variables=variables or {},
                created_by=created_by,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )

            self.db_session.add(template)
            self.db_session.commit()

            # Clear cache
            self.cache.clear()

            logger.info(f"Created email template: {name}")
            return template

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Failed to create template: {e}")
            raise

    async def update_template(self, template_id: int, **updates) -> EmailTemplate:
        """Update existing email template."""
        try:
            template = self.db_session.query(EmailTemplate).get(template_id)
            if not template:
                raise ValueError(f"Template with ID {template_id} not found")

            # Update fields
            for field, value in updates.items():
                if hasattr(template, field):
                    setattr(template, field, value)

            template.updated_at = datetime.now(timezone.utc)
            template.version += 1

            self.db_session.commit()

            # Clear cache
            self.cache.clear()

            logger.info(f"Updated email template: {template.name}")
            return template

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Failed to update template: {e}")
            raise

    async def get_template_by_type(self, template_type: str, language: str = "en") -> Optional[EmailTemplate]:
        """Get template by type and language."""
        return (
            self.db_session.query(EmailTemplate)
            .filter_by(template_type=template_type, language=language, is_active=True)
            .first()
        )

    async def list_templates(
        self, template_type: Optional[str] = None, language: Optional[str] = None, is_active: Optional[bool] = None
    ) -> List[EmailTemplate]:
        """List email templates with optional filtering."""
        query = self.db_session.query(EmailTemplate)

        if template_type:
            query = query.filter(EmailTemplate.template_type == template_type)
        if language:
            query = query.filter(EmailTemplate.language == language)
        if is_active is not None:
            query = query.filter(EmailTemplate.is_active == is_active)

        return query.order_by(EmailTemplate.name, EmailTemplate.language).all()

    async def delete_template(self, template_id: int) -> bool:
        """Delete email template."""
        try:
            template = self.db_session.query(EmailTemplate).get(template_id)
            if not template:
                return False

            self.db_session.delete(template)
            self.db_session.commit()

            # Clear cache
            self.cache.clear()

            logger.info(f"Deleted email template: {template.name}")
            return True

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Failed to delete template: {e}")
            raise

    async def preview_template(self, template_name: str, variables: Dict[str, Any], language: str = "en") -> Dict[str, str]:
        """Preview template with sample data."""
        try:
            html_content = await self.render_template(template_name, variables, language, "html")
            text_content = await self.render_template(template_name, variables, language, "text")

            return {"html": html_content, "text": text_content}

        except Exception as e:
            logger.error(f"Template preview error: {e}")
            raise

    async def validate_template_syntax(self, html_content: str, text_content: Optional[str] = None) -> Dict[str, Any]:
        """Validate template syntax."""
        errors = []
        warnings = []

        try:
            # Test HTML template
            html_template = self.env.from_string(html_content)

            # Try to render with empty context to check syntax
            html_template.render()

        except jinja2.TemplateSyntaxError as e:
            errors.append(f"HTML template syntax error: {str(e)}")
        except Exception as e:
            warnings.append(f"HTML template warning: {str(e)}")

        if text_content:
            try:
                # Test text template
                text_template = self.env.from_string(text_content)
                text_template.render()

            except jinja2.TemplateSyntaxError as e:
                errors.append(f"Text template syntax error: {str(e)}")
            except Exception as e:
                warnings.append(f"Text template warning: {str(e)}")

        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
