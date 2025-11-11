"""
API Documentation Configuration for FastAPI

This module configures the automatic OpenAPI documentation generation
and customizes the Swagger UI and ReDoc interfaces.
"""

from typing import Any, Dict

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi


def custom_openapi(app: FastAPI) -> Dict[str, Any]:
    """
    Generate custom OpenAPI schema with enhanced documentation.
    """
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="AI Schedule Manager API",
        version="1.0.0",
        description="""
        ## Neural-Powered Scheduling for Small Businesses

        The AI Schedule Manager API provides comprehensive workforce scheduling capabilities
        powered by machine learning and natural language processing.

        ### Key Features

        🤖 **AI-Powered Scheduling**
        - Neural network-based optimization algorithms
        - Natural language rule parsing
        - Intelligent conflict resolution
        - Predictive analytics for demand forecasting

        📋 **Complete CRUD Operations**
        - Employee management with role-based access
        - Dynamic scheduling rules
        - Real-time schedule updates
        - Comprehensive notifications system

        🔐 **Enterprise Security**
        - JWT-based authentication
        - Role-based authorization (Manager/Employee)
        - Rate limiting and audit logging
        - CSRF protection

        📊 **Advanced Analytics**
        - Labor cost optimization
        - Coverage analytics
        - Employee satisfaction metrics
        - Performance dashboards

        ### Getting Started

        1. **Authentication**: Obtain an access token via `/api/auth/login`
        2. **Set Headers**: Include `Authorization: Bearer <token>` in requests
        3. **Explore**: Use the interactive documentation below to test endpoints
        4. **Integrate**: Download the OpenAPI spec for client generation

        ### Rate Limits

        - Authentication endpoints: 5 requests per 5 minutes
        - General API endpoints: 100 requests per minute
        - Manager-only endpoints: 50 requests per minute

        ### Support

        - API Status: [Health Check](/health)
        - Documentation: [API Docs](/docs)
        - Alternative Docs: [ReDoc](/redoc)
        """,
        routes=app.routes,
        servers=[
            {"url": "http://localhost:8000", "description": "Development server"},
            {"url": "https://api.ai-schedule-manager.com", "description": "Production server"},
        ],
    )

    # Enhanced security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT access token obtained from /api/auth/login",
        }
    }

    # Add custom extensions
    openapi_schema["x-logo"] = {"url": "https://ai-schedule-manager.com/logo.png", "altText": "AI Schedule Manager"}

    # Add contact information
    openapi_schema["info"]["contact"] = {
        "name": "AI Schedule Manager Support",
        "url": "https://ai-schedule-manager.com/support",
        "email": "support@ai-schedule-manager.com",
    }

    # Add license information
    openapi_schema["info"]["license"] = {"name": "MIT", "url": "https://opensource.org/licenses/MIT"}

    # Enhanced error responses
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}

    openapi_schema["components"]["responses"] = {
        "ValidationError": {
            "description": "Validation Error",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "loc": {"type": "array"},
                                        "msg": {"type": "string"},
                                        "type": {"type": "string"},
                                    },
                                },
                            }
                        },
                    }
                }
            },
        },
        "Unauthorized": {
            "description": "Authentication required",
            "content": {
                "application/json": {
                    "schema": {"type": "object", "properties": {"detail": {"type": "string", "example": "Not authenticated"}}}
                }
            },
        },
        "Forbidden": {
            "description": "Insufficient permissions",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {"detail": {"type": "string", "example": "Insufficient permissions"}},
                    }
                }
            },
        },
        "RateLimitExceeded": {
            "description": "Rate limit exceeded",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string", "example": "Rate limit exceeded"},
                            "retry_after": {"type": "integer", "example": 60},
                        },
                    }
                }
            },
        },
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


