# AI Schedule Manager - Production Deployment Guide

This comprehensive guide covers deploying the AI Schedule Manager to production using modern DevOps practices including Docker, Kubernetes, Terraform, and CI/CD pipelines.

## 🏗️ Architecture Overview

The production deployment includes:

- **Frontend**: React application served by Nginx (containerized)
- **Backend**: FastAPI application with Python (containerized)
- **Database**: PostgreSQL with automated backups
- **Cache**: Redis cluster for session and application caching
- **Infrastructure**: Kubernetes on AWS EKS with auto-scaling
- **Monitoring**: Prometheus, Grafana, and comprehensive alerting
- **CI/CD**: GitHub Actions with automated testing and deployment

## 📋 Prerequisites

### Required Tools
- [Docker](https://docs.docker.com/get-docker/) (>= 20.10)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) (>= 1.28)
- [Terraform](https://www.terraform.io/downloads) (>= 1.5)
- [Helm](https://helm.sh/docs/intro/install/) (>= 3.12)
- [AWS CLI](https://aws.amazon.com/cli/) (configured with appropriate permissions)

### AWS Requirements
- AWS account with appropriate permissions
- EKS cluster creation permissions
- RDS and ElastiCache permissions
- Route53 or external DNS management

## 🚀 Quick Start

### 1. Infrastructure Setup

```bash
# Clone the repository
git clone <repository-url>
cd AI-Schedule-Manager

# Initialize Terraform
cd terraform
terraform init

# Create infrastructure
terraform plan -var="environment=production"
terraform apply -var="environment=production"

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name ai-schedule-manager-production
```

### 2. Application Deployment

```bash
# Make deployment script executable
chmod +x scripts/deployment-helpers.sh

# Check prerequisites
./scripts/deployment-helpers.sh check

# Build and push images
./scripts/deployment-helpers.sh build v1.0.0 your-registry.com

# Deploy to Kubernetes
./scripts/deployment-helpers.sh deploy production v1.0.0

# Run database migrations
./scripts/deployment-helpers.sh migrate production

# Setup monitoring
./scripts/deployment-helpers.sh monitoring
```

### 3. Verify Deployment

```bash
# Run health checks
./scripts/deployment-helpers.sh health

# Check application status
kubectl get pods -n ai-schedule-manager
kubectl get services -n ai-schedule-manager
```

## 🔧 Detailed Configuration

### Environment Variables

Copy and configure environment files:

```bash
# Development
cp config/env-templates/.env.development backend/.env

# Staging
cp config/env-templates/.env.staging backend/.env.staging

# Production
cp config/env-templates/.env.production backend/.env.production
```

Key variables to configure:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET_KEY`: Strong secret for JWT tokens
- `SENDGRID_API_KEY`: Email service API key
- `SENTRY_DSN`: Error tracking service

### Kubernetes Secrets

Create required secrets before deployment:

```bash
# Database secrets
kubectl create secret generic database-secret \
  --from-literal=postgres-user=<username> \
  --from-literal=postgres-password=<password> \
  --from-literal=database-url=<connection-string> \
  -n ai-schedule-manager

# Application secrets
kubectl create secret generic app-secrets \
  --from-literal=jwt-secret-key=<jwt-secret> \
  --from-literal=sentry-dsn=<sentry-dsn> \
  -n ai-schedule-manager
```

## 🐳 Docker Configuration

### Multi-Stage Builds

The Docker configurations use multi-stage builds for optimization:

- **Frontend**: Node.js build → Nginx production server
- **Backend**: Python dependencies → Optimized runtime

### Security Features

- Non-root user execution
- Security-hardened base images
- Health checks for all containers
- Resource limits and requests

### Building Images

```bash
# Build frontend
docker build -t ai-schedule-manager-frontend:latest ./frontend

# Build backend
docker build -t ai-schedule-manager-backend:latest ./backend

# Build with specific tags
docker build -t your-registry.com/ai-schedule-manager-frontend:v1.0.0 ./frontend
```

## ☸️ Kubernetes Deployment

### Namespace and Resources

The deployment creates:
- Dedicated namespace with resource quotas
- Network policies for security
- Pod security standards
- Horizontal Pod Autoscaler (HPA)

### Storage

- PostgreSQL: StatefulSet with persistent volumes
- Redis: Deployment with persistent volume claims
- Application logs: EmptyDir volumes
- Backups: Persistent volumes with snapshot classes

### Networking

- ClusterIP services for internal communication
- Ingress with SSL/TLS termination
- Network policies for security isolation
- Load balancer for external access

### Scaling

Automatic scaling based on:
- CPU utilization (70% threshold)
- Memory utilization (80% threshold)
- Custom metrics (request rate, queue length)

## 🏗️ Infrastructure as Code (Terraform)

### Modules Included

- **VPC**: Multi-AZ setup with public/private subnets
- **EKS**: Managed Kubernetes cluster with node groups
- **RDS**: PostgreSQL with automated backups
- **ElastiCache**: Redis cluster for caching
- **ALB**: Application Load Balancer with SSL
- **S3**: Object storage for files and backups
- **CloudWatch**: Monitoring and log aggregation

### Environment Management

```bash
# Development environment
terraform workspace new development
terraform apply -var="environment=development"

# Staging environment
terraform workspace new staging
terraform apply -var="environment=staging"

# Production environment
terraform workspace new production
terraform apply -var="environment=production"
```

### Cost Optimization

- Spot instances for non-critical workloads
- Scheduled scaling for predictable load patterns
- VPC endpoints to reduce data transfer costs
- Storage lifecycle policies

## 🔄 CI/CD Pipeline (GitHub Actions)

### Continuous Integration

The CI pipeline includes:
- **Frontend Tests**: Jest, ESLint, build verification
- **Backend Tests**: pytest, mypy, security scanning
- **E2E Tests**: Playwright integration tests
- **Security Scanning**: Trivy, CodeQL, dependency review
- **Docker Builds**: Multi-platform image builds

### Continuous Deployment

#### Staging Deployment
- Triggered on `develop` branch pushes
- Automated deployment to staging environment
- Smoke tests and health checks
- Slack notifications

#### Production Deployment
- Triggered on release creation
- Manual approval required
- Blue-green deployment strategy
- Automated rollback on failure
- Comprehensive monitoring

### Pipeline Configuration

```yaml
# .github/workflows/ci.yml - Comprehensive CI pipeline
# .github/workflows/cd-staging.yml - Staging deployment
# .github/workflows/cd-production.yml - Production deployment
```

## 📊 Monitoring and Observability

### Prometheus Metrics

Application metrics collected:
- HTTP request rates and latencies
- Database connection pool status
- Cache hit rates and performance
- Custom business metrics
- Kubernetes cluster metrics

### Grafana Dashboards

Pre-configured dashboards for:
- Application overview and health
- Infrastructure monitoring
- Database performance
- Cache performance
- Business KPIs

### Alerting Rules

Comprehensive alerts for:
- **Application**: High error rates, latency spikes
- **Infrastructure**: CPU, memory, disk usage
- **Database**: Connection issues, slow queries
- **Security**: Failed login attempts, suspicious activity
- **Business**: Low user activity, payment failures

### Log Aggregation

Centralized logging with:
- **Fluentd**: Log collection and forwarding
- **Elasticsearch**: Log storage and indexing
- **Kibana**: Log visualization and analysis
- **Structured logging**: JSON format with correlation IDs

## 🔒 Security Considerations

### Network Security
- Private subnets for application components
- Security groups with minimal required access
- Network policies for pod-to-pod communication
- VPC Flow Logs for network monitoring

### Application Security
- Non-root container execution
- Security contexts and pod security standards
- Secrets management with Kubernetes secrets
- SSL/TLS encryption for all traffic

### Access Control
- RBAC for Kubernetes access
- IAM roles with minimal permissions
- Service accounts for pod access
- Regular security scanning and updates

## 💾 Backup and Disaster Recovery

### Database Backups
- Automated daily backups
- Point-in-time recovery (7 days)
- Cross-region backup replication
- Backup verification and testing

### Application Backups
- Configuration backups to S3
- Container image backups
- Persistent volume snapshots
- Disaster recovery runbooks

### Recovery Procedures

```bash
# Database restore from backup
./scripts/deployment-helpers.sh restore-db backup-20231215-120000

# Application rollback
./scripts/deployment-helpers.sh rollback backend

# Full disaster recovery
./scripts/disaster-recovery.sh restore-environment production
```

## 📈 Performance Optimization

### Application Performance
- Connection pooling for database
- Redis caching for frequent queries
- CDN for static assets
- Compression for API responses

### Infrastructure Performance
- Auto-scaling based on metrics
- Resource requests and limits
- Prometheus-based scaling decisions
- Regular performance testing

### Cost Optimization
- Spot instances for development/testing
- Scheduled scaling for known patterns
- Resource right-sizing
- Reserved instances for production

## 🔧 Maintenance and Operations

### Regular Maintenance

```bash
# Update cluster and nodes
terraform apply -refresh-only

# Update application
./scripts/deployment-helpers.sh deploy production v1.1.0

# Database maintenance
./scripts/maintenance.sh db-vacuum
./scripts/maintenance.sh db-analyze
```

### Monitoring Health

```bash
# Check overall health
./scripts/deployment-helpers.sh health

# View logs
./scripts/deployment-helpers.sh logs backend production

# Monitor metrics
kubectl port-forward service/prometheus 9090:9090 -n monitoring
```

### Scaling Operations

```bash
# Scale application
./scripts/deployment-helpers.sh scale backend 5

# Scale infrastructure
terraform apply -var="eks_node_group_desired_size=5"
```

## 🚨 Troubleshooting

### Common Issues

1. **Pod Startup Issues**
   ```bash
   kubectl describe pod <pod-name> -n ai-schedule-manager
   kubectl logs <pod-name> -n ai-schedule-manager
   ```

2. **Database Connection Issues**
   ```bash
   kubectl run debug-pod --image=postgres:15 --rm -it -- psql $DATABASE_URL
   ```

3. **Network Connectivity**
   ```bash
   kubectl run netshoot --image=nicolaka/netshoot --rm -it
   ```

### Log Analysis

```bash
# View aggregated logs
kubectl logs -l app=ai-schedule-backend -n ai-schedule-manager --tail=100

# Follow logs in real-time
./scripts/deployment-helpers.sh logs backend production true
```

### Performance Issues

```bash
# Check resource usage
kubectl top pods -n ai-schedule-manager
kubectl top nodes

# Analyze metrics
kubectl port-forward service/grafana 3000:3000 -n monitoring
```

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [GitHub Actions](https://docs.github.com/en/actions)

## 🆘 Support

For deployment issues:
1. Check this documentation
2. Review application logs
3. Check infrastructure status
4. Contact the development team

---

**Note**: This deployment guide assumes familiarity with Kubernetes, Docker, and AWS services. For production deployments, ensure all security best practices are followed and configurations are thoroughly tested.