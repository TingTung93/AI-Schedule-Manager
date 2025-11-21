"""
Comprehensive tests for middleware components.
Tests error handler, rate limiting, validation, and serialization middleware.

Coverage target: >80%
"""

import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, Request, Response, status
from httpx import AsyncClient

from backend.src.middleware.error_handler import error_handler_middleware
from backend.src.middleware.rate_limit import RateLimiter
from backend.src.middleware.validation import validate_request
from backend.src.middleware.validation_middleware import ValidationMiddleware


class TestErrorHandlerMiddleware:
    """Test error handling middleware."""

    @pytest.mark.asyncio
    async def test_handle_http_exception(self):
        """Test handling of HTTPException."""
        request = MagicMock(spec=Request)
        exc = HTTPException(status_code=404, detail="Resource not found")

        response = await error_handler_middleware(request, exc)

        assert response.status_code == 404
        data = json.loads(response.body)
        assert data["detail"] == "Resource not found"

    @pytest.mark.asyncio
    async def test_handle_validation_error(self):
        """Test handling of validation errors."""
        from pydantic import ValidationError

        request = MagicMock(spec=Request)

        # Create validation error
        try:
            from pydantic import BaseModel
            class TestModel(BaseModel):
                required_field: str
            TestModel(required_field=None)
        except ValidationError as exc:
            response = await error_handler_middleware(request, exc)

            assert response.status_code == 422
            data = json.loads(response.body)
            assert "detail" in data

    @pytest.mark.asyncio
    async def test_handle_database_error(self):
        """Test handling of database errors."""
        from sqlalchemy.exc import IntegrityError

        request = MagicMock(spec=Request)
        exc = IntegrityError("statement", "params", "orig")

        response = await error_handler_middleware(request, exc)

        assert response.status_code == 409
        data = json.loads(response.body)
        assert "database" in data["detail"].lower() or "integrity" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_handle_generic_exception(self):
        """Test handling of unexpected exceptions."""
        request = MagicMock(spec=Request)
        exc = Exception("Unexpected error")

        with patch('backend.src.middleware.error_handler.logger') as mock_logger:
            response = await error_handler_middleware(request, exc)

        assert response.status_code == 500
        data = json.loads(response.body)
        assert "internal server error" in data["detail"].lower()
        mock_logger.error.assert_called_once()

    @pytest.mark.asyncio
    async def test_error_logging(self):
        """Test that errors are properly logged."""
        request = MagicMock(spec=Request)
        request.url.path = "/api/test"
        request.method = "POST"
        exc = HTTPException(status_code=400, detail="Bad request")

        with patch('backend.src.middleware.error_handler.logger') as mock_logger:
            await error_handler_middleware(request, exc)

        mock_logger.error.assert_called()


class TestRateLimiter:
    """Test rate limiting middleware."""

    def setup_method(self):
        """Set up test fixtures."""
        self.limiter = RateLimiter(max_requests=5, window_seconds=60)

    @pytest.mark.asyncio
    async def test_allow_requests_within_limit(self):
        """Test requests within limit are allowed."""
        client_id = "test_client_1"

        # Make requests within limit
        for i in range(5):
            allowed = await self.limiter.check_rate_limit(client_id)
            assert allowed is True

    @pytest.mark.asyncio
    async def test_block_requests_exceeding_limit(self):
        """Test requests exceeding limit are blocked."""
        client_id = "test_client_2"

        # Make requests up to limit
        for i in range(5):
            await self.limiter.check_rate_limit(client_id)

        # Next request should be blocked
        allowed = await self.limiter.check_rate_limit(client_id)
        assert allowed is False

    @pytest.mark.asyncio
    async def test_rate_limit_reset_after_window(self):
        """Test rate limit resets after time window."""
        client_id = "test_client_3"

        # Exhaust rate limit
        for i in range(5):
            await self.limiter.check_rate_limit(client_id)

        # Verify blocked
        assert await self.limiter.check_rate_limit(client_id) is False

        # Simulate time passing
        with patch('time.time') as mock_time:
            mock_time.return_value = mock_time.return_value + 61  # Past window

            # Should be allowed again
            allowed = await self.limiter.check_rate_limit(client_id)
            assert allowed is True

    @pytest.mark.asyncio
    async def test_different_clients_separate_limits(self):
        """Test each client has separate rate limit."""
        client1 = "test_client_4"
        client2 = "test_client_5"

        # Exhaust limit for client1
        for i in range(5):
            await self.limiter.check_rate_limit(client1)

        # Client1 should be blocked
        assert await self.limiter.check_rate_limit(client1) is False

        # Client2 should still be allowed
        assert await self.limiter.check_rate_limit(client2) is True

    @pytest.mark.asyncio
    async def test_rate_limit_middleware_integration(self, client: AsyncClient):
        """Test rate limiting in actual requests."""
        # Make multiple requests rapidly
        responses = []
        for i in range(10):
            response = await client.get("/api/health")
            responses.append(response.status_code)

        # Should get rate limited
        assert 429 in responses

    @pytest.mark.asyncio
    async def test_rate_limit_headers(self, client: AsyncClient):
        """Test rate limit information in response headers."""
        response = await client.get("/api/health")

        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers


