"""
FastAPI middleware for automatic request/response serialization

This middleware automatically:
1. Converts incoming request bodies from camelCase to snake_case
2. Converts outgoing responses from snake_case to camelCase
"""

import json
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, StreamingResponse

from ..utils.serializers import deserialize_dict, serialize_dict


class SerializationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle automatic case conversion for API requests and responses.

    Converts:
    - Incoming request bodies: camelCase → snake_case
    - Outgoing responses: snake_case → camelCase
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and response with automatic serialization.

        Args:
            request: Incoming FastAPI request
            call_next: Next middleware in chain

        Returns:
            Response with serialized data
        """
        # Convert incoming request body from camelCase to snake_case
        if request.method in ["POST", "PUT", "PATCH"]:
            # Read the request body
            body = await request.body()

            if body:
                try:
                    # Parse JSON body
                    json_body = json.loads(body.decode("utf-8"))

                    # Convert camelCase to snake_case
                    converted_body = deserialize_dict(json_body)

                    # Store converted body for route handlers
                    request.state.converted_body = converted_body

                    # Re-encode as JSON
                    new_body = json.dumps(converted_body).encode("utf-8")

                    # Create new request with converted body
                    async def receive():
                        return {"type": "http.request", "body": new_body}

                    request._receive = receive
                except (json.JSONDecodeError, AttributeError):
                    # If not valid JSON or error occurs, pass through unchanged
                    pass

        # Process the request
        response = await call_next(request)

        # Convert outgoing response from snake_case to camelCase
        if isinstance(response, JSONResponse):
            # Get response body
            if hasattr(response, "body"):
                try:
                    # Decode response body
                    response_body = json.loads(response.body.decode("utf-8"))

                    # Convert snake_case to camelCase
                    converted_response = serialize_dict(response_body)

                    # Create new response with converted data
                    return JSONResponse(
                        content=converted_response, status_code=response.status_code, headers=dict(response.headers)
                    )
                except (json.JSONDecodeError, AttributeError):
                    # If error occurs, return original response
                    pass

        return response


class ModelSerializationMiddleware(BaseHTTPMiddleware):
    """
    Alternative middleware that uses model to_dict() methods for serialization.

    This middleware checks if response objects have a to_dict() method and uses it
    for serialization instead of generic dictionary conversion.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process response using model serialization methods.

        Args:
            request: Incoming FastAPI request
            call_next: Next middleware in chain

        Returns:
            Response with serialized model data
        """
        response = await call_next(request)

        # Only process JSON responses
        if isinstance(response, JSONResponse):
            if hasattr(response, "body"):
                try:
                    response_body = json.loads(response.body.decode("utf-8"))

                    # Convert response data
                    converted_response = self._serialize_response(response_body)

                    return JSONResponse(
                        content=converted_response, status_code=response.status_code, headers=dict(response.headers)
                    )
                except (json.JSONDecodeError, AttributeError):
                    pass

        return response

    def _serialize_response(self, data):
        """
        Recursively serialize response data using model to_dict() methods.

        Args:
            data: Response data to serialize

        Returns:
            Serialized response data
        """
        # Handle single model instance
        if hasattr(data, "to_dict"):
            return data.to_dict(camelCase=True)

        # Handle lists of model instances
        if isinstance(data, list):
            return [self._serialize_response(item) for item in data]

        # Handle dictionaries
        if isinstance(data, dict):
            result = {}
            for key, value in data.items():
                # Recursively serialize values
                if hasattr(value, "to_dict"):
                    result[key] = value.to_dict(camelCase=True)
                elif isinstance(value, (list, dict)):
                    result[key] = self._serialize_response(value)
                else:
                    result[key] = value

            # Convert dictionary keys to camelCase
            return serialize_dict(result)

        return data
