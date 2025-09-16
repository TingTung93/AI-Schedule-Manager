# AI Schedule Manager API Documentation

Comprehensive documentation for the AI Schedule Manager API - a neural-powered scheduling solution for small businesses.

## 🚀 Quick Links

- **[Getting Started](./docs/getting-started.md)** - Start here for API basics
- **[Interactive API Docs](http://localhost:8000/docs)** - Test endpoints live
- **[OpenAPI Specification](./api/openapi.yaml)** - Complete API schema
- **[Postman Collection](./postman/AI_Schedule_Manager.postman_collection.json)** - Import and test
- **[Code Examples](./docs/examples.md)** - SDKs in multiple languages

## 📚 Documentation Structure

```
docs/
├── api/
│   ├── openapi.yaml              # OpenAPI 3.0 specification
│   └── websocket.md              # WebSocket API documentation
├── docs/
│   ├── getting-started.md        # Quick start guide
│   ├── authentication.md        # Auth flows and security
│   ├── examples.md              # Code examples & SDKs
│   ├── changelog.md             # API version history
│   └── rate-limiting.md         # Rate limiting guide
├── postman/
│   └── AI_Schedule_Manager.postman_collection.json
└── package.json                 # Docusaurus dependencies
```

## 🔧 Features Documented

### Core API Features
- ✅ Complete CRUD operations (Employees, Schedules, Rules, Notifications)
- ✅ JWT-based authentication with refresh tokens
- ✅ Role-based access control (Manager/Employee)
- ✅ Comprehensive pagination and filtering
- ✅ Rate limiting and security features

### AI-Powered Features
- ✅ Natural language rule parsing using NLP
- ✅ AI-driven schedule generation and optimization
- ✅ Intelligent conflict resolution
- ✅ Predictive analytics and insights

### Real-time Features
- ✅ WebSocket API for live updates
- ✅ Real-time notifications
- ✅ Presence system for user status
- ✅ Event-driven updates

### Developer Experience
- ✅ OpenAPI 3.0 specification
- ✅ Interactive Swagger UI documentation
- ✅ Postman collection with test scripts
- ✅ Code examples in 5+ languages
- ✅ Comprehensive error handling

## 🛠 Local Development

### Prerequisites
- Node.js 16+ for documentation site
- Python 3.9+ for API server
- Redis for caching and rate limiting
- PostgreSQL for data storage

### Run Documentation Site

```bash
# Install dependencies
cd docs
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Run API Server

```bash
# Navigate to backend
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start development server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Access Documentation

- **Documentation Site**: http://localhost:3000
- **Interactive API**: http://localhost:8000/docs
- **ReDoc Alternative**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 📖 API Overview

### Base URLs
- **Development**: `http://localhost:8000`
- **Production**: `https://api.ai-schedule-manager.com`

### Authentication
```bash
# Login to get JWT token
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "manager@example.com", "password": "password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/employees"
```

### Key Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Auth** | `POST /api/auth/login` | Authenticate user |
| **Employees** | `GET /api/employees` | List employees |
| **Schedules** | `GET /api/schedules` | List schedules |
| **AI Rules** | `POST /api/rules/parse` | Parse natural language rules |
| **AI Scheduling** | `POST /api/schedule/generate` | Generate optimized schedules |
| **Analytics** | `GET /api/analytics/overview` | Get analytics dashboard |
| **WebSocket** | `WS /ws` | Real-time updates |

## 🧠 AI Features

### Natural Language Rule Processing
```bash
curl -X POST "http://localhost:8000/api/rules/parse" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rule_text": "John cannot work on Sundays and prefers morning shifts"}'
```

### Schedule Generation
```bash
curl -X POST "http://localhost:8000/api/schedule/generate" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-15",
    "end_date": "2024-01-21",
    "constraints": {"max_hours_per_employee": 40}
  }'
```

## 🔗 Integration Tools

### Postman Collection
Import the [Postman collection](./postman/AI_Schedule_Manager.postman_collection.json):

1. Open Postman
2. Click "Import"
3. Select the JSON file
4. Configure environment variables
5. Run authentication to get tokens
6. Test all endpoints interactively

### SDK Generation
Use the OpenAPI spec to generate client SDKs:

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate JavaScript SDK
openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g javascript \
  -o sdks/javascript

# Generate Python SDK
openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g python \
  -o sdks/python
```

## 🏗 Architecture

### Technology Stack
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy
- **Cache**: Redis for sessions and rate limiting
- **Queue**: Celery for background tasks
- **AI/ML**: spaCy, sentence-transformers, OR-Tools
- **Real-time**: WebSockets with async support

### Security Features
- JWT tokens with refresh mechanism
- Role-based access control (RBAC)
- Rate limiting per endpoint and user
- Account lockout protection
- CSRF protection for state changes
- Comprehensive audit logging
- Input validation and sanitization

## 📊 API Metrics

### Performance Targets
- **Response Time**: < 200ms for 95% of requests
- **Availability**: 99.9% uptime SLA
- **Throughput**: 1000+ requests per second
- **AI Processing**: < 2 seconds for rule parsing
- **Schedule Generation**: < 10 seconds for weekly schedules

### Rate Limits
- **Authentication**: 5 requests per 5 minutes per IP
- **General API**: 100-500 requests per hour per user
- **AI Features**: 10-50 requests per hour per user
- **WebSocket**: 3 concurrent connections per user

## 🆘 Support & Resources

### Documentation
- **Full Docs**: [docs.ai-schedule-manager.com](https://docs.ai-schedule-manager.com)
- **API Reference**: Interactive docs with examples
- **Tutorials**: Step-by-step implementation guides
- **FAQ**: Common questions and solutions

### Community & Support
- **Email**: [support@ai-schedule-manager.com](mailto:support@ai-schedule-manager.com)
- **Discord**: [AI Schedule Manager Community](https://discord.gg/ai-schedule-manager)
- **GitHub**: [Issues & Feature Requests](https://github.com/ai-schedule-manager/api/issues)
- **Status**: [status.ai-schedule-manager.com](https://status.ai-schedule-manager.com)

### Development Resources
- **Changelog**: Track API changes and updates
- **Migration Guides**: Upgrade between versions
- **Best Practices**: Implementation recommendations
- **Troubleshooting**: Common issues and solutions

## 📄 License

This documentation is licensed under MIT License. See [LICENSE](../LICENSE) for details.

The AI Schedule Manager API is proprietary software. Contact [sales@ai-schedule-manager.com](mailto:sales@ai-schedule-manager.com) for licensing information.

---

**Built with ❤️ by the AI Schedule Manager Team**

Last updated: January 15, 2024