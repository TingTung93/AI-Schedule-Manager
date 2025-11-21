"""
Serialization utilities for converting between snake_case (Python) and camelCase (JavaScript)

This module provides functions and decorators to automatically transform API responses
and requests to maintain consistent naming conventions across frontend and backend.
"""

import re
from functools import wraps
from typing import Any, Dict, List, Union


def to_camel_case(snake_str: str) -> str:
    """
    Convert snake_case string to camelCase.

    Args:
        snake_str: String in snake_case format

    Returns:
        String converted to camelCase

    Examples:
        >>> to_camel_case("first_name")
        'firstName'
        >>> to_camel_case("created_at")
        'createdAt'
        >>> to_camel_case("employee_id")
        'employeeId'
    """
    if not snake_str:
        return snake_str

    # Handle private attributes (leading underscore)
    if snake_str.startswith('_'):
        return snake_str

    components = snake_str.split('_')
    # Keep first component as-is, capitalize subsequent components
    return components[0] + ''.join(word.capitalize() for word in components[1:])


def to_snake_case(camel_str: str) -> str:
    """
    Convert camelCase string to snake_case.

    Args:
        camel_str: String in camelCase format

    Returns:
        String converted to snake_case

    Examples:
        >>> to_snake_case("firstName")
        'first_name'
        >>> to_snake_case("createdAt")
        'created_at'
        >>> to_snake_case("employeeId")
        'employee_id'
    """
    if not camel_str:
        return camel_str

    # Handle private attributes (leading underscore)
    if camel_str.startswith('_'):
        return camel_str

    # Insert underscore before uppercase letters and convert to lowercase
    snake_str = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', camel_str)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', snake_str).lower()


def serialize_dict(data: Dict[str, Any], convert_keys: bool = True) -> Dict[str, Any]:
    """
    Recursively convert dictionary keys from snake_case to camelCase.

    Args:
        data: Dictionary with snake_case keys
        convert_keys: Whether to convert the keys (default: True)

    Returns:
        Dictionary with camelCase keys

    Examples:
        >>> serialize_dict({"first_name": "John", "last_name": "Doe"})
        {'firstName': 'John', 'lastName': 'Doe'}
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        # Convert key to camelCase
        new_key = to_camel_case(key) if convert_keys else key

        # Recursively process nested structures
        if isinstance(value, dict):
            result[new_key] = serialize_dict(value, convert_keys)
        elif isinstance(value, list):
            result[new_key] = serialize_list(value, convert_keys)
        else:
            result[new_key] = value

    return result


def serialize_list(data: List[Any], convert_keys: bool = True) -> List[Any]:
    """
    Recursively convert list items containing dicts from snake_case to camelCase.

    Args:
        data: List containing dictionaries or other items
        convert_keys: Whether to convert the keys (default: True)

    Returns:
        List with camelCase dictionary keys
    """
    if not isinstance(data, list):
        return data

    result = []
    for item in data:
        if isinstance(item, dict):
            result.append(serialize_dict(item, convert_keys))
        elif isinstance(item, list):
            result.append(serialize_list(item, convert_keys))
        else:
            result.append(item)

    return result


def deserialize_dict(data: Dict[str, Any], convert_keys: bool = True) -> Dict[str, Any]:
    """
    Recursively convert dictionary keys from camelCase to snake_case.

    Args:
        data: Dictionary with camelCase keys
        convert_keys: Whether to convert the keys (default: True)

    Returns:
        Dictionary with snake_case keys

    Examples:
        >>> deserialize_dict({"firstName": "John", "lastName": "Doe"})
        {'first_name': 'John', 'last_name': 'Doe'}
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        # Convert key to snake_case
        new_key = to_snake_case(key) if convert_keys else key

        # Recursively process nested structures
        if isinstance(value, dict):
            result[new_key] = deserialize_dict(value, convert_keys)
        elif isinstance(value, list):
            result[new_key] = deserialize_list(value, convert_keys)
        else:
            result[new_key] = value

    return result


def deserialize_list(data: List[Any], convert_keys: bool = True) -> List[Any]:
    """
    Recursively convert list items containing dicts from camelCase to snake_case.

    Args:
        data: List containing dictionaries or other items
        convert_keys: Whether to convert the keys (default: True)

    Returns:
        List with snake_case dictionary keys
    """
    if not isinstance(data, list):
        return data

    result = []
    for item in data:
        if isinstance(item, dict):
            result.append(deserialize_dict(item, convert_keys))
        elif isinstance(item, list):
            result.append(deserialize_list(item, convert_keys))
        else:
            result.append(item)

    return result


def serialize_model(obj: Any, exclude: List[str] = None) -> Dict[str, Any]:
    """
    Convert SQLAlchemy model instance to camelCase dictionary.

    Args:
        obj: SQLAlchemy model instance
        exclude: List of fields to exclude from serialization

    Returns:
        Dictionary with camelCase keys

    Examples:
        >>> employee = Employee(first_name="John", last_name="Doe")
        >>> serialize_model(employee)
        {'firstName': 'John', 'lastName': 'Doe'}
    """
    if obj is None:
        return None

    exclude = exclude or []

    # Check if object has a to_dict method
    if hasattr(obj, 'to_dict') and callable(obj.to_dict):
        data = obj.to_dict()
        # Filter excluded fields
        return serialize_dict({k: v for k, v in data.items() if k not in exclude})

    # Fallback: Use SQLAlchemy inspection
    from sqlalchemy import inspect

    data = {}
    mapper = inspect(obj.__class__)

    for column in mapper.columns:
        if column.name not in exclude and not column.name.startswith('_'):
            value = getattr(obj, column.name)

            # Handle datetime serialization
            if hasattr(value, 'isoformat'):
                value = value.isoformat()

            data[column.name] = value

    return serialize_dict(data)


def serialize_response(data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
    """
    Serialize any response data to camelCase format.

    Handles dictionaries, lists, and model instances.

    Args:
        data: Response data to serialize

    Returns:
        Serialized data with camelCase keys
    """
    if isinstance(data, dict):
        return serialize_dict(data)
    elif isinstance(data, list):
        return serialize_list(data)
    elif hasattr(data, '__dict__'):
        # Handle model instances
        return serialize_model(data)
    else:
        return data


def camelcase_response(func):
    """
    Decorator to automatically convert endpoint response to camelCase.

    Usage:
        @app.get("/api/employees")
        @camelcase_response
        async def get_employees():
            return {"employee_name": "John", "employee_id": 1}
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        result = await func(*args, **kwargs)
        return serialize_response(result)
    return wrapper


def snakecase_request(func):
    """
    Decorator to automatically convert incoming request data to snake_case.

    Usage:
        @app.post("/api/employees")
        @snakecase_request
        async def create_employee(data: dict):
            # data will have snake_case keys
            print(data["employee_name"])
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Find dictionary arguments and convert them
        new_kwargs = {}
        for key, value in kwargs.items():
            if isinstance(value, dict):
                new_kwargs[key] = deserialize_dict(value)
            elif isinstance(value, list):
                new_kwargs[key] = deserialize_list(value)
            else:
                new_kwargs[key] = value

        return await func(*args, **new_kwargs)
    return wrapper
