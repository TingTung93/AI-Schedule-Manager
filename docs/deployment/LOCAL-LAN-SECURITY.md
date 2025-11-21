# Local/LAN Deployment Security Model

## Overview

AI Schedule Manager is designed for **local host or intranet LAN deployment only**. This security model assumes the application is not exposed to the public internet and is protected by your network perimeter security.

## Security Configuration

### 🔐 Authentication & JWT Tokens

**SECRET_KEY Configuration:**
- A secure random SECRET_KEY has been generated for JWT token signing
- Located in: `backend/.env` and root `.env`
- **Cryptographically secure**: 43+ characters, URL-safe base64 encoded

**To Generate Your Own SECRET_KEY:**

```bash
# Option 1: Using Python (recommended)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Option 2: Using OpenSSL
openssl rand -base64 32

# Option 3: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Then update your `.env` files:
```bash
SECRET_KEY=your_generated_key_here
```

**⚠️ IMPORTANT:**
- Change the SECRET_KEY if you suspect it has been compromised
- Use different SECRET_KEYs for different deployment instances
- Never commit your SECRET_KEY to version control
- Minimum length: 32 characters (enforced at startup)

### 🚫 Rate Limiting - DISABLED

**Configuration:**
```python
# backend/src/core/config.py
RATE_LIMIT_ENABLED: bool = False  # Intentionally disabled for LAN
RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60  # Not enforced
```

**Why Disabled:**
- Application runs on trusted local/LAN network
- No public internet exposure
- Performance optimization for local use
- Simplified user experience

**If You Need Rate Limiting:**

Edit `backend/.env`:
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST_SIZE=10
```

## Network Security Assumptions

### ✅ What This Model Assumes

1. **Network Perimeter Protection:**
   - Application behind firewall/router
   - No port forwarding from internet
   - LAN access only (192.168.x.x, 10.x.x.x, 172.16-31.x.x)

2. **Trusted Users:**
   - All users are on trusted network
   - Physical/network access control in place
   - Organization-managed devices

3. **Local Threats Mitigated:**
   - Authentication still required (no anonymous access)
   - JWT tokens expire after 24 hours
   - Password hashing with bcrypt
   - SQL injection protection via SQLAlchemy ORM
   - XSS protection via React escaping

### ⚠️ What This Model Does NOT Protect Against

If you expose this application to the internet, you will need:

1. **Rate Limiting** - Re-enable to prevent brute force attacks
2. **HTTPS/TLS** - Encrypt traffic (currently HTTP for LAN)
3. **WAF** - Web Application Firewall for DDoS protection
4. **Advanced Monitoring** - SIEM/log aggregation for attack detection
5. **API Gateway** - Additional authentication/authorization layer
6. **Stricter CORS** - Limit origins more aggressively

## Deployment Scenarios

### ✅ Recommended: Local Host (Single Machine)

```bash
# Run on localhost only
uvicorn main:app --host 127.0.0.1 --port 8000
```

**Access:** http://localhost:8000 (this machine only)

**Security:** Maximum - Only accessible from local machine

### ✅ Recommended: LAN/Intranet

```bash
# Run on all interfaces (accessible on LAN)
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Access:** http://192.168.1.100:8000 (example LAN IP)

**Security:** Good - Requires network access to your LAN

**CORS Configuration:**
```bash
# backend/.env
CORS_ORIGINS=["http://192.168.1.100:3000","http://192.168.1.100:80"]
```

### ❌ NOT Recommended: Internet Exposure

Do **not** expose this application directly to the internet without:
- HTTPS/SSL certificates (Let's Encrypt)
- Rate limiting enabled
- Reverse proxy (nginx/Caddy) with security headers
- Monitoring and alerting
- Regular security audits

## Security Best Practices for LAN Deployment

### 1. Password Security
```bash
# Enforce strong passwords in frontend
- Minimum 8 characters
- Mix of uppercase, lowercase, numbers
- No common passwords
```

### 2. Regular Backups
```bash
# Backup database daily
pg_dump schedule_manager > backup_$(date +%Y%m%d).sql
```

### 3. Monitor Logs
```bash
# Check logs for suspicious activity
tail -f backend/logs/app.log | grep -i "error\|fail\|unauthorized"
```

### 4. Update Dependencies
```bash
# Check for security updates monthly
pip list --outdated
npm outdated
```

### 5. Access Control
- Use Windows/Linux user accounts for access control
- Don't share login credentials
- Rotate SECRET_KEY if employee leaves

## Validating Your Setup

### Check SECRET_KEY
```bash
# Verify SECRET_KEY is secure
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv('backend/.env')
key = os.getenv('SECRET_KEY')
print(f'Length: {len(key)} chars')
print(f'Secure: {len(key) >= 32 and key != \"your-secret-key-change-in-production\"}')"
```

Expected output:
```
Length: 43 chars
Secure: True
```

### Check Rate Limiting Status
```bash
# Verify rate limiting is disabled
curl http://localhost:8000/api/v1/health | grep -i rate
```

### Test Authentication
```bash
# Verify JWT tokens work
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

Should return a JWT token.

## Incident Response

### If SECRET_KEY is Compromised

1. **Generate new key immediately:**
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Update all .env files:**
   ```bash
   SECRET_KEY=new_key_here
   ```

3. **Restart application:**
   ```bash
   # All existing tokens will become invalid
   sudo systemctl restart ai-schedule-manager
   ```

4. **Notify users to log in again**

### If Unauthorized Access Detected

1. **Check logs:** `backend/logs/app.log`
2. **Review recent database changes:** Check audit logs
3. **Reset affected user passwords**
4. **Consider changing SECRET_KEY**
5. **Review network access logs**

## Questions?

For security concerns or questions about this deployment model, see:
- `docs/security/SECURITY.md` - Security policies
- `docs/architecture/ASSESSMENT.md` - Architecture review
- `docs/technical-debt/ANALYSIS.md` - Security findings

---

**Remember:** This security model is appropriate for local/LAN deployment only. If your requirements change, re-evaluate your security posture.
