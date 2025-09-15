"""
Simple rule parser for natural language scheduling rules.
"""

import re
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class RuleParser:
    """Parse natural language scheduling rules into structured data."""

    def __init__(self):
        """Initialize the rule parser."""
        self.rule_type_keywords = {
            "availability": ["available", "free", "work", "can"],
            "preference": ["prefer", "like", "want", "would rather"],
            "requirement": ["need", "must", "require", "have to"],
            "restriction": ["cannot", "can't", "not available", "unavailable", "max", "limit"]
        }

        self.time_patterns = [
            r'(\d{1,2}):(\d{2})\s*(am|pm)?',
            r'(\d{1,2})\s*(am|pm)',
            r'(\d{1,2}):(\d{2})',
        ]

        self.day_patterns = {
            "monday": ["monday", "mon"],
            "tuesday": ["tuesday", "tue"],
            "wednesday": ["wednesday", "wed"],
            "thursday": ["thursday", "thu"],
            "friday": ["friday", "fri"],
            "saturday": ["saturday", "sat"],
            "sunday": ["sunday", "sun"],
            "weekday": ["weekday", "weekdays"],
            "weekend": ["weekend", "weekends"]
        }

        self.shift_patterns = {
            "morning": ["morning", "am", "early"],
            "afternoon": ["afternoon", "midday", "noon"],
            "evening": ["evening", "night", "pm", "late"]
        }

    async def parse_rule(self, rule_text: str) -> Dict[str, Any]:
        """Parse rule text into structured data."""
        try:
            rule_text_lower = rule_text.lower()

            # Determine rule type
            rule_type = self._determine_rule_type(rule_text_lower)

            # Extract constraints
            constraints = {}

            # Extract time constraints
            times = self._extract_times(rule_text_lower)
            if times:
                constraints["times"] = times

            # Extract day constraints
            days = self._extract_days(rule_text_lower)
            if days:
                constraints["days"] = days

            # Extract shift type constraints
            shifts = self._extract_shifts(rule_text_lower)
            if shifts:
                constraints["shifts"] = shifts

            # Extract hours/duration constraints
            hours = self._extract_hours(rule_text_lower)
            if hours:
                constraints["hours"] = hours

            # Determine priority based on keywords
            priority = self._determine_priority(rule_text_lower)

            return {
                "rule_type": rule_type,
                "constraints": constraints,
                "priority": priority,
                "employee_id": None,  # Could be extracted from context
                "confidence": 0.8  # Simple confidence score
            }

        except Exception as e:
            logger.error(f"Error parsing rule: {e}")
            # Return a basic rule structure
            return {
                "rule_type": "preference",
                "constraints": {"original": rule_text},
                "priority": 1,
                "employee_id": None,
                "confidence": 0.3
            }

    def _determine_rule_type(self, text: str) -> str:
        """Determine the type of rule based on keywords."""
        scores = {}

        for rule_type, keywords in self.rule_type_keywords.items():
            score = 0
            for keyword in keywords:
                if keyword in text:
                    score += 1
            scores[rule_type] = score

        # Return the rule type with highest score, default to preference
        return max(scores, key=scores.get) if any(scores.values()) else "preference"

    def _extract_times(self, text: str) -> list:
        """Extract time constraints from text."""
        times = []

        for pattern in self.time_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                time_str = match.group(0)
                times.append({"type": "time", "value": time_str})

        return times

    def _extract_days(self, text: str) -> list:
        """Extract day constraints from text."""
        days = []

        for day, patterns in self.day_patterns.items():
            for pattern in patterns:
                if pattern in text:
                    days.append({"type": "day", "value": day})
                    break

        return days

    def _extract_shifts(self, text: str) -> list:
        """Extract shift type constraints from text."""
        shifts = []

        for shift, patterns in self.shift_patterns.items():
            for pattern in patterns:
                if pattern in text:
                    shifts.append({"type": "shift", "value": shift})
                    break

        return shifts

    def _extract_hours(self, text: str) -> list:
        """Extract hour/duration constraints from text."""
        hours = []

        # Look for patterns like "max 8 hours", "minimum 4 hours", "40 hours per week"
        hour_patterns = [
            r'max(?:imum)?\s+(\d+)\s+hours?',
            r'min(?:imum)?\s+(\d+)\s+hours?',
            r'(\d+)\s+hours?\s+per\s+week',
            r'(\d+)\s+hours?\s+per\s+day',
            r'no\s+more\s+than\s+(\d+)\s+hours?'
        ]

        for pattern in hour_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                hours.append({
                    "type": "hours",
                    "value": int(match.group(1)),
                    "constraint": match.group(0)
                })

        return hours

    def _determine_priority(self, text: str) -> int:
        """Determine priority based on urgency keywords."""
        high_priority_words = ["urgent", "must", "critical", "important", "asap"]
        medium_priority_words = ["prefer", "would like", "should"]

        for word in high_priority_words:
            if word in text:
                return 5

        for word in medium_priority_words:
            if word in text:
                return 3

        return 1  # Default low priority