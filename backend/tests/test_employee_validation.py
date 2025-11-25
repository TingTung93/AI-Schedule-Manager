"""
Test employee validation rules
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def test_validation():
    """Test validation without importing dependencies that require phonenumbers"""
    from pydantic import BaseModel, Field, field_validator, ConfigDict, ValidationError
    from typing import Optional
    import re

    # Recreate schema for testing
    class EmployeeCreateTest(BaseModel):
        first_name: str = Field(..., min_length=2, max_length=100, alias='firstName')
        last_name: str = Field(..., min_length=2, max_length=100, alias='lastName')
        email: Optional[str] = None
        department_id: Optional[int] = Field(None, alias='department', gt=0)

        model_config = ConfigDict(populate_by_name=True, extra='forbid')

        @field_validator('first_name')
        @classmethod
        def validate_first_name(cls, v):
            if not v:
                raise ValueError('First name is required and cannot be empty.')
            if not re.match(r"^[A-Za-z '-]+$", v):
                raise ValueError("First name must contain only letters, spaces, hyphens, and apostrophes. Numbers and special characters are not allowed.")
            return v.strip()

        @field_validator('last_name')
        @classmethod
        def validate_last_name(cls, v):
            if not v:
                raise ValueError('Last name is required and cannot be empty.')
            if not re.match(r"^[A-Za-z '-]+$", v):
                raise ValueError("Last name must contain only letters, spaces, hyphens, and apostrophes. Numbers and special characters are not allowed.")
            return v.strip()

    print("Testing validation rules...\n")

    # Test 1: Unknown field
    print("Test 1: Unknown field rejection")
    try:
        data = {'firstName': 'John', 'lastName': 'Doe', 'unknownField': 'test'}
        emp = EmployeeCreateTest(**data)
        print("  ❌ FAILED: Should have rejected unknown field")
    except ValidationError as e:
        errors = e.errors()
        if any('extra_forbidden' in str(err) for err in errors):
            print("  ✅ PASSED: Unknown field rejected")
            print(f"     Error: {errors[0]}")
        else:
            print(f"  ❌ FAILED: Wrong error type: {errors}")
    print()

    # Test 2: Invalid name with numbers
    print("Test 2: Name with numbers")
    try:
        data = {'firstName': 'John123', 'lastName': 'Doe'}
        emp = EmployeeCreateTest(**data)
        print("  ❌ FAILED: Should have rejected name with numbers")
    except ValidationError as e:
        errors = e.errors()
        error_msg = str(errors[0].get('ctx', {}).get('error', ''))
        if 'letters, spaces, hyphens' in error_msg:
            print("  ✅ PASSED: Name with numbers rejected")
            print(f"     Error message: {error_msg}")
        else:
            print(f"  ❌ FAILED: Wrong error message: {errors}")
    print()

    # Test 3: Name too short
    print("Test 3: Name too short")
    try:
        data = {'firstName': 'J', 'lastName': 'Doe'}
        emp = EmployeeCreateTest(**data)
        print("  ❌ FAILED: Should have rejected short name")
    except ValidationError as e:
        errors = e.errors()
        if any('string_too_short' in str(err) or 'min_length' in str(err) for err in errors):
            print("  ✅ PASSED: Short name rejected")
            print(f"     Error: {errors[0]}")
        else:
            print(f"  ❌ FAILED: Wrong error type: {errors}")
    print()

    # Test 4: Valid data
    print("Test 4: Valid employee data")
    try:
        data = {'firstName': 'John', 'lastName': "O'Brien-Smith"}
        emp = EmployeeCreateTest(**data)
        print("  ✅ PASSED: Valid data accepted")
        print(f"     Created: {emp.first_name} {emp.last_name}")
    except ValidationError as e:
        print(f"  ❌ FAILED: Should have accepted valid data: {e.errors()}")
    print()

    # Test 5: Names with special chars (valid)
    print("Test 5: Names with apostrophes and hyphens")
    try:
        data = {'firstName': "Mary-Jane", 'lastName': "O'Connor"}
        emp = EmployeeCreateTest(**data)
        print("  ✅ PASSED: Valid special characters accepted")
        print(f"     Created: {emp.first_name} {emp.last_name}")
    except ValidationError as e:
        print(f"  ❌ FAILED: Should have accepted valid special characters: {e.errors()}")
    print()

    print("All validation tests completed!")

if __name__ == '__main__':
    test_validation()
