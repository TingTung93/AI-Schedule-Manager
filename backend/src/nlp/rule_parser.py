import spacy
from typing import Dict, List, Any, Optional
import re
from datetime import datetime, time
import logging
from enum import Enum

logger = logging.getLogger(__name__)

class RuleType(Enum):
    AVAILABILITY = "availability"
    PREFERENCE = "preference"
    REQUIREMENT = "requirement"
    RESTRICTION = "restriction"

class TimePattern:
    """Patterns for extracting time-related information"""
    TIME_12H = r'\b(\d{1,2})(?::(\d{2}))?\s*([ap]m)\b'
    TIME_24H = r'\b([01]?\d|2[0-3]):([0-5]\d)\b'
    TIME_MILITARY = r'\b(\d{4})\b'
    DAYS = r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)s?\b'
    DAY_RANGES = r'\b(weekday|weekend|weeknight)s?\b'
    RELATIVE_TIME = r'\b(morning|afternoon|evening|night|early|late)\b'

class RuleParser:
    """
    Natural Language Parser for scheduling rules.
    Converts plain English rules into structured constraints.
    """
    
    def __init__(self):
        self.nlp = None
        self.patterns = self._compile_patterns()
        
    async def initialize(self):
        """Load spaCy model"""
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except:
            logger.info("Downloading spaCy model...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"])
            self.nlp = spacy.load("en_core_web_sm")
    
    def _compile_patterns(self) -> Dict[str, re.Pattern]:
        """Compile regex patterns for efficient reuse"""
        return {
            'time_12h': re.compile(TimePattern.TIME_12H, re.IGNORECASE),
            'time_24h': re.compile(TimePattern.TIME_24H),
            'time_military': re.compile(TimePattern.TIME_MILITARY),
            'days': re.compile(TimePattern.DAYS, re.IGNORECASE),
            'day_ranges': re.compile(TimePattern.DAY_RANGES, re.IGNORECASE),
            'relative_time': re.compile(TimePattern.RELATIVE_TIME, re.IGNORECASE),
        }
    
    def parse_rule(self, rule_text: str, employee_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse a natural language scheduling rule.
        
        Examples:
        - "John can't work past 5pm on weekdays"
        - "Sarah needs Mondays off for classes"
        - "Mike prefers morning shifts"
        - "We need at least 3 people on weekends"
        """
        doc = self.nlp(rule_text.lower())
        
        result = {
            'original_text': rule_text,
            'employee': employee_name or self._extract_employee(doc),
            'rule_type': self._determine_rule_type(doc),
            'constraints': [],
            'metadata': {}
        }
        
        # Extract time constraints
        time_constraints = self._extract_time_constraints(rule_text)
        if time_constraints:
            result['constraints'].extend(time_constraints)
        
        # Extract day constraints
        day_constraints = self._extract_day_constraints(rule_text)
        if day_constraints:
            result['constraints'].extend(day_constraints)
        
        # Extract shift preferences
        shift_prefs = self._extract_shift_preferences(doc)
        if shift_prefs:
            result['metadata']['preferences'] = shift_prefs
        
        # Extract staffing requirements
        staffing_reqs = self._extract_staffing_requirements(doc)
        if staffing_reqs:
            result['metadata']['staffing'] = staffing_reqs
        
        return result
    
    def _extract_employee(self, doc) -> Optional[str]:
        """Extract employee name from parsed text"""
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                return ent.text
        
        # Fallback: look for capitalized words at the beginning
        tokens = [token for token in doc if token.pos_ == "PROPN"]
        if tokens:
            return tokens[0].text
        
        return None
    
    def _determine_rule_type(self, doc) -> RuleType:
        """Determine the type of scheduling rule"""
        text = doc.text.lower()
        
        # Keywords for different rule types
        availability_keywords = ['can\'t', 'cannot', 'unavailable', 'off', 'away', 'leave']
        preference_keywords = ['prefer', 'like', 'want', 'would rather', 'favorite']
        requirement_keywords = ['must', 'need', 'require', 'should', 'minimum', 'at least']
        restriction_keywords = ['no more than', 'maximum', 'limit', 'restrict', 'cap']
        
        if any(keyword in text for keyword in availability_keywords):
            return RuleType.AVAILABILITY
        elif any(keyword in text for keyword in preference_keywords):
            return RuleType.PREFERENCE
        elif any(keyword in text for keyword in requirement_keywords):
            return RuleType.REQUIREMENT
        elif any(keyword in text for keyword in restriction_keywords):
            return RuleType.RESTRICTION
        
        return RuleType.REQUIREMENT
    
    def _extract_time_constraints(self, text: str) -> List[Dict[str, Any]]:
        """Extract time-based constraints from text"""
        constraints = []
        
        # Check for 12-hour format times
        for match in self.patterns['time_12h'].finditer(text):
            hour = int(match.group(1))
            minute = int(match.group(2) or 0)
            period = match.group(3).lower()
            
            if period == 'pm' and hour != 12:
                hour += 12
            elif period == 'am' and hour == 12:
                hour = 0
            
            constraints.append({
                'type': 'time',
                'value': f"{hour:02d}:{minute:02d}",
                'context': self._get_time_context(text, match.start())
            })
        
        # Check for 24-hour format times
        for match in self.patterns['time_24h'].finditer(text):
            hour = int(match.group(1))
            minute = int(match.group(2))
            
            constraints.append({
                'type': 'time',
                'value': f"{hour:02d}:{minute:02d}",
                'context': self._get_time_context(text, match.start())
            })
        
        # Check for military time (e.g., 1700)
        for match in self.patterns['time_military'].finditer(text):
            time_str = match.group(1)
            if len(time_str) == 4 and time_str.isdigit():
                hour = int(time_str[:2])
                minute = int(time_str[2:])
                if 0 <= hour <= 23 and 0 <= minute <= 59:
                    constraints.append({
                        'type': 'time',
                        'value': f"{hour:02d}:{minute:02d}",
                        'context': self._get_time_context(text, match.start())
                    })
        
        return constraints
    
    def _extract_day_constraints(self, text: str) -> List[Dict[str, Any]]:
        """Extract day-based constraints from text"""
        constraints = []
        
        # Extract specific days
        day_map = {
            'monday': 0, 'mon': 0,
            'tuesday': 1, 'tue': 1,
            'wednesday': 2, 'wed': 2,
            'thursday': 3, 'thu': 3,
            'friday': 4, 'fri': 4,
            'saturday': 5, 'sat': 5,
            'sunday': 6, 'sun': 6
        }
        
        for match in self.patterns['days'].finditer(text):
            day_text = match.group(0).lower().rstrip('s')
            if day_text in day_map:
                constraints.append({
                    'type': 'day',
                    'value': day_map[day_text],
                    'name': day_text
                })
        
        # Extract day ranges
        for match in self.patterns['day_ranges'].finditer(text):
            range_text = match.group(0).lower()
            if 'weekend' in range_text:
                constraints.append({
                    'type': 'day_range',
                    'value': [5, 6],  # Saturday, Sunday
                    'name': 'weekend'
                })
            elif 'weekday' in range_text:
                constraints.append({
                    'type': 'day_range',
                    'value': [0, 1, 2, 3, 4],  # Monday through Friday
                    'name': 'weekday'
                })
        
        return constraints
    
    def _extract_shift_preferences(self, doc) -> Dict[str, Any]:
        """Extract shift preference information"""
        preferences = {}
        text = doc.text.lower()
        
        # Time of day preferences
        if 'morning' in text:
            preferences['time_of_day'] = 'morning'
            preferences['preferred_hours'] = '06:00-12:00'
        elif 'afternoon' in text:
            preferences['time_of_day'] = 'afternoon'
            preferences['preferred_hours'] = '12:00-17:00'
        elif 'evening' in text:
            preferences['time_of_day'] = 'evening'
            preferences['preferred_hours'] = '17:00-22:00'
        elif 'night' in text or 'overnight' in text:
            preferences['time_of_day'] = 'night'
            preferences['preferred_hours'] = '22:00-06:00'
        
        # Shift length preferences
        if 'short shift' in text:
            preferences['shift_length'] = 'short'
            preferences['max_hours'] = 4
        elif 'long shift' in text:
            preferences['shift_length'] = 'long'
            preferences['min_hours'] = 8
        
        return preferences
    
    def _extract_staffing_requirements(self, doc) -> Dict[str, Any]:
        """Extract staffing level requirements"""
        requirements = {}
        text = doc.text.lower()
        
        # Look for numbers followed by people/staff/employees
        pattern = r'(\d+)\s*(?:people|staff|employees|workers)'
        matches = re.findall(pattern, text)
        
        if matches:
            requirements['minimum_staff'] = int(matches[0])
        
        # Look for "at least" or "minimum" patterns
        at_least_pattern = r'at\s+least\s+(\d+)'
        at_least_matches = re.findall(at_least_pattern, text)
        
        if at_least_matches:
            requirements['minimum_staff'] = int(at_least_matches[0])
        
        # Look for "no more than" or "maximum" patterns
        max_pattern = r'(?:no\s+more\s+than|maximum\s+of?)\s+(\d+)'
        max_matches = re.findall(max_pattern, text)
        
        if max_matches:
            requirements['maximum_staff'] = int(max_matches[0])
        
        return requirements
    
    def _get_time_context(self, text: str, position: int) -> str:
        """Determine if time is 'before', 'after', or 'at'"""
        before_pos = max(0, position - 20)
        context_text = text[before_pos:position].lower()
        
        if any(word in context_text for word in ['before', 'by', 'until']):
            return 'before'
        elif any(word in context_text for word in ['after', 'past', 'from']):
            return 'after'
        else:
            return 'at'
    
    def validate_constraint(self, constraint: Dict[str, Any]) -> bool:
        """Validate a parsed constraint for completeness and consistency"""
        required_fields = ['type', 'value']
        
        for field in required_fields:
            if field not in constraint:
                return False
        
        # Validate time constraints
        if constraint['type'] == 'time':
            try:
                time_parts = constraint['value'].split(':')
                hour = int(time_parts[0])
                minute = int(time_parts[1])
                if not (0 <= hour <= 23 and 0 <= minute <= 59):
                    return False
            except:
                return False
        
        # Validate day constraints
        elif constraint['type'] == 'day':
            if not (0 <= constraint['value'] <= 6):
                return False
        
        return True