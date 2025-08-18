"""Rule parser for natural language scheduling rules."""
import re
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime, time
import logging

logger = logging.getLogger(__name__)


class RuleType(Enum):
    """Types of scheduling rules."""
    AVAILABILITY = "availability"
    PREFERENCE = "preference"
    REQUIREMENT = "requirement"
    RESTRICTION = "restriction"


class TimePattern(Enum):
    """Patterns for time recognition."""
    TIME_12H = r'\b(\d{1,2})\s*(?:([ap])\.?m\.?)\b'
    TIME_24H = r'\b([01]?\d|2[0-3]):([0-5]\d)\b'
    TIME_MILITARY = r'\b([01]\d|2[0-3])([0-5]\d)\b'


class RuleParser:
    """Parser for natural language scheduling rules."""
    
    TIME_PATTERNS = {
        '12h': r'\b(\d{1,2})\s*(?:([ap])\.?m\.?)\b',
        '24h': r'\b([01]?\d|2[0-3]):([0-5]\d)\b',
        'military': r'\b([01]\d|2[0-3])([0-5]\d)\b',
    }
    
    DAY_NAMES = {
        'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
        'friday': 4, 'saturday': 5, 'sunday': 6,
        'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3,
        'fri': 4, 'sat': 5, 'sun': 6,
        'weekday': [0, 1, 2, 3, 4],
        'weekend': [5, 6],
        'weekdays': [0, 1, 2, 3, 4],
        'weekends': [5, 6]
    }
    
    def __init__(self):
        """Initialize the rule parser."""
        self.nlp = None
        
    async def initialize(self):
        """Initialize the spaCy NLP model."""
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
        except ImportError:
            logger.warning("spaCy not installed, using fallback parser")
        except OSError:
            logger.warning("spaCy model not found, using fallback parser")
    
    async def parse_rule(self, rule_text: str) -> Dict[str, Any]:
        """Parse a natural language rule into structured format."""
        if not self.nlp:
            await self.initialize()
        
        result = {
            'original_text': rule_text,
            'rule_type': self._determine_rule_type(rule_text),
            'employee': self._extract_employee(rule_text),
            'constraints': []
        }
        
        # Extract various constraints
        time_constraints = self._extract_time_constraints(rule_text)
        if time_constraints:
            result['constraints'].extend(time_constraints)
        
        day_constraints = self._extract_day_constraints(rule_text)
        if day_constraints:
            result['constraints'].extend(day_constraints)
        
        # Extract preferences for preference rules
        if result['rule_type'] == RuleType.PREFERENCE:
            preferences = self._extract_shift_preferences(rule_text)
            if preferences:
                result['preferences'] = preferences
        
        # Extract requirements for requirement rules
        if result['rule_type'] == RuleType.REQUIREMENT:
            requirements = self._extract_staffing_requirements(rule_text)
            if requirements:
                result['requirements'] = requirements
        
        return result
    
    def _extract_employee(self, text: str) -> Optional[str]:
        """Extract employee name from the rule text."""
        if self.nlp:
            doc = self.nlp(text)
            # Look for PERSON entities
            for ent in doc.ents:
                if ent.label_ == "PERSON":
                    return ent.text
            
            # Look for proper nouns at the beginning
            for token in doc:
                if token.pos_ == "PROPN" and token.i == 0:
                    return token.text
        else:
            # Fallback: look for capitalized words at the beginning
            words = text.split()
            if words and words[0][0].isupper():
                return words[0].rstrip("'s")
        
        return None
    
    def _determine_rule_type(self, text: str) -> RuleType:
        """Determine the type of rule from the text."""
        text_lower = text.lower()
        
        # Keywords for each rule type
        availability_keywords = ["can't", "cannot", "unavailable", "not available", 
                                "can only", "only available", "off"]
        preference_keywords = ["prefer", "likes", "wants", "would like", "favorite",
                              "better", "rather"]
        requirement_keywords = ["need", "require", "must have", "minimum", "at least",
                              "should have"]
        restriction_keywords = ["maximum", "no more than", "limit", "cap", "restrict",
                              "should not exceed", "up to"]
        
        # Check for keywords in order of specificity
        if any(kw in text_lower for kw in restriction_keywords):
            return RuleType.RESTRICTION
        elif any(kw in text_lower for kw in requirement_keywords):
            return RuleType.REQUIREMENT
        elif any(kw in text_lower for kw in preference_keywords):
            return RuleType.PREFERENCE
        elif any(kw in text_lower for kw in availability_keywords):
            return RuleType.AVAILABILITY
        else:
            # Default to availability if no clear indicators
            return RuleType.AVAILABILITY
    
    def _extract_time_constraints(self, text: str) -> List[Dict[str, Any]]:
        """Extract time constraints from the text."""
        constraints = []
        text_lower = text.lower()
        
        # Try different time patterns
        for pattern_name, pattern in self.TIME_PATTERNS.items():
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                time_str = match.group(0)
                parsed_time = self._parse_time(time_str, pattern_name)
                if parsed_time:
                    # Determine if it's a start or end time based on context
                    context = self._get_time_context(text, match.start())
                    constraint = {
                        'type': 'time',
                        'value': parsed_time.strftime('%H:%M'),
                        'context': context
                    }
                    constraints.append(constraint)
        
        # Handle special time phrases
        special_times = {
            'morning': ('06:00', '12:00'),
            'afternoon': ('12:00', '17:00'),
            'evening': ('17:00', '21:00'),
            'night': ('21:00', '23:59'),
            'lunch': ('11:00', '14:00'),
            'breakfast': ('06:00', '10:00'),
            'dinner': ('17:00', '20:00')
        }
        
        for period, (start, end) in special_times.items():
            if period in text_lower:
                constraints.append({
                    'type': 'time_range',
                    'start': start,
                    'end': end,
                    'period': period
                })
        
        return constraints
    
    def _extract_day_constraints(self, text: str) -> List[Dict[str, Any]]:
        """Extract day constraints from the text."""
        constraints = []
        text_lower = text.lower()
        
        # Check for day names and ranges
        for day_name, day_value in self.DAY_NAMES.items():
            if day_name in text_lower:
                if isinstance(day_value, list):
                    # Handle weekday/weekend
                    for day in day_value:
                        constraints.append({
                            'type': 'day',
                            'value': day,
                            'name': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 
                                   'Friday', 'Saturday', 'Sunday'][day]
                        })
                else:
                    constraints.append({
                        'type': 'day',
                        'value': day_value,
                        'name': day_name.capitalize()
                    })
        
        # Handle day ranges (e.g., "Monday to Friday")
        range_pattern = r'(\w+)\s+(?:to|through|-)\s+(\w+)'
        matches = re.finditer(range_pattern, text_lower)
        for match in matches:
            start_day = match.group(1)
            end_day = match.group(2)
            if start_day in self.DAY_NAMES and end_day in self.DAY_NAMES:
                start_idx = self.DAY_NAMES[start_day]
                end_idx = self.DAY_NAMES[end_day]
                if isinstance(start_idx, int) and isinstance(end_idx, int):
                    for day in range(start_idx, end_idx + 1):
                        constraints.append({
                            'type': 'day',
                            'value': day,
                            'name': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 
                                   'Friday', 'Saturday', 'Sunday'][day]
                        })
        
        return constraints
    
    def _extract_shift_preferences(self, text: str) -> Dict[str, Any]:
        """Extract shift preferences from the text."""
        preferences = {}
        text_lower = text.lower()
        
        # Time of day preferences
        if 'morning' in text_lower:
            preferences['time_of_day'] = 'morning'
        elif 'afternoon' in text_lower:
            preferences['time_of_day'] = 'afternoon'
        elif 'evening' in text_lower or 'night' in text_lower:
            preferences['time_of_day'] = 'evening'
        
        # Shift length preferences
        hour_pattern = r'(\d+)\s*(?:hour|hr)'
        match = re.search(hour_pattern, text_lower)
        if match:
            preferences['shift_length'] = int(match.group(1))
        
        # Consecutive days preference
        if 'consecutive' in text_lower:
            preferences['consecutive_days'] = True
        elif 'not consecutive' in text_lower or 'no consecutive' in text_lower:
            preferences['consecutive_days'] = False
        
        return preferences
    
    def _extract_staffing_requirements(self, text: str) -> Dict[str, Any]:
        """Extract staffing requirements from the text."""
        requirements = {}
        text_lower = text.lower()
        
        # Extract minimum staffing
        min_patterns = [
            r'(?:minimum|at least|need)\s+(\d+)\s+(?:people|staff|employees|workers)',
            r'(\d+)\s+(?:people|staff|employees|workers)\s+(?:minimum|required)',
        ]
        
        for pattern in min_patterns:
            match = re.search(pattern, text_lower)
            if match:
                requirements['minimum_staff'] = int(match.group(1))
                break
        
        # Extract maximum staffing
        max_patterns = [
            r'(?:maximum|at most|no more than)\s+(\d+)\s+(?:people|staff|employees|workers)',
            r'(\d+)\s+(?:people|staff|employees|workers)\s+(?:maximum|max)',
        ]
        
        for pattern in max_patterns:
            match = re.search(pattern, text_lower)
            if match:
                requirements['maximum_staff'] = int(match.group(1))
                break
        
        # Extract time-specific requirements
        if 'during' in text_lower or 'between' in text_lower:
            time_constraints = self._extract_time_constraints(text)
            if time_constraints:
                requirements['time_constraints'] = time_constraints
        
        return requirements
    
    def _parse_time(self, time_str: str, pattern_type: str) -> Optional[time]:
        """Parse a time string into a time object."""
        try:
            if pattern_type == '12h':
                # Parse 12-hour format
                match = re.match(self.TIME_PATTERNS['12h'], time_str, re.IGNORECASE)
                if match:
                    hour = int(match.group(1))
                    meridiem = match.group(2).lower() if match.group(2) else 'a'
                    
                    if meridiem == 'p' and hour != 12:
                        hour += 12
                    elif meridiem == 'a' and hour == 12:
                        hour = 0
                    
                    return time(hour, 0)
            
            elif pattern_type == '24h':
                # Parse 24-hour format with colon
                match = re.match(self.TIME_PATTERNS['24h'], time_str)
                if match:
                    hour = int(match.group(1))
                    minute = int(match.group(2))
                    return time(hour, minute)
            
            elif pattern_type == 'military':
                # Parse military time format
                match = re.match(self.TIME_PATTERNS['military'], time_str)
                if match:
                    hour = int(match.group(1))
                    minute = int(match.group(2))
                    return time(hour, minute)
        
        except (ValueError, AttributeError):
            pass
        
        return None
    
    def _get_time_context(self, text: str, position: int) -> str:
        """Determine if a time is a start or end time based on context."""
        # Look for keywords before the time
        before_text = text[:position].lower()
        after_text = text[position:].lower()
        
        start_keywords = ['from', 'starting', 'begins', 'after', 'start']
        end_keywords = ['until', 'to', 'before', 'ends', 'by', 'past']
        
        for keyword in end_keywords:
            if keyword in before_text[-20:]:  # Check last 20 chars before time
                return 'end'
        
        for keyword in start_keywords:
            if keyword in before_text[-20:]:
                return 'start'
        
        # Check after the time as well
        for keyword in end_keywords:
            if keyword in after_text[:20]:  # Check first 20 chars after time
                return 'start'  # If "until" comes after, this is the start time
        
        return 'unspecified'
    
    def validate_constraint(self, constraint: Dict[str, Any]) -> bool:
        """Validate a constraint has required fields and valid values."""
        if 'type' not in constraint:
            return False
        
        if constraint['type'] == 'time':
            if 'value' not in constraint:
                return False
            # Validate time format
            try:
                datetime.strptime(constraint['value'], '%H:%M')
                return True
            except ValueError:
                return False
        
        elif constraint['type'] == 'day':
            if 'value' not in constraint:
                return False
            # Validate day value (0-6)
            return isinstance(constraint['value'], int) and 0 <= constraint['value'] <= 6
        
        elif constraint['type'] == 'time_range':
            if 'start' not in constraint or 'end' not in constraint:
                return False
            try:
                datetime.strptime(constraint['start'], '%H:%M')
                datetime.strptime(constraint['end'], '%H:%M')
                return True
            except ValueError:
                return False
        
        return True