class TestValidationMiddleware:
    """Test request validation middleware."""

    @pytest.mark.asyncio
    async def test_validate_request_body(self):
        """Test validation of request body."""
        from pydantic import BaseModel

        class TestSchema(BaseModel):
            name: str
            age: int

        valid_data = {"name": "John", "age": 30}

        result = await validate_request(TestSchema, valid_data)
        assert result.name == "John"
        assert result.age == 30

    @pytest.mark.asyncio
    async def test_validation_fails_missing_field(self):
        """Test validation fails with missing required field."""
        from pydantic import BaseModel, ValidationError

        class TestSchema(BaseModel):
            required_field: str

        with pytest.raises(ValidationError):
            await validate_request(TestSchema, {})

    @pytest.mark.asyncio
    async def test_validation_fails_wrong_type(self):
        """Test validation fails with wrong field type."""
        from pydantic import BaseModel, ValidationError

        class TestSchema(BaseModel):
            age: int

        with pytest.raises(ValidationError):
            await validate_request(TestSchema, {"age": "not_an_int"})

    @pytest.mark.asyncio
    async def test_validation_strips_extra_fields(self):
        """Test validation removes extra fields."""
        from pydantic import BaseModel

        class TestSchema(BaseModel):
            name: str

        result = await validate_request(TestSchema, {
            "name": "John",
            "extra_field": "should_be_removed"
        })

        assert result.name == "John"
        assert not hasattr(result, "extra_field")

    @pytest.mark.asyncio
    async def test_validation_middleware_integration(self, client: AsyncClient):
        """Test validation middleware in actual request."""
        # Valid request
        response = await client.post("/api/employees", json={
            "email": "test@test.com",
            "first_name": "Test",
            "last_name": "User"
        })
        assert response.status_code in [200, 201, 401]  # May need auth

        # Invalid request (missing fields)
        response = await client.post("/api/employees", json={
            "email": "test@test.com"
            # Missing required fields
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_custom_validators(self):
        """Test custom field validators."""
        from pydantic import BaseModel, validator

        class TestSchema(BaseModel):
            email: str

            @validator('email')
            def validate_email(cls, v):
                if '@' not in v:
                    raise ValueError('Invalid email')
                return v

        # Valid email
        result = await validate_request(TestSchema, {"email": "test@test.com"})
        assert result.email == "test@test.com"

        # Invalid email
        with pytest.raises(Exception):
            await validate_request(TestSchema, {"email": "invalid"})


class TestSerializationMiddleware:
    """Test response serialization middleware."""

    @pytest.mark.asyncio
    async def test_serialize_datetime(self):
        """Test datetime serialization to ISO format."""
        from backend.src.middleware.serialization_middleware import serialize_response

        data = {
            "timestamp": datetime(2024, 1, 15, 10, 30, 0)
        }

        serialized = serialize_response(data)
        assert serialized["timestamp"] == "2024-01-15T10:30:00"

    @pytest.mark.asyncio
    async def test_serialize_nested_objects(self):
        """Test serialization of nested objects."""
        from backend.src.middleware.serialization_middleware import serialize_response

        data = {
            "user": {
                "name": "John",
                "created_at": datetime(2024, 1, 15)
            },
            "items": [
                {"id": 1, "date": datetime(2024, 1, 16)},
                {"id": 2, "date": datetime(2024, 1, 17)}
            ]
        }

        serialized = serialize_response(data)
        assert serialized["user"]["created_at"] == "2024-01-15T00:00:00"
        assert serialized["items"][0]["date"] == "2024-01-16T00:00:00"

    @pytest.mark.asyncio
    async def test_serialize_none_values(self):
        """Test handling of None values in serialization."""
        from backend.src.middleware.serialization_middleware import serialize_response

        data = {
            "name": "Test",
            "optional_field": None
        }

        serialized = serialize_response(data)
        assert serialized["name"] == "Test"
        assert serialized["optional_field"] is None

    @pytest.mark.asyncio
    async def test_serialize_decimal_values(self):
        """Test serialization of Decimal values."""
        from decimal import Decimal
        from backend.src.middleware.serialization_middleware import serialize_response

        data = {
            "price": Decimal("99.99"),
            "tax": Decimal("7.50")
        }

        serialized = serialize_response(data)
        assert serialized["price"] == 99.99
        assert serialized["tax"] == 7.50


class TestCSRFProtection:
    """Test CSRF protection middleware."""

    @pytest.mark.asyncio
    async def test_csrf_token_generation(self, client: AsyncClient):
        """Test CSRF token is generated and returned."""
        response = await client.get("/api/csrf-token")

        assert response.status_code == 200
        data = response.json()
        assert "csrf_token" in data
        assert len(data["csrf_token"]) > 20

    @pytest.mark.asyncio
    async def test_csrf_validation_success(self, client: AsyncClient):
        """Test request succeeds with valid CSRF token."""
        # Get token
        token_response = await client.get("/api/csrf-token")
        csrf_token = token_response.json()["csrf_token"]

        # Make request with token
        headers = {"X-CSRF-Token": csrf_token}
        response = await client.post("/api/test-endpoint",
                                    headers=headers,
                                    json={})

        assert response.status_code != 403  # Not CSRF failure

    @pytest.mark.asyncio
    async def test_csrf_validation_failure(self, client: AsyncClient):
        """Test request fails with invalid CSRF token."""
        headers = {"X-CSRF-Token": "invalid_token"}
        response = await client.post("/api/test-endpoint",
                                    headers=headers,
                                    json={})

        assert response.status_code == 403
        assert "csrf" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_csrf_exempt_routes(self, client: AsyncClient):
        """Test certain routes are exempt from CSRF protection."""
        # Public endpoints should not require CSRF
        response = await client.get("/api/health")
        assert response.status_code != 403

        response = await client.post("/api/auth/login", json={
            "email": "test@test.com",
            "password": "test"
        })
        assert response.status_code != 403  # May fail auth, but not CSRF


class TestCORSMiddleware:
    """Test CORS middleware configuration."""

    @pytest.mark.asyncio
    async def test_cors_headers_present(self, client: AsyncClient):
        """Test CORS headers are present in response."""
        response = await client.options("/api/health")

        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
        assert "Access-Control-Allow-Headers" in response.headers

    @pytest.mark.asyncio
    async def test_cors_preflight_request(self, client: AsyncClient):
        """Test CORS preflight OPTIONS request."""
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST"
        }

        response = await client.options("/api/employees", headers=headers)

        assert response.status_code == 200
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"

    @pytest.mark.asyncio
    async def test_cors_actual_request(self, client: AsyncClient):
        """Test CORS headers in actual request."""
        headers = {"Origin": "http://localhost:3000"}

        response = await client.get("/api/health", headers=headers)

        assert "Access-Control-Allow-Origin" in response.headers
