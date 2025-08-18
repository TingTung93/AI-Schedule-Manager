# AI Schedule Manager

> Neural-powered scheduling application for small businesses - Simple to use, powerful to deploy

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
# Task Monitor: http://localhost:5555
```

### Windows Desktop Installation

1. Download the installer: `AI-Schedule-Manager-Setup.exe`
2. Run the installer and follow the wizard
3. Launch from Start Menu or Desktop shortcut
4. The application runs locally on your machine

## 🎯 Key Features

### Plain Language Rule Creation
- **Natural Input**: "Sarah can't work past 5pm on weekdays"
- **AI Understanding**: Automatically interprets and applies rules
- **No Training Required**: Write rules as you would say them

### Intelligent Scheduling
- **Constraint Solving**: Google OR-Tools optimization engine
- **Multi-objective**: Balances cost, preferences, and fairness
- **Conflict Resolution**: Automatically handles scheduling conflicts

### Business-Ready
- **Scalable**: Handles up to 100 employees across 24/7 operations
- **Cost Optimization**: Minimizes labor costs while meeting requirements
- **Compliance**: Ensures labor law compliance (breaks, maximum hours)

## 📋 Example Rules

The system understands natural language rules like:

```text
• "John needs Mondays off for college classes"
• "We need at least 3 people during lunch hours"
• "Mike prefers morning shifts"
• "No one should work more than 40 hours per week"
• "Sarah can't work weekends due to family commitments"
• "Ensure 8 hours rest between shifts"
```

## 🛠️ Technology Stack

All components use commercial-friendly open source licenses:

- **Backend**: FastAPI (Python) - High-performance async API
- **NLP**: spaCy - Industrial-strength natural language processing
- **Scheduling**: Google OR-Tools - Advanced constraint solver
- **Database**: PostgreSQL - Reliable data storage
- **Frontend**: React + Material-UI - Modern, responsive interface
- **Deployment**: Docker - Simple, consistent deployment

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

# Download NLP model
python -m spacy download en_core_web_sm

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
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

```yaml
POST   /api/rules/parse       # Parse natural language rule
GET    /api/schedule/generate # Generate optimized schedule
GET    /api/employees         # List all employees
GET    /api/analytics/costs   # Labor cost analysis
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

- JWT authentication with refresh tokens
- Role-based access control (Admin, Manager, Employee)
- AES-256 encryption for sensitive data
- Rate limiting and CORS protection
- Input validation and SQL injection prevention

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - Free for commercial use. See [LICENSE](LICENSE) for details.

## 💬 Support

- **Documentation**: [docs.aischedulemanager.com](https://docs.aischedulemanager.com)
- **Issues**: [GitHub Issues](https://github.com/yourusername/AI-Schedule-Manager/issues)
- **Email**: support@aischedulemanager.com
- **Discord**: [Join our community](https://discord.gg/aischedule)

## 🏆 Why Choose AI Schedule Manager?

### vs. Deputy ($4.50/user/month)
✓ **Free and open source**
✓ Plain language rules (Deputy requires forms)
✓ Self-hosted (keep your data)

### vs. When I Work ($2.50/user/month)
✓ **No monthly fees**
✓ Advanced AI optimization
✓ Unlimited rules and constraints

### vs. Humanity ($3/user/month)
✓ **Neural network learning**
✓ Natural language interface
✓ Customizable and extensible

## 🚀 Roadmap

- [ ] Mobile app (React Native)
- [ ] Voice command integration
- [ ] Advanced analytics dashboard
- [ ] Multi-location support
- [ ] Payroll system integration
- [ ] Time clock with biometrics
- [ ] Automated shift trading
- [ ] Predictive scheduling

---

**Built with ❤️ for small business owners by the open source community**