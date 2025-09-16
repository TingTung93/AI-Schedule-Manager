#!/bin/bash

# QR Code Display Script
# This script monitors for tunnel URL and displays QR code for easy access

set -e

TUNNEL_INFO_FILE="/app/data/tunnel-info.json"
QR_CODE_FILE="/app/data/access-qr.png"
QR_ASCII_FILE="/app/data/access-qr.txt"
HTML_FILE="/var/www/html/qr-access.html"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to generate QR code in multiple formats
generate_qr_codes() {
    local url=$1

    echo -e "${BLUE}Generating QR codes...${NC}"

    # Generate PNG QR code
    qrencode -o "$QR_CODE_FILE" -s 10 "$url"

    # Generate ASCII QR code for terminal display
    qrencode -t ANSI -o "$QR_ASCII_FILE" "$url"

    # Generate HTML page with QR code and instructions
    cat > "$HTML_FILE" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Schedule Manager - Access Portal</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
        }
        .qr-container {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            display: inline-block;
        }
        .qr-code {
            max-width: 250px;
            height: auto;
        }
        .url-display {
            background: #e9ecef;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        .instructions {
            background: #e7f5ff;
            border-left: 4px solid #1c7ed6;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: left;
        }
        .instructions h3 {
            color: #1c7ed6;
            margin-bottom: 10px;
        }
        .instructions ol {
            margin-left: 20px;
            color: #495057;
        }
        .instructions li {
            margin: 5px 0;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 30px 0;
        }
        .feature {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
        }
        .feature-icon {
            font-size: 24px;
            margin-bottom: 5px;
        }
        .feature-text {
            font-size: 14px;
            color: #666;
        }
        .status {
            display: inline-block;
            background: #51cf66;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            transition: transform 0.2s;
        }
        .button:hover {
            transform: translateY(-2px);
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #868e96;
            font-size: 12px;
        }
        @media (max-width: 600px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 24px;
            }
            .qr-code {
                max-width: 200px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status">● ONLINE</div>
        <h1>🗓️ AI Schedule Manager</h1>
        <p class="subtitle">Scan QR code or click the link to access</p>

        <div class="qr-container">
            <img src="data:image/png;base64,$(base64 -w 0 $QR_CODE_FILE)" alt="QR Code" class="qr-code">
        </div>

        <div class="url-display">
            <strong>Access URL:</strong><br>
            <a href="$url" target="_blank" style="color: #1c7ed6; text-decoration: none;">$url</a>
        </div>

        <a href="$url" class="button" target="_blank">Open Application</a>

        <div class="features">
            <div class="feature">
                <div class="feature-icon">👥</div>
                <div class="feature-text">Employee Management</div>
            </div>
            <div class="feature">
                <div class="feature-icon">📅</div>
                <div class="feature-text">Smart Scheduling</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🤖</div>
                <div class="feature-text">AI Optimization</div>
            </div>
            <div class="feature">
                <div class="feature-icon">📊</div>
                <div class="feature-text">Analytics</div>
            </div>
        </div>

        <div class="instructions">
            <h3>📱 Mobile Access Instructions:</h3>
            <ol>
                <li>Open your phone's camera app</li>
                <li>Point it at the QR code above</li>
                <li>Tap the notification that appears</li>
                <li>Login with your credentials</li>
            </ol>
        </div>

        <div class="footer">
            <p>Secured by Cloudflare Tunnel • Generated: $(date '+%Y-%m-%d %H:%M:%S')</p>
            <p>For support, visit the admin dashboard</p>
        </div>
    </div>

    <script>
        // Auto-refresh every 30 seconds to check for URL changes
        setTimeout(function() {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>
EOF

    echo -e "${GREEN}QR codes generated successfully${NC}"
}

# Function to display QR code in terminal
display_terminal_qr() {
    local url=$1

    echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}          AI SCHEDULE MANAGER - READY FOR ACCESS!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}\n"

    echo -e "${CYAN}📱 Scan this QR code with your mobile device:${NC}\n"

    # Display ASCII QR code if available
    if [ -f "$QR_ASCII_FILE" ]; then
        cat "$QR_ASCII_FILE"
    fi

    echo -e "\n${YELLOW}🔗 Access URL:${NC} ${BLUE}$url${NC}"
    echo -e "\n${MAGENTA}💡 Tips:${NC}"
    echo -e "   • ${CYAN}Mobile:${NC} Scan the QR code with your camera app"
    echo -e "   • ${CYAN}Desktop:${NC} Open the URL in your browser"
    echo -e "   • ${CYAN}Local QR:${NC} View at http://localhost/qr-access.html"

    echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}\n"
}

# Function to monitor for tunnel URL
monitor_tunnel() {
    echo -e "${BLUE}Monitoring for tunnel URL...${NC}"

    local last_url=""
    local check_count=0

    while true; do
        # Check if tunnel info file exists
        if [ -f "$TUNNEL_INFO_FILE" ]; then
            # Extract URL from JSON file
            if command -v jq &> /dev/null; then
                current_url=$(jq -r '.url' "$TUNNEL_INFO_FILE" 2>/dev/null)
            else
                # Fallback to grep if jq is not available
                current_url=$(grep -oP '"url"\s*:\s*"\K[^"]+' "$TUNNEL_INFO_FILE" 2>/dev/null)
            fi

            # Check if URL has changed
            if [ -n "$current_url" ] && [ "$current_url" != "$last_url" ]; then
                echo -e "${GREEN}New tunnel URL detected: $current_url${NC}"

                # Generate QR codes
                generate_qr_codes "$current_url"

                # Display QR code in terminal
                display_terminal_qr "$current_url"

                last_url="$current_url"

                # Also save a simple text file with the URL for easy access
                echo "$current_url" > /app/data/access-url.txt
            fi
        else
            if [ $((check_count % 10)) -eq 0 ]; then
                echo -e "${YELLOW}Waiting for tunnel to be established...${NC}"
            fi
        fi

        check_count=$((check_count + 1))
        sleep 3
    done
}

# Function to display local access information
display_local_info() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                 LOCAL ACCESS INFORMATION${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}While waiting for tunnel setup, you can access locally:${NC}"
    echo -e "   • ${CYAN}Web Interface:${NC} http://localhost"
    echo -e "   • ${CYAN}API Endpoint:${NC} http://localhost/api"
    echo -e "   • ${CYAN}Health Check:${NC} http://localhost/health"
    echo -e "   • ${CYAN}QR Code Page:${NC} http://localhost/qr-access.html"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
}

# Main execution
main() {
    # Create necessary directories
    mkdir -p /app/data /var/www/html

    # Display local access information
    display_local_info

    # Start monitoring for tunnel URL
    monitor_tunnel
}

# Trap to handle shutdown gracefully
trap "echo 'Shutting down QR display...'; exit 0" SIGTERM SIGINT

# Run main function
main