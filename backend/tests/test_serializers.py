"""
Tests for serialization utilities

Tests the conversion between snake_case (Python) and camelCase (JavaScript)
for API request/response transformation.
"""

import pytest
from datetime import datetime, date, time

from backend.src.utils.serializers import (
    to_camel_case,
    to_snake_case,
    serialize_dict,
    serialize_list,
    deserialize_dict,
    deserialize_list,
    serialize_model,
    serialize_response,
)


class TestCaseConversion:
    """Test basic case conversion functions"""

    def test_to_camel_case_simple(self):
        """Test simple snake_case to camelCase conversion"""
        assert to_camel_case("first_name") == "firstName"
        assert to_camel_case("last_name") == "lastName"
        assert to_camel_case("employee_id") == "employeeId"

    def test_to_camel_case_multiple_words(self):
        """Test multi-word conversion"""
        assert to_camel_case("created_at_timestamp") == "createdAtTimestamp"
        assert to_camel_case("is_active_user") == "isActiveUser"
        assert to_camel_case("max_weekly_hours") == "maxWeeklyHours"

    def test_to_camel_case_already_camel(self):
        """Test that already camelCase strings pass through"""
        assert to_camel_case("firstName") == "firstName"
        assert to_camel_case("lastName") == "lastName"

    def test_to_camel_case_single_word(self):
        """Test single word (no conversion needed)"""
        assert to_camel_case("name") == "name"
        assert to_camel_case("id") == "id"
        assert to_camel_case("email") == "email"

    def test_to_camel_case_private_attribute(self):
        """Test that private attributes (leading underscore) are preserved"""
        assert to_camel_case("_private") == "_private"
        assert to_camel_case("_internal_value") == "_internal_value"

    def test_to_camel_case_empty_string(self):
        """Test empty string handling"""
        assert to_camel_case("") == ""
        assert to_camel_case(None) is None

    def test_to_snake_case_simple(self):
        """Test simple camelCase to snake_case conversion"""
        assert to_snake_case("firstName") == "first_name"
        assert to_snake_case("lastName") == "last_name"
        assert to_snake_case("employeeId") == "employee_id"

    def test_to_snake_case_multiple_words(self):
        """Test multi-word conversion"""
        assert to_snake_case("createdAtTimestamp") == "created_at_timestamp"
        assert to_snake_case("isActiveUser") == "is_active_user"
        assert to_snake_case("maxWeeklyHours") == "max_weekly_hours"

    def test_to_snake_case_already_snake(self):
        """Test that already snake_case strings pass through"""
        assert to_snake_case("first_name") == "first_name"
        assert to_snake_case("last_name") == "last_name"

    def test_to_snake_case_single_word(self):
        """Test single word (no conversion needed)"""
        assert to_snake_case("name") == "name"
        assert to_snake_case("id") == "id"
        assert to_snake_case("email") == "email"

    def test_to_snake_case_private_attribute(self):
        """Test that private attributes are preserved"""
        assert to_snake_case("_private") == "_private"
        assert to_snake_case("_internalValue") == "_internalValue"

    def test_to_snake_case_empty_string(self):
        """Test empty string handling"""
        assert to_snake_case("") == ""
        assert to_snake_case(None) is None

    def test_round_trip_conversion(self):
        """Test that conversion is reversible"""
        original = "employee_name"
        camel = to_camel_case(original)
        back_to_snake = to_snake_case(camel)
        assert back_to_snake == original


class TestDictionarySerialization:
    """Test dictionary serialization functions"""

    def test_serialize_dict_simple(self):
        """Test simple dictionary serialization"""
        input_dict = {"first_name": "John", "last_name": "Doe", "employee_id": 123}
        expected = {"firstName": "John", "lastName": "Doe", "employeeId": 123}
        assert serialize_dict(input_dict) == expected

    def test_serialize_dict_nested(self):
        """Test nested dictionary serialization"""
        input_dict = {"user_info": {"first_name": "John", "last_name": "Doe"}, "employee_id": 123}
        expected = {"userInfo": {"firstName": "John", "lastName": "Doe"}, "employeeId": 123}
        assert serialize_dict(input_dict) == expected

    def test_serialize_dict_with_list(self):
        """Test dictionary with list values"""
        input_dict = {
            "employee_name": "John",
            "qualifications": [{"skill_name": "Python", "level": "Expert"}],
        }
        expected = {
            "employeeName": "John",
            "qualifications": [{"skillName": "Python", "level": "Expert"}],
        }
        assert serialize_dict(input_dict) == expected

    def test_serialize_dict_preserve_none(self):
        """Test that None values are preserved"""
        input_dict = {"first_name": "John", "last_name": None, "middle_name": None}
        expected = {"firstName": "John", "lastName": None, "middleName": None}
        assert serialize_dict(input_dict) == expected

    def test_serialize_dict_no_conversion(self):
        """Test dictionary serialization without key conversion"""
        input_dict = {"first_name": "John", "last_name": "Doe"}
        result = serialize_dict(input_dict, convert_keys=False)
        assert result == input_dict

    def test_deserialize_dict_simple(self):
        """Test simple dictionary deserialization"""
        input_dict = {"firstName": "John", "lastName": "Doe", "employeeId": 123}
        expected = {"first_name": "John", "last_name": "Doe", "employee_id": 123}
        assert deserialize_dict(input_dict) == expected

    def test_deserialize_dict_nested(self):
        """Test nested dictionary deserialization"""
        input_dict = {"userInfo": {"firstName": "John", "lastName": "Doe"}, "employeeId": 123}
        expected = {"user_info": {"first_name": "John", "last_name": "Doe"}, "employee_id": 123}
        assert deserialize_dict(input_dict) == expected

    def test_deserialize_dict_with_list(self):
        """Test dictionary with list values deserialization"""
        input_dict = {
            "employeeName": "John",
            "qualifications": [{"skillName": "Python", "level": "Expert"}],
        }
        expected = {
            "employee_name": "John",
            "qualifications": [{"skill_name": "Python", "level": "Expert"}],
        }
        assert deserialize_dict(input_dict) == expected


