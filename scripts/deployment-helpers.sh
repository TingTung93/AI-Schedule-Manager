#!/bin/bash

# AI Schedule Manager Deployment Helper Scripts
# Collection of utility scripts for deployment and maintenance

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ai-schedule-manager"
NAMESPACE="ai-schedule-manager"
BACKEND_IMAGE="ai-schedule-manager-backend"
FRONTEND_IMAGE="ai-schedule-manager-frontend"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install kubectl first."
    fi

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "docker is not installed. Please install Docker first."
    fi

    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        warn "helm is not installed. Some features may not work."
    fi

    # Check kubectl cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster. Please check your kubectl configuration."
    fi

    log "Prerequisites check passed!"
}

# Build and push Docker images
build_and_push_images() {
    local tag=${1:-latest}
    local registry=${2:-localhost}

    log "Building and pushing Docker images with tag: $tag"

    # Build backend image
    info "Building backend image..."
    docker build -t "$registry/$BACKEND_IMAGE:$tag" ./backend/
    docker push "$registry/$BACKEND_IMAGE:$tag"

    # Build frontend image
    info "Building frontend image..."
    docker build -t "$registry/$FRONTEND_IMAGE:$tag" ./frontend/
    docker push "$registry/$FRONTEND_IMAGE:$tag"

    log "Images built and pushed successfully!"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    local environment=${1:-development}
    local tag=${2:-latest}

    log "Deploying to Kubernetes environment: $environment"

    # Create namespace if it doesn't exist
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

    # Update image tags in deployment files
    if [[ "$environment" == "production" ]]; then
        # Use specific tag for production
        sed -i.bak "s|image: $BACKEND_IMAGE:.*|image: $BACKEND_IMAGE:$tag|g" k8s/deployments/backend-deployment.yaml
        sed -i.bak "s|image: $FRONTEND_IMAGE:.*|image: $FRONTEND_IMAGE:$tag|g" k8s/deployments/frontend-deployment.yaml
    fi

    # Deploy in order
    info "Deploying storage resources..."
    kubectl apply -f k8s/storage/ -n $NAMESPACE

    info "Deploying database..."
    kubectl apply -f k8s/deployments/database-deployment.yaml -n $NAMESPACE
    kubectl apply -f k8s/services/services.yaml -n $NAMESPACE

    info "Waiting for database to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s

    info "Deploying application..."
    kubectl apply -f k8s/deployments/backend-deployment.yaml -n $NAMESPACE
    kubectl apply -f k8s/deployments/frontend-deployment.yaml -n $NAMESPACE

    info "Deploying ingress..."
    kubectl apply -f k8s/ingress/ -n $NAMESPACE

    # Wait for deployments to be ready
    info "Waiting for deployments to be ready..."
    kubectl rollout status deployment/$PROJECT_NAME-backend -n $NAMESPACE --timeout=600s
    kubectl rollout status deployment/$PROJECT_NAME-frontend -n $NAMESPACE --timeout=600s

    log "Deployment completed successfully!"
}

# Run database migrations
run_migrations() {
    local environment=${1:-development}

    log "Running database migrations for environment: $environment"

    # Get database URL from secrets
    local db_url
    if [[ "$environment" == "production" ]]; then
        db_url=$(kubectl get secret database-secret -n $NAMESPACE -o jsonpath='{.data.database-url}' | base64 -d)
    else
        db_url="postgresql://postgres:password@localhost:5432/ai_schedule_manager_$environment"
    fi

    # Run migration job
    kubectl run migration-job-$(date +%s) \
        --image=$BACKEND_IMAGE:latest \
        --namespace=$NAMESPACE \
        --restart=Never \
        --rm -i --tty \
        --env="DATABASE_URL=$db_url" \
        -- alembic upgrade head

    log "Database migrations completed!"
}

# Health check
health_check() {
    local namespace=${1:-$NAMESPACE}

    log "Running health checks..."

    # Check pod status
    info "Checking pod status..."
    kubectl get pods -n $namespace

    # Check service endpoints
    info "Checking service endpoints..."
    kubectl get endpoints -n $namespace

    # Test backend health endpoint
    info "Testing backend health..."
    kubectl run health-check-$(date +%s) \
        --image=curlimages/curl \
        --namespace=$namespace \
        --restart=Never \
        --rm -i --tty \
        -- curl -f http://$PROJECT_NAME-backend-service:8000/health

    # Test frontend health
    info "Testing frontend health..."
    kubectl run health-check-frontend-$(date +%s) \
        --image=curlimages/curl \
        --namespace=$namespace \
        --restart=Never \
        --rm -i --tty \
        -- curl -f http://$PROJECT_NAME-frontend-service/health

    log "Health checks completed!"
}

