#!/bin/bash

# AI Schedule Manager - Docker Deployment Script with Cloudflare Tunnel
# This script deploys the all-in-one container and sets up Cloudflare tunnel with QR code display

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# ASCII Art Banner
display_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
     _    ___   ____       _              _       _
    / \  |_ _| / ___|  ___| |__   ___  __| |_   _| | ___ _ __
   / _ \  | |  \___ \ / __| '_ \ / _ \/ _` | | | | |/ _ \ '__|
  / ___ \ | |   ___) | (__| | | |  __/ (_| | |_| | |  __/ |
 /_/   \_\___| |____/ \___|_| |_|\___|\__,_|\__,_|_|\___|_|

EOF
    echo -e "${NC}"
    echo -e "${GREEN}AI-Powered Schedule Management System${NC}"
    echo -e "${YELLOW}Docker Deployment with Cloudflare Tunnel${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo "Please install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    else
        echo -e "${GREEN}✓ Docker is installed${NC}"
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
        exit 1
    else
        echo -e "${GREEN}✓ Docker Compose is installed${NC}"
    fi

    # Check if port 80 is available
    if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Port 80 is already in use${NC}"
        echo "The application will still work but local access might be affected"
    else
        echo -e "${GREEN}✓ Port 80 is available${NC}"
    fi

    echo ""
}

# Function to setup environment
setup_environment() {
    echo -e "${BLUE}Setting up environment...${NC}"

    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Creating .env file...${NC}"
        cat > .env << 'EOF'
# AI Schedule Manager Environment Configuration

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-this-$(openssl rand -hex 32)
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this-$(openssl rand -hex 32)

# Cloudflare Tunnel Configuration
# Option 1: Quick Tunnel (default - no setup required)
USE_QUICK_TUNNEL=true

# Option 2: Token-based tunnel (get token from Cloudflare dashboard)
# CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here

# Option 3: Named tunnel (requires Cloudflare account)
# CLOUDFLARE_ACCOUNT_ID=your-account-id
# CLOUDFLARE_API_TOKEN=your-api-token
# TUNNEL_NAME=ai-schedule-manager
# TUNNEL_HOSTNAME=scheduler.yourdomain.com

# Email Configuration (optional)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password

# Feature Flags
ENABLE_WEBSOCKET=true
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_BACKUP=true

# Resource Limits (adjust based on your system)
# DOCKER_CPUS=2.0
# DOCKER_MEMORY=2G
EOF
        echo -e "${GREEN}✓ .env file created${NC}"
    else
        echo -e "${GREEN}✓ .env file already exists${NC}"
    fi

    # Create necessary directories
    mkdir -p data logs config/cloudflared
    echo -e "${GREEN}✓ Directories created${NC}"

    echo ""
}

# Function to build and start services
deploy_services() {
    echo -e "${BLUE}Building and deploying services...${NC}"

    # Determine Docker Compose command
    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Build the all-in-one image
    echo -e "${YELLOW}Building Docker image (this may take a few minutes)...${NC}"
    $COMPOSE_CMD -f docker-compose.tunnel.yml build

    # Start services
    echo -e "${YELLOW}Starting services...${NC}"
    $COMPOSE_CMD -f docker-compose.tunnel.yml up -d

    echo -e "${GREEN}✓ Services deployed${NC}"
    echo ""
}

# Function to wait for services
wait_for_services() {
    echo -e "${BLUE}Waiting for services to be ready...${NC}"

    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if docker exec ai-schedule-manager curl -f http://localhost/health &> /dev/null; then
            echo -e "${GREEN}✓ Services are ready!${NC}"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "\n${RED}❌ Services did not become ready in time${NC}"
    echo "Check logs with: docker logs ai-schedule-manager"
    return 1
}

# Function to display QR code and access information
display_access_info() {
    echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}          DEPLOYMENT SUCCESSFUL! 🎉${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}\n"

    # Get tunnel URL if available
    if docker exec ai-schedule-manager test -f /app/data/tunnel-info.json 2>/dev/null; then
        TUNNEL_URL=$(docker exec ai-schedule-manager cat /app/data/access-url.txt 2>/dev/null || echo "")

        if [ -n "$TUNNEL_URL" ]; then
            echo -e "${CYAN}📱 CLOUDFLARE TUNNEL ACCESS:${NC}"
            echo -e "${YELLOW}$TUNNEL_URL${NC}\n"

            # Display QR code if available
            if docker exec ai-schedule-manager test -f /app/data/access-qr.txt 2>/dev/null; then
                echo -e "${CYAN}Scan this QR code with your mobile device:${NC}"
                docker exec ai-schedule-manager cat /app/data/access-qr.txt
            fi
        fi
    else
        echo -e "${YELLOW}⏳ Cloudflare tunnel is being established...${NC}"
        echo -e "${YELLOW}   Check status with: docker logs ai-schedule-manager${NC}\n"
    fi

    echo -e "${CYAN}📍 LOCAL ACCESS:${NC}"
    echo -e "   • ${BLUE}Web Interface:${NC} http://localhost"
    echo -e "   • ${BLUE}API Endpoint:${NC} http://localhost/api"
    echo -e "   • ${BLUE}Health Check:${NC} http://localhost/health"
    echo -e "   • ${BLUE}QR Display:${NC} http://localhost:8081"

    echo -e "\n${CYAN}🔧 USEFUL COMMANDS:${NC}"
    echo -e "   • ${YELLOW}View logs:${NC} docker logs -f ai-schedule-manager"
    echo -e "   • ${YELLOW}View tunnel URL:${NC} docker exec ai-schedule-manager cat /app/data/access-url.txt"
    echo -e "   • ${YELLOW}Stop services:${NC} docker-compose -f docker-compose.tunnel.yml down"
    echo -e "   • ${YELLOW}Restart services:${NC} docker-compose -f docker-compose.tunnel.yml restart"
    echo -e "   • ${YELLOW}View QR in terminal:${NC} docker exec ai-schedule-manager cat /app/data/access-qr.txt"

    echo -e "\n${CYAN}📚 DEFAULT CREDENTIALS:${NC}"
    echo -e "   • ${BLUE}Admin:${NC} admin@example.com / admin123"
    echo -e "   • ${BLUE}Manager:${NC} manager@example.com / manager123"
    echo -e "   • ${BLUE}Employee:${NC} employee@example.com / employee123"

    echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}\n"
}

# Function to monitor logs
monitor_logs() {
    echo -e "${CYAN}Would you like to monitor the logs? (y/n)${NC}"
    read -r response

    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Showing logs (press Ctrl+C to exit)...${NC}"
        docker logs -f ai-schedule-manager
    fi
}

# Main execution
main() {
    display_banner
    check_prerequisites
    setup_environment
    deploy_services

    if wait_for_services; then
        # Give tunnel a moment to establish
        echo -e "${YELLOW}Waiting for Cloudflare tunnel to establish...${NC}"
        sleep 10

        display_access_info
        monitor_logs
    else
        echo -e "${RED}Deployment encountered issues. Check the logs for details.${NC}"
        exit 1
    fi
}

# Handle script termination
trap "echo -e '\n${YELLOW}Deployment script terminated${NC}'" SIGINT SIGTERM

# Run main function
main "$@"