class TestListSerialization:
    """Test list serialization functions"""

    def test_serialize_list_of_dicts(self):
        """Test serialization of list containing dictionaries"""
        input_list = [
            {"first_name": "John", "last_name": "Doe"},
            {"first_name": "Jane", "last_name": "Smith"},
        ]
        expected = [
            {"firstName": "John", "lastName": "Doe"},
            {"firstName": "Jane", "lastName": "Smith"},
        ]
        assert serialize_list(input_list) == expected

    def test_serialize_list_nested(self):
        """Test serialization of nested lists"""
        input_list = [
            {"employees": [{"first_name": "John"}, {"first_name": "Jane"}]},
        ]
        expected = [
            {"employees": [{"firstName": "John"}, {"firstName": "Jane"}]},
        ]
        assert serialize_list(input_list) == expected

    def test_serialize_list_mixed_types(self):
        """Test serialization of list with mixed types"""
        input_list = [
            {"first_name": "John"},
            "plain string",
            123,
            None,
        ]
        expected = [
            {"firstName": "John"},
            "plain string",
            123,
            None,
        ]
        assert serialize_list(input_list) == expected

    def test_deserialize_list_of_dicts(self):
        """Test deserialization of list containing dictionaries"""
        input_list = [
            {"firstName": "John", "lastName": "Doe"},
            {"firstName": "Jane", "lastName": "Smith"},
        ]
        expected = [
            {"first_name": "John", "last_name": "Doe"},
            {"first_name": "Jane", "last_name": "Smith"},
        ]
        assert deserialize_list(input_list) == expected


class TestComplexStructures:
    """Test serialization of complex nested structures"""

    def test_complex_nested_structure(self):
        """Test deeply nested structure serialization"""
        input_data = {
            "employee_info": {
                "personal_data": {"first_name": "John", "last_name": "Doe"},
                "work_schedule": [
                    {
                        "day_of_week": "Monday",
                        "time_slots": [{"start_time": "09:00", "end_time": "17:00"}],
                    }
                ],
            }
        }

        result = serialize_dict(input_data)

        assert result["employeeInfo"]["personalData"]["firstName"] == "John"
        assert result["employeeInfo"]["workSchedule"][0]["dayOfWeek"] == "Monday"
        assert result["employeeInfo"]["workSchedule"][0]["timeSlots"][0]["startTime"] == "09:00"

    def test_api_response_structure(self):
        """Test typical API response structure"""
        input_data = {
            "items": [
                {"employee_id": 1, "first_name": "John", "is_active": True},
                {"employee_id": 2, "first_name": "Jane", "is_active": False},
            ],
            "total": 2,
            "page": 1,
            "page_size": 10,
        }

        result = serialize_dict(input_data)

        assert result["pageSize"] == 10
        assert result["items"][0]["employeeId"] == 1
        assert result["items"][0]["firstName"] == "John"
        assert result["items"][0]["isActive"] is True


class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_empty_dict(self):
        """Test empty dictionary"""
        assert serialize_dict({}) == {}
        assert deserialize_dict({}) == {}

    def test_empty_list(self):
        """Test empty list"""
        assert serialize_list([]) == []
        assert deserialize_list([]) == []

    def test_non_dict_input_to_serialize_dict(self):
        """Test that non-dict input is returned as-is"""
        assert serialize_dict("string") == "string"
        assert serialize_dict(123) == 123
        assert serialize_dict(None) is None

    def test_non_list_input_to_serialize_list(self):
        """Test that non-list input is returned as-is"""
        assert serialize_list("string") == "string"
        assert serialize_list(123) == 123
        assert serialize_list(None) is None

    def test_unicode_keys(self):
        """Test handling of unicode in keys"""
        input_dict = {"employee_name": "José", "employee_role": "Développeur"}
        result = serialize_dict(input_dict)
        assert result["employeeName"] == "José"
        assert result["employeeRole"] == "Développeur"

    def test_special_characters_in_values(self):
        """Test that special characters in values are preserved"""
        input_dict = {"employee_email": "john+test@example.com", "employee_notes": "Line 1\nLine 2"}
        result = serialize_dict(input_dict)
        assert result["employeeEmail"] == "john+test@example.com"
        assert result["employeeNotes"] == "Line 1\nLine 2"


class TestSerializeResponse:
    """Test the generic serialize_response function"""

    def test_serialize_response_dict(self):
        """Test serialize_response with dictionary"""
        input_dict = {"first_name": "John", "last_name": "Doe"}
        result = serialize_response(input_dict)
        assert result == {"firstName": "John", "lastName": "Doe"}

    def test_serialize_response_list(self):
        """Test serialize_response with list"""
        input_list = [{"first_name": "John"}, {"first_name": "Jane"}]
        result = serialize_response(input_list)
        assert result == [{"firstName": "John"}, {"firstName": "Jane"}]

    def test_serialize_response_primitive(self):
        """Test serialize_response with primitive types"""
        assert serialize_response("string") == "string"
        assert serialize_response(123) == 123
        assert serialize_response(True) is True
        assert serialize_response(None) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