# Rollback deployment
rollback_deployment() {
    local component=${1:-all}
    local namespace=${2:-$NAMESPACE}

    warn "Rolling back deployment for component: $component"

    if [[ "$component" == "all" || "$component" == "backend" ]]; then
        info "Rolling back backend deployment..."
        kubectl rollout undo deployment/$PROJECT_NAME-backend -n $namespace
        kubectl rollout status deployment/$PROJECT_NAME-backend -n $namespace
    fi

    if [[ "$component" == "all" || "$component" == "frontend" ]]; then
        info "Rolling back frontend deployment..."
        kubectl rollout undo deployment/$PROJECT_NAME-frontend -n $namespace
        kubectl rollout status deployment/$PROJECT_NAME-frontend -n $namespace
    fi

    log "Rollback completed!"
}

# Backup database
backup_database() {
    local environment=${1:-production}
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"

    log "Creating database backup: $backup_name"

    # Create backup job
    kubectl run $backup_name \
        --image=postgres:15-alpine \
        --namespace=$NAMESPACE \
        --restart=Never \
        --env="PGPASSWORD=${POSTGRES_PASSWORD}" \
        -- pg_dump -h postgres-service -U postgres -d ai_schedule_manager > "/backups/$backup_name.sql"

    log "Database backup created: $backup_name"
}

# Scale deployment
scale_deployment() {
    local component=$1
    local replicas=$2
    local namespace=${3:-$NAMESPACE}

    log "Scaling $component to $replicas replicas..."

    kubectl scale deployment $PROJECT_NAME-$component --replicas=$replicas -n $namespace
    kubectl rollout status deployment/$PROJECT_NAME-$component -n $namespace

    log "Scaling completed!"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring stack..."

    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

    # Deploy Prometheus
    info "Deploying Prometheus..."
    kubectl apply -f monitoring/prometheus/ -n monitoring

    # Deploy Grafana
    info "Deploying Grafana..."
    kubectl apply -f monitoring/grafana/ -n monitoring

    # Wait for monitoring to be ready
    kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=300s
    kubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=300s

    log "Monitoring setup completed!"
}

# Cleanup resources
cleanup() {
    local namespace=${1:-$NAMESPACE}
    local confirm=${2:-false}

    if [[ "$confirm" != "true" ]]; then
        read -p "Are you sure you want to delete all resources in namespace $namespace? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Cleanup cancelled."
            return
        fi
    fi

    warn "Cleaning up resources in namespace: $namespace"

    kubectl delete namespace $namespace --ignore-not-found=true

    log "Cleanup completed!"
}

# Port forwarding for local access
port_forward() {
    local service=$1
    local local_port=$2
    local remote_port=$3
    local namespace=${4:-$NAMESPACE}

    log "Port forwarding $service from localhost:$local_port to $remote_port"

    kubectl port-forward service/$service $local_port:$remote_port -n $namespace
}

# Logs viewing
view_logs() {
    local component=$1
    local namespace=${2:-$NAMESPACE}
    local follow=${3:-false}

    if [[ "$follow" == "true" ]]; then
        kubectl logs -f -l app=$PROJECT_NAME-$component -n $namespace
    else
        kubectl logs -l app=$PROJECT_NAME-$component -n $namespace --tail=100
    fi
}

# Main function to handle commands
main() {
    case "${1:-help}" in
        "check")
            check_prerequisites
            ;;
        "build")
            build_and_push_images "${2:-latest}" "${3:-localhost}"
            ;;
        "deploy")
            deploy_to_kubernetes "${2:-development}" "${3:-latest}"
            ;;
        "migrate")
            run_migrations "${2:-development}"
            ;;
        "health")
            health_check "${2:-$NAMESPACE}"
            ;;
        "rollback")
            rollback_deployment "${2:-all}" "${3:-$NAMESPACE}"
            ;;
        "backup")
            backup_database "${2:-production}"
            ;;
        "scale")
            scale_deployment "$2" "$3" "${4:-$NAMESPACE}"
            ;;
        "monitoring")
            setup_monitoring
            ;;
        "cleanup")
            cleanup "${2:-$NAMESPACE}" "${3:-false}"
            ;;
        "port-forward")
            port_forward "$2" "$3" "$4" "${5:-$NAMESPACE}"
            ;;
        "logs")
            view_logs "$2" "${3:-$NAMESPACE}" "${4:-false}"
            ;;
        "help"|*)
            echo "AI Schedule Manager Deployment Helper"
            echo "Usage: $0 <command> [arguments...]"
            echo ""
            echo "Commands:"
            echo "  check                           - Check prerequisites"
            echo "  build [tag] [registry]          - Build and push Docker images"
            echo "  deploy [env] [tag]              - Deploy to Kubernetes"
            echo "  migrate [env]                   - Run database migrations"
            echo "  health [namespace]              - Run health checks"
            echo "  rollback [component] [ns]       - Rollback deployment"
            echo "  backup [env]                    - Backup database"
            echo "  scale <component> <replicas>    - Scale deployment"
            echo "  monitoring                      - Setup monitoring stack"
            echo "  cleanup [namespace] [confirm]   - Cleanup resources"
            echo "  port-forward <svc> <local> <remote> - Port forward service"
            echo "  logs <component> [ns] [follow]  - View logs"
            echo "  help                           - Show this help"
            ;;
    esac
}

# Run main function with all arguments
main "$@"