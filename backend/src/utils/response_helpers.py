"""
Helper functions for creating standardized API responses with camelCase formatting.
"""

from typing import Any, Dict, List, Union

from .serializers import serialize_dict, serialize_list


def to_camel_response(data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
    """
    Convert response data to camelCase format.

    Handles:
    - Model instances with to_dict() method
    - Dictionaries
    - Lists
    - Primitive types

    Args:
        data: Data to convert

    Returns:
        Data with camelCase keys
    """
    # Handle model instances
    if hasattr(data, 'to_dict') and callable(data.to_dict):
        return data.to_dict(camelCase=True)

    # Handle lists of model instances
    if isinstance(data, list):
        return [to_camel_response(item) for item in data]

    # Handle dictionaries
    if isinstance(data, dict):
        # Check if items are model instances
        result = {}
        for key, value in data.items():
            if hasattr(value, 'to_dict') and callable(value.to_dict):
                result[key] = value.to_dict(camelCase=True)
            elif isinstance(value, list):
                result[key] = [
                    item.to_dict(camelCase=True) if hasattr(item, 'to_dict') else item
                    for item in value
                ]
            elif isinstance(value, dict):
                result[key] = to_camel_response(value)
            else:
                result[key] = value

        return serialize_dict(result)

    # Return primitives as-is
    return data


def paginated_response(items: List[Any], total: int, page: int, size: int) -> Dict[str, Any]:
    """
    Create standardized paginated response with camelCase.

    Args:
        items: List of items (models or dicts)
        total: Total count of items
        page: Current page number
        size: Page size

    Returns:
        Paginated response dictionary with camelCase keys
    """
    # Convert items to camelCase
    camel_items = to_camel_response(items)

    response = {
        "items": camel_items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0,
    }

    return serialize_dict(response)


def success_response(message: str, data: Any = None) -> Dict[str, Any]:
    """
    Create standardized success response.

    Args:
        message: Success message
        data: Optional data payload

    Returns:
        Success response dictionary with camelCase keys
    """
    response = {"success": True, "message": message}

    if data is not None:
        response["data"] = to_camel_response(data)

    return serialize_dict(response)


def error_response(message: str, errors: List[str] = None, code: str = None) -> Dict[str, Any]:
    """
    Create standardized error response.

    Args:
        message: Error message
        errors: Optional list of detailed errors
        code: Optional error code

    Returns:
        Error response dictionary with camelCase keys
    """
    response = {
        "success": False,
        "message": message,
    }

    if errors:
        response["errors"] = errors

    if code:
        response["error_code"] = code

    return serialize_dict(response)
