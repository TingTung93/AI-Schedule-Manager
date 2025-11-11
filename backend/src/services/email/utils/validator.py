"""
Email validation utilities.
"""

import re
import logging
from typing import List, Dict, Any
import dns.resolver
from email_validator import validate_email, EmailNotValidError

logger = logging.getLogger(__name__)


class EmailValidator:
    """Email validation class."""

    def __init__(self):
        """Initialize email validator."""
        # Common email patterns
        self.basic_pattern = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

        # Disposable email domains (common ones)
        self.disposable_domains = {
            "10minutemail.com",
            "guerrillamail.com",
            "mailinator.com",
            "tempmail.org",
            "yopmail.com",
            "throwaway.email",
            "getnada.com",
            "temp-mail.org",
            "maildrop.cc",
        }

        # Role-based email patterns
        self.role_patterns = {
            "noreply",
            "no-reply",
            "donotreply",
            "admin",
            "administrator",
            "postmaster",
            "hostmaster",
            "webmaster",
            "support",
            "info",
            "sales",
            "marketing",
            "abuse",
            "security",
        }

    def validate_email(self, email: str) -> bool:
        """Basic email validation."""
        try:
            if not email or not isinstance(email, str):
                return False

            # Basic pattern check
            if not self.basic_pattern.match(email.strip().lower()):
                return False

            # Use email-validator library for comprehensive validation
            valid = validate_email(email)
            return bool(valid)

        except EmailNotValidError:
            return False
        except Exception as e:
            logger.error(f"Email validation error: {e}")
            return False

    def validate_email_comprehensive(self, email: str) -> Dict[str, Any]:
        """Comprehensive email validation with detailed results."""
        result = {
            "email": email,
            "valid": False,
            "errors": [],
            "warnings": [],
            "suggestions": [],
            "deliverable": None,
            "role_based": False,
            "disposable": False,
            "domain_valid": False,
            "mx_records": False,
        }

        try:
            if not email or not isinstance(email, str):
                result["errors"].append("Email is required and must be a string")
                return result

            email = email.strip().lower()
            result["email"] = email

            # Basic format validation
            if not self.basic_pattern.match(email):
                result["errors"].append("Invalid email format")
                return result

            # Split email into local and domain parts
            local_part, domain = email.rsplit("@", 1)

            # Check for role-based emails
            if any(pattern in local_part for pattern in self.role_patterns):
                result["role_based"] = True
                result["warnings"].append("Role-based email detected")

            # Check for disposable domains
            if domain in self.disposable_domains:
                result["disposable"] = True
                result["warnings"].append("Disposable email domain detected")

            # Domain validation
            domain_result = self._validate_domain(domain)
            result["domain_valid"] = domain_result["valid"]
            result["mx_records"] = domain_result["mx_records"]

            if not domain_result["valid"]:
                result["errors"].extend(domain_result["errors"])

            # Use email-validator for detailed validation
            try:
                validated = validate_email(email, check_deliverability=True)
                result["valid"] = True
                result["deliverable"] = True
                result["email"] = validated.email

            except EmailNotValidError as e:
                result["errors"].append(str(e))

            # Additional checks
            if len(local_part) > 64:
                result["warnings"].append("Local part exceeds 64 characters")

            if len(domain) > 253:
                result["errors"].append("Domain exceeds 253 characters")

            # Check for common typos and suggest corrections
            suggestions = self._get_domain_suggestions(domain)
            if suggestions:
                result["suggestions"].extend(suggestions)

        except Exception as e:
            logger.error(f"Comprehensive email validation error: {e}")
            result["errors"].append(f"Validation error: {str(e)}")

        return result

    def validate_email_list(self, emails: List[str]) -> Dict[str, Any]:
        """Validate a list of emails."""
        results = {
            "total": len(emails),
            "valid": 0,
            "invalid": 0,
            "warnings": 0,
            "duplicates": 0,
            "results": [],
            "unique_emails": set(),
        }

        for email in emails:
            validation_result = self.validate_email_comprehensive(email)
            results["results"].append(validation_result)

            if validation_result["valid"]:
                results["valid"] += 1
            else:
                results["invalid"] += 1

            if validation_result["warnings"]:
                results["warnings"] += 1

            # Check for duplicates
            normalized_email = validation_result["email"].lower()
            if normalized_email in results["unique_emails"]:
                results["duplicates"] += 1
            else:
                results["unique_emails"].add(normalized_email)

        # Remove the set from final results
        del results["unique_emails"]

        return results

    def _validate_domain(self, domain: str) -> Dict[str, Any]:
        """Validate email domain."""
        result = {"valid": False, "mx_records": False, "errors": []}

        try:
            # Check if domain has MX records
            try:
                mx_records = dns.resolver.resolve(domain, "MX")
                if mx_records:
                    result["mx_records"] = True
                    result["valid"] = True
            except dns.resolver.NXDOMAIN:
                result["errors"].append("Domain does not exist")
            except dns.resolver.NoAnswer:
                # Try A record as fallback
                try:
                    a_records = dns.resolver.resolve(domain, "A")
                    if a_records:
                        result["valid"] = True
                except:
                    result["errors"].append("Domain has no MX or A records")
            except Exception as e:
                result["errors"].append(f"DNS lookup error: {str(e)}")

        except Exception as e:
            logger.error(f"Domain validation error: {e}")
            result["errors"].append(f"Domain validation error: {str(e)}")

        return result

    def _get_domain_suggestions(self, domain: str) -> List[str]:
        """Get domain correction suggestions for common typos."""
        suggestions = []

        # Common domain typos
        typo_map = {
            "gmial.com": "gmail.com",
            "gmai.com": "gmail.com",
            "gmil.com": "gmail.com",
            "yahooo.com": "yahoo.com",
            "yaho.com": "yahoo.com",
            "hotmial.com": "hotmail.com",
            "hotmai.com": "hotmail.com",
            "outlok.com": "outlook.com",
            "outloo.com": "outlook.com",
        }

        if domain in typo_map:
            suggestions.append(f"Did you mean '{typo_map[domain]}'?")

        # Check for missing TLD
        if "." not in domain:
            suggestions.append(f"Did you mean '{domain}.com'?")

        return suggestions

    def is_role_based_email(self, email: str) -> bool:
        """Check if email is role-based."""
        try:
            local_part = email.split("@")[0].lower()
            return any(pattern in local_part for pattern in self.role_patterns)
        except:
            return False

    def is_disposable_email(self, email: str) -> bool:
        """Check if email is from a disposable domain."""
        try:
            domain = email.split("@")[1].lower()
            return domain in self.disposable_domains
        except:
            return False

    def normalize_email(self, email: str) -> str:
        """Normalize email address."""
        try:
            validated = validate_email(email)
            return validated.email
        except:
            return email.strip().lower()

    def extract_domain(self, email: str) -> str:
        """Extract domain from email address."""
        try:
            return email.split("@")[1].lower()
        except:
            return ""

    def get_email_provider(self, email: str) -> str:
        """Get email provider name from domain."""
        domain = self.extract_domain(email)

        provider_map = {
            "gmail.com": "Gmail",
            "yahoo.com": "Yahoo",
            "hotmail.com": "Hotmail",
            "outlook.com": "Outlook",
            "aol.com": "AOL",
            "icloud.com": "iCloud",
            "protonmail.com": "ProtonMail",
            "yandex.com": "Yandex",
        }

        return provider_map.get(domain, "Unknown")

    def validate_email_syntax_only(self, email: str) -> bool:
        """Basic syntax validation without external checks."""
        try:
            if not email or not isinstance(email, str):
                return False

            email = email.strip()

            # Basic pattern check
            if not self.basic_pattern.match(email):
                return False

            # Additional syntax checks
            local_part, domain = email.rsplit("@", 1)

            # Local part checks
            if not local_part or len(local_part) > 64:
                return False

            # Domain checks
            if not domain or len(domain) > 253:
                return False

            # Check for consecutive dots
            if ".." in email:
                return False

            # Check for leading/trailing dots
            if local_part.startswith(".") or local_part.endswith("."):
                return False

            return True

        except Exception:
            return False
