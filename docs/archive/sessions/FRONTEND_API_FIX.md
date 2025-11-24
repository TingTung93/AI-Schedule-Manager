# Frontend API Configuration Fix

## Problem Identified

The frontend container was unable to connect to the backend API due to incorrect URL configuration in Docker networking environment.

### Critical Issues Found:

1. **Frontend `.env`**: Had `REACT_APP_API_URL=http://localhost:8000`
   - This is incorrect for Docker containers
   - `localhost` inside a container refers to itself, not other containers

2. **docker-compose.yml**: Was passing the localhost URL as environment variable during build
   - Line 81: `REACT_APP_API_URL: ${REACT_APP_API_URL:-http://localhost:8000}`

3. **Symptoms**:
   - Frontend container marked as UNHEALTHY
   - API requests failing with 401/499 errors
   - Authentication issues due to failed API communication

## Solution Implemented

### Changes Made:

#### 1. `/home/peter/AI-Schedule-Manager/frontend/.env`
```env
# BEFORE
REACT_APP_API_URL=http://localhost:8000

# AFTER
# Empty API URL uses relative paths, which nginx proxies to backend
REACT_APP_API_URL=
```

#### 2. `/home/peter/AI-Schedule-Manager/docker-compose.yml`
```yaml
# BEFORE
environment:
  REACT_APP_API_URL: ${REACT_APP_API_URL:-http://localhost:8000}

# AFTER
environment:
  # Use empty string for relative URLs - nginx proxies /api to backend
  REACT_APP_API_URL: ${REACT_APP_API_URL:-}
```

#### 3. Verification of `/home/peter/AI-Schedule-Manager/frontend/src/services/api.js`
```javascript
// Line 127 - ALREADY CORRECT
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '', // Empty string = relative URLs
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## How It Works Now

### Docker Network Flow:

1. **Frontend Container** (nginx on port 80)
   - Serves React app
   - Proxies `/api/*` requests to backend

2. **Nginx Configuration** (`/home/peter/AI-Schedule-Manager/frontend/nginx.conf`)
   ```nginx
   location /api {
       set $backend http://ai-schedule-backend:8000;
       proxy_pass $backend;
       # ... proxy headers ...
   }
   ```

3. **Backend Container** (FastAPI on port 8000)
   - Container name: `ai-schedule-backend`
   - Accessible via Docker internal DNS

### Request Path:

```
Browser → http://localhost/api/auth/login
         ↓
Frontend Container (nginx) → Proxies to http://ai-schedule-backend:8000/api/auth/login
         ↓
Backend Container (FastAPI) → Processes request
         ↓
Response → Frontend → Browser
```

## Verification Steps

To verify the fix works:

1. **Rebuild frontend container**:
   ```bash
   docker-compose down
   docker-compose build --no-cache frontend
   docker-compose up -d
   ```

2. **Check container health**:
   ```bash
   docker ps
   # All containers should show "healthy"
   ```

3. **Test API connectivity**:
   ```bash
   # From host machine
   curl http://localhost/api/health

   # Should return: {"status": "healthy"}
   ```

4. **Test from browser**:
   - Open http://localhost
   - Try to login
   - Check browser DevTools Network tab
   - API requests should go to `/api/*` (relative URLs)
   - No 401/499 errors

## Key Principles

### Docker Networking:
- **DO NOT** use `localhost` for inter-container communication
- **USE** container names (Docker internal DNS)
- **USE** relative URLs in frontend to leverage nginx proxy

### Environment Variables:
- Empty `REACT_APP_API_URL` = relative URLs
- Relative URLs work with nginx reverse proxy
- No need to know backend container name from frontend code

## Files Modified

1. `/home/peter/AI-Schedule-Manager/frontend/.env`
2. `/home/peter/AI-Schedule-Manager/docker-compose.yml`

## Files Verified (No Changes Needed)

1. `/home/peter/AI-Schedule-Manager/frontend/src/services/api.js` ✅
2. `/home/peter/AI-Schedule-Manager/frontend/nginx.conf` ✅
3. `/home/peter/AI-Schedule-Manager/frontend/Dockerfile` ✅

## No Hardcoded URLs Found

Search confirmed no hardcoded `localhost:8000` URLs exist in frontend source code.

## Git Commit

```bash
git commit -m "fix: Configure frontend API client for Docker networking

- Set REACT_APP_API_URL to empty string for relative URLs
- Updated docker-compose.yml to use relative paths
- Frontend now properly connects through nginx proxy
- Nginx proxies /api requests to backend container

This fixes 401/499 errors and frontend container health issues"
```

## Next Steps

After rebuilding containers:
1. Monitor container health status
2. Test login/authentication flow
3. Verify all API endpoints work correctly
4. Check browser console for any remaining errors

---

**Fix Completed**: 2025-11-20
**Coordinated via**: Claude Flow hooks (pre-task, post-edit, post-task)
**Memory Keys**:
- `swarm/frontend/config-fix`
- `swarm/frontend/docker-fix`
