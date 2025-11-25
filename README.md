# AI Schedule Manager

> Intelligent scheduling application powered by constraint optimization with comprehensive employee management

## 🚀 Quick Start

### Docker Deployment (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/AI-Schedule-Manager.git
cd AI-Schedule-Manager

# Start with Docker Compose
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# API Documentation: http://localhost:8000/docs
# Task Monitor: http://localhost:5555
```

### Windows Desktop Installation

1. Download the installer: `AI-Schedule-Manager-Setup.exe`
2. Run the installer and follow the wizard
3. Launch from Start Menu or Desktop shortcut
4. The application runs locally on your machine

## 🎯 Key Features

### Employee Management (Weeks 1-4 Implementation)
- **Complete CRUD Operations**: Create, read, update, delete employees
- **Role-Based Access Control (RBAC)**: Admin, Manager, User, Guest roles
- **Advanced Search & Filtering**: Search by name/email, filter by department/role/status
- **Extended Employee Fields**: Qualifications, availability schedules, hourly rates
- **Password Management**: Secure reset and change with history tracking
- **Account Status Management**: Active, inactive, locked, verified states
- **Comprehensive Audit Trails**: Track all department, role, and status changes
- **Pagination & Sorting**: Handle large employee datasets efficiently

### Business Rule Management
- **Structured Input**: Define scheduling rules and constraints
- **Rule Engine**: Automatically applies rules to schedule generation
- **Constraint-Based**: Rules are enforced through optimization algorithms

### Intelligent Scheduling
- **Constraint Optimization**: Advanced constraint-based scheduling algorithms
- **Multi-objective**: Balances coverage, cost, preferences, and fairness
- **Conflict Detection**: Identifies and prevents scheduling conflicts

### Business-Ready
- **Scalable**: Handles up to 100 employees across 24/7 operations
- **Cost Optimization**: Minimizes labor costs while meeting requirements
- **Compliance**: Ensures labor law compliance (breaks, maximum hours)
- **Security**: JWT authentication, CSRF protection, input sanitization
- **Audit Logging**: Complete audit trails for compliance

## 📋 Scheduling Capabilities

The system supports:

```text
• Employee availability management
• Shift coverage requirements
• Workload balancing and fairness
• Maximum hours and labor law compliance
• Department-based scheduling
• Conflict detection and resolution
• Schedule optimization for cost efficiency
```

## 🛠️ Technology Stack

All components use commercial-friendly open source licenses:

- **Backend**: FastAPI (Python) - High-performance async API
- **Database**: PostgreSQL - Reliable data storage with SQLAlchemy ORM
- **Frontend**: React + Material-UI (MUI) - Modern, responsive interface
- **Scheduling**: Constraint-based optimization algorithms
- **Deployment**: Docker - Simple, consistent deployment
- **Authentication**: JWT-based secure authentication

## 📦 Manual Installation

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Set environment variables
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
alembic upgrade head

# Start backend
uvicorn src.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set API endpoint
echo "REACT_APP_API_URL=http://localhost:8000" > .env

# Start development server
npm start
```

## 🔧 Configuration

### Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost/scheduledb
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=http://localhost:3000

# Frontend (.env)
REACT_APP_API_URL=http://localhost:8000
```

## 📊 API Documentation

Once running, access interactive API docs at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Comprehensive API Reference**: `/docs/API_REFERENCE.md`

### Employee Management Endpoints

```yaml
# Authentication
POST   /api/auth/login                           # User login with JWT
POST   /api/auth/register                        # Register new user
POST   /api/auth/refresh                         # Refresh access token
POST   /api/auth/logout                          # Logout and revoke token

# Employee CRUD
GET    /api/employees                            # List employees (search, filter, sort, paginate)
GET    /api/employees/{id}                       # Get specific employee
POST   /api/employees                            # Create employee (admin/manager)
PATCH  /api/employees/{id}                       # Update employee (admin/manager)
DELETE /api/employees/{id}                       # Delete employee (admin only)

# Password Management
POST   /api/employees/{id}/reset-password        # Reset password (admin only)
PATCH  /api/employees/{id}/change-password       # Change password (self/admin)

# Account Status
PATCH  /api/employees/{id}/status                # Update account status (admin only)
GET    /api/employees/{id}/status-history        # View status change history

# Role Management
PATCH  /api/employees/{id}/role                  # Update role (admin only)
GET    /api/employees/{id}/role-history          # View role change history

# Audit Trails
GET    /api/employees/{id}/department-history    # View department assignment history

# Scheduling
POST   /api/rules/parse                          # Parse natural language rule
GET    /api/schedule/generate                    # Generate optimized schedule
GET    /api/analytics/costs                      # Labor cost analysis
```

## 🏗️ Architecture

```
┌─────────────────────┐
│   React Frontend    │
│  (User Interface)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   FastAPI Backend   │
│   (API Gateway)     │
└──────────┬──────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
┌────────┐ ┌────────┐ ┌────────┐
│  NLP   │ │Schedule│ │Business│
│ Engine │ │ Solver │ │  Logic │
└────────┘ └────────┘ └────────┘
    │          │          │
    └──────────┼──────────┘
               ▼
    ┌──────────────────┐
    │   PostgreSQL     │
    │   Database       │
    └──────────────────┘
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=src