def setup_docs(app: FastAPI) -> None:
    """
    Setup enhanced API documentation with custom Swagger UI and ReDoc.
    """

    # Custom Swagger UI configuration
    app.swagger_ui_init_oauth = {
        "usePkceWithAuthorizationCodeGrant": True,
    }

    # Custom Swagger UI parameters
    app.swagger_ui_parameters = {
        "deepLinking": True,
        "displayRequestDuration": True,
        "docExpansion": "none",
        "operationsSorter": "method",
        "filter": True,
        "showExtensions": True,
        "showCommonExtensions": True,
        "defaultModelsExpandDepth": 2,
        "defaultModelExpandDepth": 2,
        "tryItOutEnabled": True,
        "requestSnippetsEnabled": True,
        "syntaxHighlight.theme": "agate",
    }

    # Set custom OpenAPI generator
    app.openapi = lambda: custom_openapi(app)


# Example responses for common patterns
EXAMPLE_RESPONSES = {
    "employee_list": {
        "items": [
            {
                "id": 1,
                "name": "John Doe",
                "email": "john.doe@example.com",
                "role": "server",
                "phone": "+1-555-123-4567",
                "hourly_rate": 15.50,
                "max_hours_per_week": 40,
                "qualifications": ["food_safety", "cash_handling"],
                "availability_pattern": {
                    "monday": ["09:00-17:00"],
                    "tuesday": ["09:00-17:00"],
                    "wednesday": ["09:00-17:00"],
                    "thursday": ["09:00-17:00"],
                    "friday": ["09:00-17:00"],
                },
                "active": True,
                "created_at": "2024-01-01T10:00:00Z",
                "updated_at": "2024-01-01T10:00:00Z",
            }
        ],
        "total": 25,
        "page": 1,
        "size": 10,
        "pages": 3,
    },
    "rule_parsed": {
        "id": 1,
        "rule_type": "restriction",
        "original_text": "John cannot work on Sundays and prefers morning shifts",
        "constraints": {
            "employee_name": "John",
            "days_off": ["sunday"],
            "preferred_shifts": ["morning"],
            "shift_preference_weight": 0.8,
        },
        "priority": 2,
        "employee_id": 1,
        "active": True,
        "created_at": "2024-01-01T10:00:00Z",
        "updated_at": "2024-01-01T10:00:00Z",
        "employee": {"id": 1, "name": "John Doe", "email": "john.doe@example.com", "role": "server"},
    },
    "schedule_optimized": {
        "status": "optimized",
        "improvements": {
            "cost_savings": "$450",
            "coverage": "95%",
            "satisfaction": "88%",
            "optimization_time": "2.3s",
            "conflicts_resolved": 3,
        },
        "metrics": {"total_hours": 320, "labor_cost": 4800, "coverage_ratio": 1.2, "employee_satisfaction": 0.88},
        "message": "Schedule optimized successfully using AI",
    },
    "analytics_overview": {
        "total_employees": 25,
        "total_rules": 45,
        "total_schedules": 120,
        "avg_hours_per_week": 35.5,
        "labor_cost_trend": "decreasing",
        "optimization_score": 85,
        "coverage_metrics": {"current_week": 0.95, "next_week": 0.92, "average": 0.94},
        "cost_metrics": {"current_week": 12500.00, "last_week": 13200.00, "savings": 700.00},
    },
}

# Common error examples
ERROR_EXAMPLES = {
    "validation_error": {
        "detail": [
            {"loc": ["body", "email"], "msg": "field required", "type": "value_error.missing"},
            {
                "loc": ["body", "hourly_rate"],
                "msg": "ensure this value is greater than or equal to 0",
                "type": "value_error.number.not_ge",
            },
        ]
    },
    "authentication_error": {"detail": "Could not validate credentials"},
    "authorization_error": {"detail": "Not enough permissions"},
    "not_found_error": {"detail": "Employee not found"},
    "rate_limit_error": {"detail": "Rate limit exceeded. Try again in 60 seconds.", "retry_after": 60},
}
