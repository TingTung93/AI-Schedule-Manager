"""
Integration tests for data transformation utilities.

Tests cover:
- snake_case to camelCase conversion
- camelCase to snake_case conversion
- Nested object handling
- Array of objects handling
- Null/undefined preservation
- Model serialization
"""

import pytest
from src.utils.serializers import (
    to_camel_case,
    to_snake_case,
    serialize_dict,
    serialize_list,
    deserialize_dict,
    deserialize_list,
    serialize_model,
    serialize_response
)


class TestDataTransformation:
    """Integration tests for data transformation utilities."""

    def test_snake_to_camel_case_simple(self):
        """Test simple snake_case to camelCase conversion."""
        test_cases = [
            ("first_name", "firstName"),
            ("last_name", "lastName"),
            ("created_at", "createdAt"),
            ("updated_at", "updatedAt"),
            ("employee_id", "employeeId"),
            ("hourly_rate", "hourlyRate"),
            ("max_hours_per_week", "maxHoursPerWeek"),
        ]

        for snake, expected_camel in test_cases:
            result = to_camel_case(snake)
            assert result == expected_camel, f"Expected {expected_camel}, got {result}"

    def test_camel_to_snake_case_simple(self):
        """Test simple camelCase to snake_case conversion."""
        test_cases = [
            ("firstName", "first_name"),
            ("lastName", "last_name"),
            ("createdAt", "created_at"),
            ("updatedAt", "updated_at"),
            ("employeeId", "employee_id"),
            ("hourlyRate", "hourly_rate"),
            ("maxHoursPerWeek", "max_hours_per_week"),
        ]

        for camel, expected_snake in test_cases:
            result = to_snake_case(camel)
            assert result == expected_snake, f"Expected {expected_snake}, got {result}"

    def test_preserve_private_attributes(self):
        """Test that private attributes (starting with _) are preserved."""
        assert to_camel_case("_private_field") == "_private_field"
        assert to_snake_case("_privateField") == "_privateField"

    def test_empty_string_handling(self):
        """Test empty string handling."""
        assert to_camel_case("") == ""
        assert to_snake_case("") == ""
        assert to_camel_case(None) is None
        assert to_snake_case(None) is None

    def test_serialize_dict_simple(self):
        """Test serializing simple dictionary to camelCase."""
        input_data = {
            "first_name": "John",
            "last_name": "Doe",
            "email_address": "john.doe@example.com",
            "phone_number": "+1234567890"
        }

        expected = {
            "firstName": "John",
            "lastName": "Doe",
            "emailAddress": "john.doe@example.com",
            "phoneNumber": "+1234567890"
        }

        result = serialize_dict(input_data)
        assert result == expected

    def test_serialize_nested_dict(self):
        """Test serializing nested dictionaries."""
        input_data = {
            "employee_name": "John Doe",
            "contact_info": {
                "email_address": "john@example.com",
                "phone_number": "+1234567890"
            },
            "department_details": {
                "department_id": 1,
                "department_name": "Engineering",
                "manager_info": {
                    "manager_id": 10,
                    "manager_name": "Jane Smith"
                }
            }
        }

        result = serialize_dict(input_data)

        assert result["employeeName"] == "John Doe"
        assert result["contactInfo"]["emailAddress"] == "john@example.com"
        assert result["contactInfo"]["phoneNumber"] == "+1234567890"
        assert result["departmentDetails"]["departmentId"] == 1
        assert result["departmentDetails"]["managerInfo"]["managerId"] == 10

    def test_serialize_list_of_dicts(self):
        """Test serializing list containing dictionaries."""
        input_data = [
            {"employee_id": 1, "first_name": "John", "last_name": "Doe"},
            {"employee_id": 2, "first_name": "Jane", "last_name": "Smith"},
            {"employee_id": 3, "first_name": "Bob", "last_name": "Johnson"}
        ]

        result = serialize_list(input_data)

        assert len(result) == 3
        assert result[0]["employeeId"] == 1
        assert result[0]["firstName"] == "John"
        assert result[1]["employeeId"] == 2
        assert result[2]["lastName"] == "Johnson"

    def test_serialize_mixed_nested_structures(self):
        """Test serializing complex nested structures with lists and dicts."""
        input_data = {
            "company_name": "Tech Corp",
            "departments": [
                {
                    "department_id": 1,
                    "department_name": "Engineering",
                    "employees": [
                        {"employee_id": 1, "full_name": "John Doe"},
                        {"employee_id": 2, "full_name": "Jane Smith"}
                    ]
                },
                {
                    "department_id": 2,
                    "department_name": "Marketing",
                    "employees": [
                        {"employee_id": 3, "full_name": "Bob Johnson"}
                    ]
                }
            ]
        }

        result = serialize_dict(input_data)

        assert result["companyName"] == "Tech Corp"
        assert len(result["departments"]) == 2
        assert result["departments"][0]["departmentId"] == 1
        assert result["departments"][0]["employees"][0]["employeeId"] == 1
        assert result["departments"][0]["employees"][0]["fullName"] == "John Doe"
        assert result["departments"][1]["employees"][0]["fullName"] == "Bob Johnson"

    def test_deserialize_dict_simple(self):
        """Test deserializing camelCase dictionary to snake_case."""
        input_data = {
            "firstName": "John",
            "lastName": "Doe",
            "emailAddress": "john.doe@example.com",
            "phoneNumber": "+1234567890"
        }

        expected = {
            "first_name": "John",
            "last_name": "Doe",
            "email_address": "john.doe@example.com",
            "phone_number": "+1234567890"
        }

        result = deserialize_dict(input_data)
        assert result == expected

    def test_deserialize_nested_dict(self):
        """Test deserializing nested camelCase dictionaries."""
        input_data = {
            "employeeName": "John Doe",
            "contactInfo": {
                "emailAddress": "john@example.com",
                "phoneNumber": "+1234567890"
            },
            "departmentDetails": {
                "departmentId": 1,
                "departmentName": "Engineering"
            }
        }

        result = deserialize_dict(input_data)

        assert result["employee_name"] == "John Doe"
        assert result["contact_info"]["email_address"] == "john@example.com"
        assert result["department_details"]["department_id"] == 1

    def test_deserialize_list_of_dicts(self):
        """Test deserializing list of camelCase dictionaries."""
        input_data = [
            {"employeeId": 1, "firstName": "John", "lastName": "Doe"},
            {"employeeId": 2, "firstName": "Jane", "lastName": "Smith"}
        ]

        result = deserialize_list(input_data)

        assert len(result) == 2
        assert result[0]["employee_id"] == 1
        assert result[0]["first_name"] == "John"
        assert result[1]["last_name"] == "Smith"

    def test_null_and_none_preservation(self):
        """Test that null/None values are preserved during transformation."""
        input_data = {
            "first_name": "John",
            "middle_name": None,
            "last_name": "Doe",
            "phone": None,
            "email": "john@example.com"
        }

        result = serialize_dict(input_data)

        assert result["firstName"] == "John"
        assert result["middleName"] is None
        assert result["lastName"] == "Doe"
        assert result["phone"] is None
        assert result["email"] == "john@example.com"

    def test_preserve_non_string_types(self):
        """Test that non-string types are preserved."""
        input_data = {
            "employee_id": 123,
            "hourly_rate": 45.50,
            "is_active": True,
            "skills": ["Python", "JavaScript", "SQL"],
            "total_hours": 0,
            "metadata": {"key": "value"}
        }

        result = serialize_dict(input_data)

        assert result["employeeId"] == 123
        assert result["hourlyRate"] == 45.50
        assert result["isActive"] is True
        assert result["skills"] == ["Python", "JavaScript", "SQL"]
        assert result["totalHours"] == 0
        assert isinstance(result["metadata"], dict)

    def test_empty_collections_handling(self):
        """Test handling of empty lists and dictionaries."""
        input_data = {
            "empty_list": [],
            "empty_dict": {},
            "nested_empty": {
                "empty_array": [],
                "empty_object": {}
            }
        }

        result = serialize_dict(input_data)

        assert result["emptyList"] == []
        assert result["emptyDict"] == {}
        assert result["nestedEmpty"]["emptyArray"] == []
        assert result["nestedEmpty"]["emptyObject"] == {}

    def test_array_of_primitives_preservation(self):
        """Test that arrays of primitive types are preserved."""
        input_data = {
            "numbers": [1, 2, 3, 4, 5],
            "strings": ["a", "b", "c"],
            "booleans": [True, False, True],
            "mixed": [1, "two", True, None]
        }

        result = serialize_dict(input_data)

        assert result["numbers"] == [1, 2, 3, 4, 5]
        assert result["strings"] == ["a", "b", "c"]
        assert result["booleans"] == [True, False, True]
        assert result["mixed"] == [1, "two", True, None]

    def test_round_trip_transformation(self):
        """Test that data can be transformed back and forth without loss."""
        original_snake = {
            "employee_id": 1,
            "first_name": "John",
            "last_name": "Doe",
            "contact_info": {
                "email_address": "john@example.com",
                "phone_number": "+1234567890"
            },
            "skills": ["Python", "JavaScript"],
            "is_active": True,
            "hourly_rate": 45.50
        }

        # snake -> camel -> snake
        camel = serialize_dict(original_snake)
        back_to_snake = deserialize_dict(camel)

        assert original_snake == back_to_snake

    def test_serialize_response_with_dict(self):
        """Test serialize_response with dictionary input."""
        input_data = {
            "employee_id": 1,
            "first_name": "John"
        }

        result = serialize_response(input_data)

        assert result["employeeId"] == 1
        assert result["firstName"] == "John"

    def test_serialize_response_with_list(self):
        """Test serialize_response with list input."""
        input_data = [
            {"employee_id": 1, "first_name": "John"},
            {"employee_id": 2, "first_name": "Jane"}
        ]

        result = serialize_response(input_data)

        assert len(result) == 2
        assert result[0]["employeeId"] == 1
        assert result[1]["firstName"] == "Jane"

    def test_serialize_response_with_primitive(self):
        """Test serialize_response with primitive values."""
        assert serialize_response("string") == "string"
        assert serialize_response(123) == 123
        assert serialize_response(True) is True
        assert serialize_response(None) is None

    def test_special_characters_in_keys(self):
        """Test handling of keys with special characters."""
        input_data = {
            "employee_name": "John",
            "email_2": "john@example.com",
            "phone_no_1": "+1234567890"
        }

        result = serialize_dict(input_data)

        assert "employeeName" in result
        assert "email2" in result
        assert "phoneNo1" in result

    def test_unicode_string_preservation(self):
        """Test that Unicode strings are preserved correctly."""
        input_data = {
            "first_name": "José",
            "last_name": "García",
            "city_name": "São Paulo",
            "notes": "Employé français"
        }

        result = serialize_dict(input_data)

        assert result["firstName"] == "José"
        assert result["lastName"] == "García"
        assert result["cityName"] == "São Paulo"
        assert result["notes"] == "Employé français"

    def test_datetime_like_strings_preservation(self):
        """Test that datetime-like strings are preserved."""
        input_data = {
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-16T14:45:30.123Z",
            "birth_date": "1990-05-15"
        }

        result = serialize_dict(input_data)

        assert result["createdAt"] == "2024-01-15T10:30:00Z"
        assert result["updatedAt"] == "2024-01-16T14:45:30.123Z"
        assert result["birthDate"] == "1990-05-15"

    def test_deeply_nested_structures(self):
        """Test handling of deeply nested structures (5+ levels)."""
        input_data = {
            "level_1": {
                "level_2": {
                    "level_3": {
                        "level_4": {
                            "level_5": {
                                "deep_value": "found",
                                "deep_number": 12345
                            }
                        }
                    }
                }
            }
        }

        result = serialize_dict(input_data)

        assert result["level1"]["level2"]["level3"]["level4"]["level5"]["deepValue"] == "found"
        assert result["level1"]["level2"]["level3"]["level4"]["level5"]["deepNumber"] == 12345

    def test_large_array_transformation(self):
        """Test transformation performance with large arrays."""
        # Create array with 1000 items
        input_data = {
            "employees": [
                {"employee_id": i, "first_name": f"Employee{i}"}
                for i in range(1000)
            ]
        }

        result = serialize_dict(input_data)

        assert len(result["employees"]) == 1000
        assert result["employees"][0]["employeeId"] == 0
        assert result["employees"][999]["firstName"] == "Employee999"

    def test_transformation_with_exclude_fields(self):
        """Test serialize_model with field exclusion."""
        # This would test the serialize_model function with exclude parameter
        # Requires mock model object
        pass

    def test_bidirectional_consistency(self):
        """Test that serialize and deserialize are inverses."""
        test_cases = [
            {"simple_field": "value"},
            {"nested": {"inner_field": "value"}},
            {"array": [{"item_id": 1}, {"item_id": 2}]},
            {
                "complex": {
                    "nested_array": [
                        {"inner_id": 1, "inner_name": "test"}
                    ],
                    "nested_dict": {
                        "deep_field": "value"
                    }
                }
            }
        ]

        for test_case in test_cases:
            # snake -> camel -> snake should equal original
            serialized = serialize_dict(test_case)
            deserialized = deserialize_dict(serialized)
            assert test_case == deserialized

            # camel -> snake -> camel should equal original
            camel_case = serialize_dict(test_case)
            back_to_camel = serialize_dict(deserialize_dict(camel_case))
            assert camel_case == back_to_camel
