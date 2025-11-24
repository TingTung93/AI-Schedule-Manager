# Getting Started

Welcome to the AI Schedule Manager API! This guide will help you get up and running with our neural-powered scheduling system for small businesses.

## Overview

The AI Schedule Manager API provides:

- 🤖 **AI-Powered Scheduling**: Neural network-based optimization
- 📋 **Complete CRUD Operations**: Employee, schedule, and rule management
- 🗣️ **Natural Language Processing**: Parse scheduling rules in plain English
- 🔐 **Secure Authentication**: JWT-based authentication with role-based access
- 📊 **Analytics & Insights**: Comprehensive reporting and optimization metrics
- ⚡ **Real-time Updates**: WebSocket-based live notifications

## Quick Start

### 1. Base URL

```
Development: http://localhost:8000
Production: https://api.ai-schedule-manager.com
```

### 2. Authentication

All API requests (except login and health checks) require authentication using JWT tokens.

#### Login Request
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "password": "your-password"
  }'
```

#### Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "email": "manager@example.com",
    "role": "manager"
  }
}
```

#### Using the Token
Include the token in the Authorization header for all subsequent requests:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/employees"
```

### 3. Your First API Call

Let's start by getting a list of employees:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/employees?page=1&size=10"
```

This will return a paginated list of employees in your organization.

## Core Concepts

### Employees
Employees are the core entities in the system. Each employee has:
- Personal information (name, email, phone)
- Role (manager, server, cook, etc.)
- Availability patterns
- Hourly rate and maximum hours per week
- Qualifications and skills

### Rules
Rules define scheduling constraints and preferences. They can be:
- **Availability**: When an employee is available to work
- **Preferences**: Preferred shifts or time slots
- **Requirements**: Must-have constraints (e.g., certified employees only)
- **Restrictions**: Cannot work constraints (e.g., no Sundays)

### Schedules
Schedules assign employees to specific shifts on specific dates. Each schedule entry includes:
- Employee and shift information
- Date and status
- Notes and overtime approval
- Related employee and shift details

### Notifications
Real-time notifications keep everyone informed about:
- Schedule changes
- New assignments
- Reminders
- System alerts

## API Features

### 1. Natural Language Rule Parsing

One of our unique features is the ability to parse scheduling rules written in natural language:

```bash
curl -X POST "http://localhost:8000/api/rules/parse" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_text": "John cannot work on Sundays and prefers morning shifts"
  }'
```

The AI will automatically:
- Identify the employee (John)
- Extract the restriction (no Sundays)
- Extract the preference (morning shifts)
- Create structured constraints

### 2. AI Schedule Generation

Generate optimized schedules using our neural networks:

```bash
curl -X POST "http://localhost:8000/api/schedule/generate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-15",
    "end_date": "2024-01-21",
    "constraints": {
      "max_hours_per_employee": 40,
      "min_coverage_ratio": 1.2
    }
  }'
```

### 3. Schedule Optimization

Improve existing schedules for cost, coverage, and satisfaction:

```bash
curl -X POST "http://localhost:8000/api/schedule/optimize?schedule_id=123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Pagination

All list endpoints support pagination:

```bash
curl "http://localhost:8000/api/employees?page=1&size=20&sort_by=name&sort_order=asc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Parameters:
- `page`: Page number (starts from 1)
- `size`: Items per page (1-100)
- `sort_by`: Field to sort by
- `sort_order`: `asc` or `desc`

Response format:
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

## Filtering

Most endpoints support filtering:

### Employee Filters
```bash
curl "http://localhost:8000/api/employees?role=server&active=true&search=john" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Schedule Filters
```bash
curl "http://localhost:8000/api/schedules?employee_id=5&date_from=2024-01-01&date_to=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Rule Filters
```bash
curl "http://localhost:8000/api/rules?rule_type=restriction&active=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Handling

The API uses standard HTTP status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `422`: Unprocessable Entity (validation errors)
- `429`: Rate Limited
- `500`: Internal Server Error

### Error Response Format
```json
{
  "detail": "Employee not found"
}
```

### Validation Errors
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Authentication endpoints**: 5 requests per 5 minutes per IP
- **General endpoints**: 100 requests per minute per user
- **Manager-only endpoints**: 50 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Role-Based Access

The API implements role-based access control:

### Manager Role
- Full access to all endpoints
- Can create, update, delete employees
- Can manage schedules and rules
- Can access analytics
- Can generate and optimize schedules

### Employee Role
- Can view their own information
- Can view their own schedules
- Can view notifications
- Cannot modify other employees or schedules

## Next Steps

Now that you understand the basics, explore these areas:

1. **[Authentication Guide](./authentication)** - Detailed authentication flows
2. **[WebSocket API](./websocket)** - Real-time updates and notifications
3. **[Code Examples](./examples)** - Implementation examples in various languages
4. **[API Reference](../api-reference)** - Complete API documentation
5. **[Tutorials](./tutorials)** - Step-by-step implementation guides

## SDKs and Tools

### Postman Collection
Import our [Postman collection](../postman/AI_Schedule_Manager.postman_collection.json) to test the API interactively.

### OpenAPI Specification
Download the [OpenAPI spec](../api/openapi.yaml) to generate client SDKs in your preferred language.

### Interactive Documentation
Explore the API interactively at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Support

Need help? Reach out to us:

- 📧 Email: [support@ai-schedule-manager.com](mailto:support@ai-schedule-manager.com)
- 💬 Discord: [AI Schedule Manager Community](https://discord.gg/ai-schedule-manager)
- 📚 Documentation: [docs.ai-schedule-manager.com](https://docs.ai-schedule-manager.com)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/ai-schedule-manager/ai-schedule-manager/issues)

## Status Page

Monitor API status and uptime:
- Status: [status.ai-schedule-manager.com](https://status.ai-schedule-manager.com)
- Health Check: `GET /health`