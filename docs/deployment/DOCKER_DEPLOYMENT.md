# 🐳 AI Schedule Manager - Docker Deployment Guide

Deploy your AI Schedule Manager with a single Docker container that includes all services and automatic Cloudflare tunnel setup with QR code access!

## 🚀 Quick Start (2 minutes)

### 1. Clone and Deploy

```bash
# Clone the repository
git clone https://github.com/yourusername/AI-Schedule-Manager.git
cd AI-Schedule-Manager

# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

That's it! The script will:
- ✅ Check prerequisites
- ✅ Build the all-in-one Docker container
- ✅ Start all services (Frontend, Backend, PostgreSQL, Redis)
- ✅ Create a Cloudflare tunnel
- ✅ Display a QR code for mobile access

## 📱 Access Methods

### 1. **QR Code Access (Easiest)**
After deployment, a QR code will be displayed in the terminal:
- Open your phone's camera app
- Point at the QR code
- Tap the notification to access

### 2. **Cloudflare Tunnel URL**
A secure HTTPS URL will be generated automatically:
```
https://random-name.trycloudflare.com
```

### 3. **Local Access**
- Web Interface: `http://localhost`
- API: `http://localhost/api`
- QR Display: `http://localhost:8081`

## 🎯 Features Included

### All-in-One Container
- ✅ **Frontend**: React application with Material-UI
- ✅ **Backend**: FastAPI with Python 3.11
- ✅ **Database**: PostgreSQL 14
- ✅ **Cache**: Redis server
- ✅ **Web Server**: Nginx
- ✅ **Tunnel**: Cloudflare tunnel for secure access
- ✅ **Monitoring**: Built-in health checks

### Security & Access
- 🔒 Automatic HTTPS via Cloudflare
- 🔐 JWT authentication
- 📱 Mobile-friendly QR code access
- 🌐 Access from anywhere
- 🛡️ DDoS protection via Cloudflare

## ⚙️ Configuration Options

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

### Cloudflare Tunnel Options

#### Option 1: Quick Tunnel (Default - No Setup Required)
```env
USE_QUICK_TUNNEL=true
```
- ✅ No Cloudflare account needed
- ✅ Instant setup
- ⚠️ Temporary URL (changes on restart)

#### Option 2: Token-Based Tunnel (Recommended for Production)
```env
USE_QUICK_TUNNEL=false
CLOUDFLARE_TUNNEL_TOKEN=your-token-here
```
- ✅ Permanent URL
- ✅ Custom domain support
- 📝 Get token from [Cloudflare Dashboard](https://one.dash.cloudflare.com/)

#### Option 3: Named Tunnel (Advanced)
```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
TUNNEL_NAME=ai-schedule-manager
TUNNEL_HOSTNAME=scheduler.yourdomain.com
```

## 🔧 Common Commands

### Container Management

```bash
# View logs
docker logs -f ai-schedule-manager

# Get tunnel URL
docker exec ai-schedule-manager cat /app/data/access-url.txt

# Display QR code in terminal
docker exec ai-schedule-manager cat /app/data/access-qr.txt

# Health check
docker exec ai-schedule-manager /app/scripts/health-check.sh

# Restart services
docker-compose -f docker-compose.tunnel.yml restart

# Stop services
docker-compose -f docker-compose.tunnel.yml down

# Remove all data (careful!)
docker-compose -f docker-compose.tunnel.yml down -v
```

### Database Access

```bash
# Access PostgreSQL
docker exec -it ai-schedule-manager psql -U scheduler -d ai_schedule_manager

# Access Redis
docker exec -it ai-schedule-manager redis-cli
```

## 📊 Default Credentials

### Web Application
- **Admin**: `admin@example.com` / `admin123`
- **Manager**: `manager@example.com` / `manager123`
- **Employee**: `employee@example.com` / `employee123`

### Services (Internal)
- **PostgreSQL**: `scheduler` / `scheduler_pass`
- **Redis**: No password (localhost only)

## 🔍 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs ai-schedule-manager

# Verify ports are available
lsof -i :80
lsof -i :8080
```

### Can't Access Tunnel URL
```bash
# Check tunnel status
docker exec ai-schedule-manager ps aux | grep cloudflared

# Restart tunnel
docker exec ai-schedule-manager supervisorctl restart cloudflared
```

### Database Connection Issues
```bash
# Check PostgreSQL status
docker exec ai-schedule-manager supervisorctl status postgresql

# Restart database
docker exec ai-schedule-manager supervisorctl restart postgresql
```

## 📈 Resource Requirements

### Minimum
- CPU: 1 core
- RAM: 1GB
- Storage: 2GB

### Recommended
- CPU: 2+ cores
- RAM: 2GB+
- Storage: 10GB+

### Adjust Resources
Edit `docker-compose.tunnel.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 4G
```

## 🔐 Security Best Practices

1. **Change Default Passwords**
   ```bash
   # Edit .env file
   JWT_SECRET=$(openssl rand -hex 32)
   JWT_REFRESH_SECRET=$(openssl rand -hex 32)
   ```

2. **Use Token-Based Tunnel for Production**
   - Get a permanent tunnel token from Cloudflare
   - Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`

3. **Enable HTTPS Only**
   - Cloudflare tunnel provides automatic HTTPS
   - Disable local HTTP access in production

4. **Regular Updates**
   ```bash
   docker pull ubuntu:22.04
   docker-compose -f docker-compose.tunnel.yml build --no-cache
   ```

## 🚀 Production Deployment

### 1. Setup Domain
```env
TUNNEL_HOSTNAME=scheduler.yourdomain.com
```

### 2. Enable Email Notifications
```env
ENABLE_EMAIL_NOTIFICATIONS=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 3. Enable Monitoring
```env
NEW_RELIC_LICENSE_KEY=your-key
SENTRY_DSN=your-dsn
```

### 4. Backup Configuration
```bash
# Automated daily backups
0 2 * * * docker exec ai-schedule-manager /app/scripts/backup.sh
```

## 📱 Mobile App Access

The QR code provides instant mobile access:

1. **iOS**: Open Camera → Scan QR → Tap notification
2. **Android**: Open Camera → Scan QR → Tap link

The web app is fully responsive and works as a PWA (Progressive Web App).

## 🆘 Support

- **Documentation**: [Full Docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/yourusername/AI-Schedule-Manager/issues)
- **Updates**: Watch this repo for updates

## 📄 License

MIT License - See [LICENSE](./LICENSE) file for details.

---

**Built with ❤️ using Docker, Cloudflare Tunnels, and AI-powered scheduling**