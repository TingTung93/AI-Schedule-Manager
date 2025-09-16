#!/bin/bash

# Deploy Monitoring Stack
# This script sets up the complete monitoring infrastructure

set -euo pipefail

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_DIR="${MONITORING_DIR}/config/monitoring"
COMPOSE_FILE="${CONFIG_DIR}/docker-compose.monitoring.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi

    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi

    # Set compose command
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi

    success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log "Creating monitoring directories..."

    local dirs=(
        "${CONFIG_DIR}/prometheus/rules"
        "${CONFIG_DIR}/grafana/provisioning/dashboards"
        "${CONFIG_DIR}/grafana/provisioning/datasources"
        "${CONFIG_DIR}/grafana/dashboards"
        "${CONFIG_DIR}/alertmanager"
        "${CONFIG_DIR}/blackbox"
        "${CONFIG_DIR}/fluentd/conf"
        "${MONITORING_DIR}/data/prometheus"
        "${MONITORING_DIR}/data/grafana"
        "${MONITORING_DIR}/data/elasticsearch"
        "${MONITORING_DIR}/data/alertmanager"
    )

    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        log "Created directory: $dir"
    done

    success "Directories created successfully"
}

# Setup configuration files
setup_configurations() {
    log "Setting up configuration files..."

    # Grafana provisioning - datasources
    cat > "${CONFIG_DIR}/grafana/provisioning/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    database: "[ai-schedule-manager-logs-*]"
    basicAuth: true
    basicAuthUser: elastic
    basicAuthPassword: \${ELASTICSEARCH_PASSWORD}
    jsonData:
      interval: Daily
      timeField: "@timestamp"
      esVersion: "8.0.0"
      maxConcurrentShardRequests: 5
EOF

    # Grafana provisioning - dashboards
    cat > "${CONFIG_DIR}/grafana/provisioning/dashboards/dashboards.yml" << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

    # Blackbox exporter configuration
    cat > "${CONFIG_DIR}/blackbox/blackbox.yml" << EOF
modules:
  http_2xx:
    prober: http
    timeout: 10s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: []
      method: GET
      follow_redirects: true
      preferred_ip_protocol: "ip4"

  http_post_2xx:
    prober: http
    timeout: 10s
    http:
      method: POST
      headers:
        Content-Type: application/json
      body: '{"health": "check"}'

  tcp_connect:
    prober: tcp
    timeout: 5s

  pop3s_banner:
    prober: tcp
    timeout: 5s
    tcp:
      query_response:
        - expect: "^+OK"
      tls: true
      tls_config:
        insecure_skip_verify: false

  grpc:
    prober: grpc
    timeout: 5s
    grpc:
      tls: true
      preferred_ip_protocol: "ip4"

  grpc_plain:
    prober: grpc
    timeout: 5s
    grpc:
      tls: false
      service: "health"
EOF

    # Fluentd Dockerfile
    cat > "${CONFIG_DIR}/fluentd/Dockerfile" << 'EOF'
FROM fluent/fluentd:v1.16-debian-1

# Switch to root to install plugins
USER root

# Install required plugins
RUN buildDeps="sudo make gcc g++ libc-dev" \
    && apt-get update \
    && apt-get install -y --no-install-recommends $buildDeps \
    && sudo gem install fluent-plugin-elasticsearch \
    && sudo gem install fluent-plugin-prometheus \
    && sudo gem install fluent-plugin-systemd \
    && sudo gem install fluent-plugin-geoip \
    && sudo gem install fluent-plugin-record-transformer \
    && sudo gem cleanup \
    && SUDO_FORCE_REMOVE=yes \
    apt-get purge -y --auto-remove \
                  -o APT::AutoRemove::RecommendsImportant=false \
                  $buildDeps \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* /var/tmp/* /usr/lib/ruby/gems/*/cache/*.gem

# Copy configuration
COPY conf/ /fluentd/etc/

# Switch back to fluent user
USER fluent
EOF

    success "Configuration files created successfully"
}

# Check environment variables
check_environment() {
    log "Checking environment variables..."

    local required_vars=(
        "GRAFANA_ADMIN_PASSWORD"
        "ELASTICSEARCH_PASSWORD"
        "PAGERDUTY_ROUTING_KEY"
        "SLACK_WEBHOOK_URL"
        "SMTP_HOST"
        "SMTP_USER"
        "SMTP_PASSWORD"
        "SMTP_FROM"
        "ONCALL_EMAIL"
        "TEAM_EMAIL"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            error "  - $var"
        done
        warn "Please set these variables in your .env file or environment"
        exit 1
    fi

    success "Environment variables check passed"
}

# Deploy monitoring stack
deploy_stack() {
    log "Deploying monitoring stack..."

    cd "$CONFIG_DIR"

    # Pull latest images
    log "Pulling latest Docker images..."
    $COMPOSE_CMD -f docker-compose.monitoring.yml pull

    # Start the stack
    log "Starting monitoring services..."
    $COMPOSE_CMD -f docker-compose.monitoring.yml up -d

    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30

    # Check service health
    check_services_health

    success "Monitoring stack deployed successfully"
}

# Check services health
check_services_health() {
    log "Checking services health..."

    local services=(
        "prometheus:9090"
        "grafana:3000"
        "alertmanager:9093"
        "elasticsearch:9200"
        "kibana:5601"
    )

    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"

        log "Checking $name on port $port..."

        local max_attempts=30
        local attempt=0

        while [[ $attempt -lt $max_attempts ]]; do
            if curl -s "http://localhost:$port" > /dev/null 2>&1; then
                success "$name is healthy"
                break
            fi

            ((attempt++))
            if [[ $attempt -eq $max_attempts ]]; then
                error "$name is not responding after $max_attempts attempts"
                return 1
            fi

            sleep 2
        done
    done

    success "All services are healthy"
}

# Import Grafana dashboards
import_dashboards() {
    log "Importing Grafana dashboards..."

    # Wait for Grafana to be fully ready
    sleep 10

    # Copy dashboard files to Grafana volume
    docker cp "${MONITORING_DIR}/monitoring/dashboards/grafana-dashboard-main.json" \
        grafana:/var/lib/grafana/dashboards/main-dashboard.json

    docker cp "${MONITORING_DIR}/monitoring/dashboards/grafana-business-metrics.json" \
        grafana:/var/lib/grafana/dashboards/business-metrics.json

    # Restart Grafana to pick up new dashboards
    docker restart grafana

    success "Dashboards imported successfully"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."

    cat > /tmp/monitoring-logrotate << 'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=100M
  missingok
  delaycompress
  copytruncate
}
EOF

    sudo mv /tmp/monitoring-logrotate /etc/logrotate.d/monitoring

    success "Log rotation configured"
}

# Create backup script
create_backup_script() {
    log "Creating backup script..."

    cat > "${MONITORING_DIR}/scripts/monitoring/backup-monitoring.sh" << 'EOF'
#!/bin/bash

# Backup Monitoring Data
set -euo pipefail

BACKUP_DIR="/opt/monitoring-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/monitoring_backup_${DATE}"

mkdir -p "$BACKUP_PATH"

# Backup Prometheus data
docker run --rm -v prometheus_data:/data -v "$BACKUP_PATH":/backup \
  alpine tar czf /backup/prometheus_data.tar.gz -C /data .

# Backup Grafana data
docker run --rm -v grafana_data:/data -v "$BACKUP_PATH":/backup \
  alpine tar czf /backup/grafana_data.tar.gz -C /data .

# Backup Elasticsearch data
docker run --rm -v elasticsearch_data:/data -v "$BACKUP_PATH":/backup \
  alpine tar czf /backup/elasticsearch_data.tar.gz -C /data .

# Backup AlertManager data
docker run --rm -v alertmanager_data:/data -v "$BACKUP_PATH":/backup \
  alpine tar czf /backup/alertmanager_data.tar.gz -C /data .

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "monitoring_backup_*" -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $BACKUP_PATH"
EOF

    chmod +x "${MONITORING_DIR}/scripts/monitoring/backup-monitoring.sh"

    success "Backup script created"
}

# Print deployment summary
print_summary() {
    log "Deployment Summary:"
    echo
    echo "🌐 Service URLs:"
    echo "  - Grafana:      http://localhost:3000 (admin/admin)"
    echo "  - Prometheus:   http://localhost:9090"
    echo "  - AlertManager: http://localhost:9093"
    echo "  - Kibana:       http://localhost:5601"
    echo "  - Elasticsearch: http://localhost:9200"
    echo
    echo "📊 Next Steps:"
    echo "  1. Change Grafana admin password"
    echo "  2. Configure alert receivers in AlertManager"
    echo "  3. Test alert notifications"
    echo "  4. Set up scheduled backups"
    echo "  5. Configure external access (reverse proxy)"
    echo
    echo "📁 Important Files:"
    echo "  - Docker Compose: ${COMPOSE_FILE}"
    echo "  - Prometheus Config: ${CONFIG_DIR}/prometheus/prometheus.yml"
    echo "  - Alert Rules: ${CONFIG_DIR}/prometheus/rules/"
    echo "  - AlertManager Config: ${CONFIG_DIR}/alertmanager/alertmanager.yml"
    echo
    echo "🔧 Management Commands:"
    echo "  - View logs: $COMPOSE_CMD -f $COMPOSE_FILE logs -f [service]"
    echo "  - Restart service: $COMPOSE_CMD -f $COMPOSE_FILE restart [service]"
    echo "  - Stop stack: $COMPOSE_CMD -f $COMPOSE_FILE down"
    echo "  - Update stack: $COMPOSE_CMD -f $COMPOSE_FILE pull && $COMPOSE_CMD -f $COMPOSE_FILE up -d"
    echo
}

# Main function
main() {
    log "Starting monitoring stack deployment..."

    check_prerequisites
    create_directories
    setup_configurations
    check_environment
    deploy_stack
    import_dashboards
    setup_log_rotation
    create_backup_script
    print_summary

    success "Monitoring stack deployment completed successfully!"
}

# Run main function
main "$@"