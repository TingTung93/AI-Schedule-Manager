# Security Implementation Checklist
**AI Schedule Manager - Quick Reference Guide**

## 🔴 Critical Priority (Do First)

### 1. Secret Key Security
- [ ] Remove default SECRET_KEY from `docker-compose.yml`
- [ ] Generate strong secret: `python -c "import secrets; print(secrets.token_urlsafe(64))"`
- [ ] Add to `.env` file (ensure in `.gitignore`)
- [ ] Update docker-compose to fail if not provided:
  ```yaml
  SECRET_KEY: ${SECRET_KEY:?SECRET_KEY environment variable is required}
  ```

### 2. API Rate Limiting
- [ ] Install: `pip install slowapi==0.1.9`
- [ ] Add to `backend/src/main.py`:
  ```python
  from slowapi import Limiter
  from slowapi.util import get_remote_address

  limiter = Limiter(key_func=get_remote_address)
  app.state.limiter = limiter
  ```
- [ ] Apply to auth endpoints:
  ```python
  @app.post("/api/auth/login")
  @limiter.limit("5/minute")
  async def login(...): pass
  ```
- [ ] Apply to general API:
  ```python
  @app.get("/api/employees")
  @limiter.limit("100/minute")
  async def get_employees(...): pass
  ```

### 3. CORS Configuration
- [ ] Update `backend/src/main.py` CORS settings:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=os.getenv("CORS_ORIGINS", "").split(","),
      allow_credentials=True,
      allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
      allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
  )
  ```

## 🟡 High Priority (This Week)

### 4. CSRF Protection
- [ ] Apply `@csrf_protect` to all POST/PUT/PATCH/DELETE endpoints
- [ ] Verify frontend fetches CSRF token after login
- [ ] Test CSRF protection with automated tests

### 5. Docker Security
- [ ] Add non-root user to `backend/Dockerfile`:
  ```dockerfile
  RUN groupadd -r appuser && useradd -r -g appuser appuser
  USER appuser
  ```
- [ ] Remove database port exposure in `docker-compose.yml` (or use 127.0.0.1)
- [ ] Verify all containers run as non-root

### 6. Security Logging
- [ ] Create `backend/src/utils/security_logger.py`
- [ ] Log authentication events (login, logout, failed attempts)
- [ ] Log authorization failures
- [ ] Log password changes and resets
- [ ] Set up log aggregation/monitoring

### 7. Enhanced Security Headers
- [ ] Add CSP header to `frontend/nginx.conf`
- [ ] Add Strict-Transport-Security (for HTTPS)
- [ ] Add Referrer-Policy
- [ ] Add Permissions-Policy

## 🟢 Medium Priority (This Month)

### 8. Input Validation
- [ ] Create shared pagination dependency
- [ ] Add content-type validation middleware
- [ ] Implement request size limits
- [ ] Validate all query parameters

### 9. Error Handling
- [ ] Implement global exception handler
- [ ] Return generic errors to clients
- [ ] Log detailed errors server-side only
- [ ] Add request IDs for error tracking

### 10. Dependency Security
- [ ] Set up `safety` for Python: `pip install safety`
- [ ] Run `npm audit` for frontend
- [ ] Add dependency scanning to CI/CD
- [ ] Schedule monthly security updates

### 11. Environment Validation
- [ ] Create startup validation script
- [ ] Check for required environment variables
- [ ] Validate secret strength
- [ ] Fail fast if secrets are weak/missing

### 12. Audit Trail
- [ ] Create audit log table
- [ ] Log all state-changing operations
- [ ] Include user_id, timestamp, action, resource
- [ ] Implement audit log viewer (admin only)

## 📋 Testing Requirements

### Security Tests to Add
- [ ] Test rate limiting (verify 429 responses)
- [ ] Test CSRF protection (verify 403 without token)
- [ ] Test authentication (verify 401 without token)
- [ ] Test authorization (verify 403 without permission)
- [ ] Test input validation (SQL injection attempts)
- [ ] Test XSS protection
- [ ] Test password strength validation
- [ ] Test token expiration and refresh

### Penetration Testing
- [ ] SQL injection testing
- [ ] XSS vulnerability scanning
- [ ] CSRF attack simulation
- [ ] Brute force protection testing
- [ ] Session hijacking attempts
- [ ] API abuse testing

## 🚀 Pre-Production Deployment Checklist

- [ ] All critical issues resolved
- [ ] All high priority issues resolved
- [ ] Security headers configured
- [ ] Rate limiting active
- [ ] HTTPS enabled with valid certificate
- [ ] Database not exposed to internet
- [ ] Secrets rotated and strong
- [ ] Error logging configured
- [ ] Monitoring/alerting set up
- [ ] Backup strategy implemented
- [ ] Incident response plan documented
- [ ] Security testing completed
- [ ] Code review completed
- [ ] Dependency audit passed

## 🔒 Ongoing Security Practices

### Daily
- [ ] Monitor security logs
- [ ] Review failed login attempts
- [ ] Check for suspicious activity

### Weekly
- [ ] Review new security alerts
- [ ] Update critical dependencies
- [ ] Review access logs

### Monthly
- [ ] Run dependency security scans
- [ ] Review and rotate API keys
- [ ] Update non-critical dependencies
- [ ] Review user permissions

### Quarterly
- [ ] Rotate database credentials
- [ ] Security audit
- [ ] Penetration testing
- [ ] Update security documentation
- [ ] Review incident response plan

## 📞 Security Incident Response

### If Security Breach Detected:
1. **Isolate:** Disconnect affected systems
2. **Assess:** Determine scope and impact
3. **Contain:** Prevent further damage
4. **Notify:** Inform affected users
5. **Remediate:** Fix vulnerability
6. **Document:** Record incident details
7. **Learn:** Update procedures

### Emergency Contacts
- Security Team Lead: [Contact Info]
- System Administrator: [Contact Info]
- Legal/Compliance: [Contact Info]

## 🛠️ Quick Commands

```bash
# Generate secret key
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Check Python dependencies
pip install safety
safety check

# Check Node dependencies
npm audit
npm audit fix

# Test rate limiting
for i in {1..10}; do curl -X POST http://localhost:8000/api/auth/login; done

# View security logs
tail -f backend/logs/security.log

# Check for exposed secrets (before commit)
git secrets --scan
```

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Guide](https://fastapi.tiangolo.com/tutorial/security/)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Docker Security](https://docs.docker.com/engine/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/auth-methods.html)

---

**Last Updated:** 2025-11-18
**Next Review:** 2025-12-18
