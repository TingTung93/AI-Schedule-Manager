#!/bin/bash

# Cloudflare Tunnel Setup Script
# This script sets up a Cloudflare tunnel and generates connection information

set -e

TUNNEL_NAME="${TUNNEL_NAME:-ai-schedule-manager}"
TUNNEL_CONFIG="/app/config/cloudflared"
TUNNEL_CREDENTIALS="/app/config/cloudflared/credentials"
TUNNEL_INFO_FILE="/app/data/tunnel-info.json"
QR_CODE_FILE="/app/data/access-qr.png"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Cloudflare Tunnel Setup...${NC}"

# Create config directories
mkdir -p "$TUNNEL_CONFIG" "$TUNNEL_CREDENTIALS" /app/data

# Function to setup tunnel with token (recommended method)
setup_tunnel_with_token() {
    if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
        echo -e "${GREEN}Using provided Cloudflare Tunnel token${NC}"
        cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"
    else
        echo -e "${YELLOW}No tunnel token provided, attempting other methods...${NC}"
        return 1
    fi
}

# Function to setup tunnel with credentials file
setup_tunnel_with_credentials() {
    if [ -f "$TUNNEL_CREDENTIALS/credentials.json" ]; then
        echo -e "${GREEN}Using existing tunnel credentials${NC}"

        # Create config.yml if it doesn't exist
        if [ ! -f "$TUNNEL_CONFIG/config.yml" ]; then
            cat > "$TUNNEL_CONFIG/config.yml" <<EOF
tunnel: $TUNNEL_NAME
credentials-file: $TUNNEL_CREDENTIALS/credentials.json

ingress:
  - hostname: ${TUNNEL_HOSTNAME:-ai-scheduler.local}
    service: http://localhost:80
  - service: http_status:404
EOF
        fi

        cloudflared tunnel --config "$TUNNEL_CONFIG/config.yml" run "$TUNNEL_NAME"
    else
        echo -e "${YELLOW}No credentials file found${NC}"
        return 1
    fi
}

# Function to setup quick tunnel (no authentication required)
setup_quick_tunnel() {
    echo -e "${GREEN}Starting Cloudflare Quick Tunnel (no authentication required)${NC}"
    echo -e "${YELLOW}Note: This creates a temporary tunnel with a random URL${NC}"

    # Start cloudflared tunnel and capture output
    cloudflared tunnel --no-autoupdate --url http://localhost:80 2>&1 | while IFS= read -r line; do
        echo "$line"

        # Extract the tunnel URL from cloudflared output
        if echo "$line" | grep -q "https://.*\.trycloudflare.com"; then
            TUNNEL_URL=$(echo "$line" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com')

            if [ -n "$TUNNEL_URL" ]; then
                echo -e "${GREEN}Tunnel URL detected: $TUNNEL_URL${NC}"

                # Save tunnel information
                cat > "$TUNNEL_INFO_FILE" <<EOF
{
    "url": "$TUNNEL_URL",
    "type": "quick",
    "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "hostname": "$(hostname)",
    "local_url": "http://localhost:80"
}
EOF

                # Generate QR code
                qrencode -o "$QR_CODE_FILE" -s 10 "$TUNNEL_URL"

                # Display connection information
                echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}"
                echo -e "${GREEN}    AI Schedule Manager - Ready for Access!${NC}"
                echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
                echo -e "${BLUE}Access URL:${NC} ${YELLOW}$TUNNEL_URL${NC}"
                echo -e "${BLUE}QR Code saved to:${NC} $QR_CODE_FILE"
                echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}\n"
            fi
        fi
    done
}

# Function to create a permanent tunnel (requires Cloudflare account)
create_permanent_tunnel() {
    echo -e "${BLUE}Creating permanent Cloudflare Tunnel...${NC}"

    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        echo -e "${RED}Missing Cloudflare credentials. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN${NC}"
        return 1
    fi

    # Login to Cloudflare
    cloudflared tunnel login

    # Create tunnel
    cloudflared tunnel create "$TUNNEL_NAME"

    # Configure tunnel
    cat > "$TUNNEL_CONFIG/config.yml" <<EOF
tunnel: $TUNNEL_NAME
credentials-file: $HOME/.cloudflared/${TUNNEL_NAME}.json

ingress:
  - hostname: ${TUNNEL_HOSTNAME:-ai-scheduler.example.com}
    service: http://localhost:80
  - service: http_status:404
EOF

    # Route DNS (if hostname is provided)
    if [ -n "$TUNNEL_HOSTNAME" ]; then
        cloudflared tunnel route dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME"
    fi

    # Run tunnel
    cloudflared tunnel run "$TUNNEL_NAME"
}

# Main execution flow
main() {
    # Wait for services to be ready
    echo -e "${BLUE}Waiting for services to start...${NC}"
    sleep 5

    # Check if backend is ready
    while ! curl -f http://localhost:8000/health > /dev/null 2>&1; do
        echo "Waiting for backend API..."
        sleep 2
    done

    echo -e "${GREEN}Backend API is ready${NC}"

    # Try different tunnel setup methods in order of preference
    if ! setup_tunnel_with_token; then
        if ! setup_tunnel_with_credentials; then
            if [ "$USE_QUICK_TUNNEL" = "true" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
                setup_quick_tunnel
            else
                create_permanent_tunnel
            fi
        fi
    fi
}

# Trap to handle shutdown gracefully
trap "echo 'Shutting down tunnel...'; exit 0" SIGTERM SIGINT

# Start the tunnel
main

# Keep the script running
while true; do
    sleep 30
    # Check if tunnel is still running
    if ! pgrep -x "cloudflared" > /dev/null; then
        echo -e "${RED}Tunnel process died, restarting...${NC}"
        main
    fi
done