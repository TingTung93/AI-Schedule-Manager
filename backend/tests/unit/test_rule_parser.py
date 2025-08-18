"""
Unit tests for the Natural Language Rule Parser.
Tests parsing of scheduling rules from plain English to structured constraints.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
import spacy
from datetime import datetime, time

from src.nlp.rule_parser import RuleParser, RuleType, TimePattern


class TestRuleParser:
    """Test suite for RuleParser class."""
    
    @pytest.fixture
    async def parser(self):
        """Create a RuleParser instance for testing."""
        parser = RuleParser()
        # Mock the spaCy model to avoid downloading in tests
        parser.nlp = Mock()
        parser.nlp.return_value = Mock(
            text="test rule",
            ents=[],
            lower=Mock(return_value="test rule")
        )
        return parser
    
    @pytest.fixture
    def mock_spacy_doc(self):
        """Create a mock spaCy doc object."""
        doc = Mock()
        doc.text = "John can't work past 5pm on weekdays"
        doc.ents = [Mock(label_="PERSON", text="John")]
        doc.__iter__ = Mock(return_value=iter([]))
        return doc

    def test_rule_type_enum(self):
        """Test RuleType enum values."""
        assert RuleType.AVAILABILITY.value == "availability"
        assert RuleType.PREFERENCE.value == "preference"
        assert RuleType.REQUIREMENT.value == "requirement"
        assert RuleType.RESTRICTION.value == "restriction"

    def test_time_pattern_regex(self):
        """Test TimePattern regex patterns."""
        import re
        
        # Test 12-hour time pattern
        pattern_12h = re.compile(TimePattern.TIME_12H, re.IGNORECASE)
        assert pattern_12h.search("5pm")
        assert pattern_12h.search("11:30am")
        assert pattern_12h.search("12:00PM")
        
        # Test days pattern
        pattern_days = re.compile(TimePattern.DAYS, re.IGNORECASE)
        assert pattern_days.search("Monday")
        assert pattern_days.search("weekdays")
        assert pattern_days.search("Fridays")

    async def test_initialize_loads_spacy_model(self):
        """Test that initialize loads the spaCy model."""
        parser = RuleParser()
        
        with patch('spacy.load') as mock_load:
            mock_load.return_value = Mock()
            await parser.initialize()
            mock_load.assert_called_once_with("en_core_web_sm")
            assert parser.nlp is not None

    async def test_parse_rule_basic(self, parser):
        """Test basic rule parsing."""
        with patch.object(parser, 'nlp') as mock_nlp:
            mock_doc = Mock()
            mock_doc.text = "test rule"
            mock_doc.ents = []
            mock_doc.__iter__ = Mock(return_value=iter([]))
            mock_nlp.return_value = mock_doc
            
            result = parser.parse_rule("Test rule")
            
            assert result['original_text'] == "Test rule"
            assert 'rule_type' in result
            assert 'constraints' in result
            assert 'metadata' in result

    def test_extract_employee_from_entity(self, parser):
        """Test extracting employee name from named entity."""
        doc = Mock()
        doc.ents = [Mock(label_="PERSON", text="Sarah")]
        doc.__iter__ = Mock(return_value=iter([]))
        
        employee = parser._extract_employee(doc)
        assert employee == "sarah"

    def test_extract_employee_from_proper_noun(self, parser):
        """Test extracting employee name from proper noun."""
        doc = Mock()
        doc.ents = []
        token = Mock(pos_="PROPN", text="Mike")
        doc.__iter__ = Mock(return_value=iter([token]))
        
        employee = parser._extract_employee(doc)
        assert employee == "mike"

    def test_extract_employee_no_name(self, parser):
        """Test when no employee name is found."""
        doc = Mock()
        doc.ents = []
        doc.__iter__ = Mock(return_value=iter([]))
        
        employee = parser._extract_employee(doc)
        assert employee is None

    def test_determine_rule_type_availability(self, parser):
        """Test determining availability rule type."""
        doc = Mock(text="John can't work on Mondays")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.AVAILABILITY
        
        doc = Mock(text="Sarah is unavailable after 5pm")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.AVAILABILITY

    def test_determine_rule_type_preference(self, parser):
        """Test determining preference rule type."""
        doc = Mock(text="Mike prefers morning shifts")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.PREFERENCE
        
        doc = Mock(text="Jane would rather work weekends")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.PREFERENCE

    def test_determine_rule_type_requirement(self, parser):
        """Test determining requirement rule type."""
        doc = Mock(text="We need at least 3 people")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.REQUIREMENT
        
        doc = Mock(text="Must have minimum 2 staff")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.REQUIREMENT

    def test_determine_rule_type_restriction(self, parser):
        """Test determining restriction rule type."""
        doc = Mock(text="No more than 40 hours per week")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.RESTRICTION
        
        doc = Mock(text="Maximum 8 hour shifts")
        rule_type = parser._determine_rule_type(doc)
        assert rule_type == RuleType.RESTRICTION

    def test_extract_time_constraints_12h(self, parser):
        """Test extracting 12-hour format time constraints."""
        text = "Can't work past 5pm on weekdays"
        constraints = parser._extract_time_constraints(text)
        
        assert len(constraints) > 0
        assert constraints[0]['type'] == 'time'
        assert constraints[0]['value'] == '17:00'
        assert constraints[0]['context'] == 'after'

    def test_extract_time_constraints_24h(self, parser):
        """Test extracting 24-hour format time constraints."""
        text = "Shift starts at 09:00"
        constraints = parser._extract_time_constraints(text)
        
        assert len(constraints) > 0
        assert constraints[0]['type'] == 'time'
        assert constraints[0]['value'] == '09:00'

    def test_extract_time_constraints_military(self, parser):
        """Test extracting military time format."""
        text = "Meeting at 1430 hours"
        constraints = parser._extract_time_constraints(text)
        
        assert len(constraints) > 0
        assert constraints[0]['type'] == 'time'
        assert constraints[0]['value'] == '14:30'

    def test_extract_day_constraints_specific_days(self, parser):
        """Test extracting specific day constraints."""
        text = "Can't work on Monday and Friday"
        constraints = parser._extract_day_constraints(text)
        
        assert len(constraints) == 2
        assert constraints[0]['type'] == 'day'
        assert constraints[0]['value'] == 0  # Monday
        assert constraints[1]['value'] == 4  # Friday

    def test_extract_day_constraints_ranges(self, parser):
        """Test extracting day range constraints."""
        text = "Available on weekends only"
        constraints = parser._extract_day_constraints(text)
        
        assert len(constraints) > 0
        assert constraints[0]['type'] == 'day_range'
        assert constraints[0]['value'] == [5, 6]  # Saturday, Sunday
        assert constraints[0]['name'] == 'weekend'

    def test_extract_shift_preferences_time_of_day(self, parser):
        """Test extracting shift time preferences."""
        doc = Mock(text="Prefers morning shifts")
        prefs = parser._extract_shift_preferences(doc)
        
        assert prefs['time_of_day'] == 'morning'
        assert prefs['preferred_hours'] == '06:00-12:00'

    def test_extract_shift_preferences_shift_length(self, parser):
        """Test extracting shift length preferences."""
        doc = Mock(text="Prefers short shifts")
        prefs = parser._extract_shift_preferences(doc)
        
        assert prefs['shift_length'] == 'short'
        assert prefs['max_hours'] == 4

    def test_extract_staffing_requirements_minimum(self, parser):
        """Test extracting minimum staffing requirements."""
        doc = Mock(text="Need at least 5 people during lunch")
        reqs = parser._extract_staffing_requirements(doc)
        
        assert reqs['minimum_staff'] == 5

    def test_extract_staffing_requirements_maximum(self, parser):
        """Test extracting maximum staffing requirements."""
        doc = Mock(text="No more than 10 staff per shift")
        reqs = parser._extract_staffing_requirements(doc)
        
        assert reqs['maximum_staff'] == 10

    def test_get_time_context_before(self, parser):
        """Test determining 'before' time context."""
        text = "Must leave before 5pm"
        position = text.find("5pm")
        context = parser._get_time_context(text, position)
        assert context == 'before'

    def test_get_time_context_after(self, parser):
        """Test determining 'after' time context."""
        text = "Available after 2pm"
        position = text.find("2pm")
        context = parser._get_time_context(text, position)
        assert context == 'after'

    def test_validate_constraint_valid_time(self, parser):
        """Test validating a valid time constraint."""
        constraint = {
            'type': 'time',
            'value': '14:30'
        }
        assert parser.validate_constraint(constraint) is True

    def test_validate_constraint_invalid_time(self, parser):
        """Test validating an invalid time constraint."""
        constraint = {
            'type': 'time',
            'value': '25:00'  # Invalid hour
        }
        assert parser.validate_constraint(constraint) is False

    def test_validate_constraint_valid_day(self, parser):
        """Test validating a valid day constraint."""
        constraint = {
            'type': 'day',
            'value': 3  # Wednesday
        }
        assert parser.validate_constraint(constraint) is True

    def test_validate_constraint_invalid_day(self, parser):
        """Test validating an invalid day constraint."""
        constraint = {
            'type': 'day',
            'value': 7  # Invalid day
        }
        assert parser.validate_constraint(constraint) is False

    def test_validate_constraint_missing_fields(self, parser):
        """Test validating constraint with missing required fields."""
        constraint = {
            'type': 'time'
            # Missing 'value' field
        }
        assert parser.validate_constraint(constraint) is False

    @pytest.mark.parametrize("rule_text,expected_type", [
        ("John can't work weekends", RuleType.AVAILABILITY),
        ("Sarah prefers morning shifts", RuleType.PREFERENCE),
        ("Need minimum 3 staff", RuleType.REQUIREMENT),
        ("Maximum 40 hours per week", RuleType.RESTRICTION),
    ])
    def test_parse_rule_integration(self, parser, rule_text, expected_type):
        """Integration test for complete rule parsing."""
        with patch.object(parser, 'nlp') as mock_nlp:
            mock_doc = Mock()
            mock_doc.text = rule_text.lower()
            mock_doc.ents = []
            mock_doc.__iter__ = Mock(return_value=iter([]))
            mock_nlp.return_value = mock_doc
            
            result = parser.parse_rule(rule_text)
            
            assert result['original_text'] == rule_text
            assert result['rule_type'] == expected_type
            assert isinstance(result['constraints'], list)
            assert isinstance(result['metadata'], dict)


class TestTimePatternClass:
    """Test the TimePattern class patterns."""
    
    def test_time_patterns_are_valid_regex(self):
        """Test that all time patterns compile as valid regex."""
        import re
        
        patterns = [
            TimePattern.TIME_12H,
            TimePattern.TIME_24H,
            TimePattern.TIME_MILITARY,
            TimePattern.DAYS,
            TimePattern.DAY_RANGES,
            TimePattern.RELATIVE_TIME
        ]
        
        for pattern in patterns:
            # Should not raise an exception
            compiled = re.compile(pattern, re.IGNORECASE)
            assert compiled is not None