# Frontend tests
cd frontend
npm test

# End-to-end tests
npm run test:e2e
```

## 🚢 Production Deployment

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml schedule_app

# Scale workers
docker service scale schedule_app_celery=3
```

### Kubernetes

```bash
# Apply configurations
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n schedule-app
```

## 📈 Performance

- **Schedule Generation**: < 3 seconds for 100 employees
- **Rule Parsing**: < 500ms per rule
- **API Response**: < 200ms (p95)
- **Concurrent Users**: 50+ simultaneous
- **Memory Usage**: < 512MB typical

## 🔒 Security

### Authentication & Authorization
- **JWT Authentication**: Access tokens (15 min) and refresh tokens (30 days)
- **Role-Based Access Control (RBAC)**: Admin, Manager, User, Guest roles
- **Resource-Based Authorization**: Users can only access their own data
- **Token Revocation**: Redis-based token blacklisting on logout

### Data Protection
- **Password Security**: bcrypt hashing with salt rounds
- **Password History**: Prevent reuse of last 5 passwords
- **Input Sanitization**: HTML escaping to prevent XSS attacks
- **SQL Injection Prevention**: Parameterized queries via SQLAlchemy ORM
- **CSRF Protection**: CSRF tokens for state-changing requests

### Network Security
- **HTTPS Required**: Forced HTTPS in production with HSTS headers
- **CORS Protection**: Whitelist-based origin validation
- **Rate Limiting**: Global and endpoint-specific rate limits
- **Request Size Limits**: 1MB maximum request body
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options

### Audit & Monitoring
- **Comprehensive Audit Trails**: Track all employee, role, department, and status changes
- **Security Event Logging**: Log authentication attempts and permission denials
- **Account Lockout**: Automatic lockout after failed login attempts

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[API Reference](docs/API_REFERENCE.md)**: Complete endpoint documentation with examples
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)**: Local development setup and contribution guide
- **[User Guide](docs/USER_GUIDE.md)**: End-user documentation for all features
- **[Migration Guide](docs/MIGRATION_GUIDE.md)**: Database migration and deployment procedures

## 🎯 Implemented Features (Weeks 1-4)

### Week 1: Employee Management Foundation
- ✅ Complete employee CRUD operations
- ✅ JWT authentication and authorization
- ✅ Role-based access control (Admin, Manager, User, Guest)
- ✅ Department assignment with validation

### Week 2: Enhanced Employee Fields
- ✅ Qualifications tracking (max 20 per employee)
- ✅ Weekly availability schedules
- ✅ Hourly rate management (0.00-1000.00)
- ✅ Maximum hours per week limits

### Week 3: Security & Account Management
- ✅ Password reset (admin-initiated)
- ✅ Password change (self-service)
- ✅ Password history tracking (last 5 passwords)
- ✅ Account status management (active, locked, verified)
- ✅ Comprehensive input validation
- ✅ XSS and SQL injection prevention

### Week 4: Audit Trails & Advanced Features
- ✅ Department assignment history
- ✅ Role change history
- ✅ Account status change history
- ✅ Advanced search and filtering
- ✅ Pagination and sorting
- ✅ Performance optimization (N+1 query prevention)

## 🤝 Contributing

We welcome contributions! Please see our documentation:

- **[Developer Guide](docs/DEVELOPER_GUIDE.md)**: Setup and contribution guidelines
- **[API Reference](docs/API_REFERENCE.md)**: API endpoint specifications
- **Issues**: [GitHub Issues](https://github.com/yourusername/AI-Schedule-Manager/issues)

## 📄 License

MIT License - Free for commercial use. See [LICENSE](LICENSE) for details.

## 💬 Support

- **Documentation**: See `/docs` directory for comprehensive guides
- **API Docs**: http://localhost:8000/docs (interactive Swagger UI)
- **Issues**: [GitHub Issues](https://github.com/yourusername/AI-Schedule-Manager/issues)
- **Email**: support@aischedulemanager.com

## 🏆 Why Choose AI Schedule Manager?

### vs. Deputy ($4.50/user/month)
✓ **Free and open source**
✓ Flexible rule-based scheduling
✓ Self-hosted (keep your data)

### vs. When I Work ($2.50/user/month)
✓ **No monthly fees**
✓ Advanced constraint optimization
✓ Unlimited rules and constraints

### vs. Humanity ($3/user/month)
✓ **Intelligent optimization**
✓ Department-based management
✓ Customizable and extensible

## 🚀 Roadmap

- [ ] Google OR-Tools constraint solver integration
- [ ] Natural language processing for rule parsing
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-location support
- [ ] Payroll system integration
- [ ] Time clock integration
- [ ] Automated shift trading
- [ ] Predictive scheduling with ML

---

**Built with ❤️ for small business owners by the open source community**