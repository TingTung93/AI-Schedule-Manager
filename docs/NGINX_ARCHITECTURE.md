# Nginx Architecture

## Overview

Nginx is **embedded inside the frontend container** using a multi-stage Docker build. There is NO separate Nginx container.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend Container (ai-schedule-frontend)  │
│  Port: 80                                   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Nginx (from nginx:alpine)          │   │
│  │                                     │   │
│  │  Serves:                            │   │
│  │  - React build (/usr/share/nginx/) │   │
│  │  - Static assets (JS, CSS, images) │   │
│  │  - Health endpoint (/health)       │   │
│  │                                     │   │
│  │  Proxies:                           │   │
│  │  - /api/* → backend:8000            │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
         │
         │ /api/* requests
         ↓
┌─────────────────────────────────────────────┐
│  Backend Container (ai-schedule-backend)    │
│  Port: 8000                                 │
│                                             │
│  FastAPI + Uvicorn                          │
└─────────────────────────────────────────────┘
```

## Multi-Stage Build

### Stage 1: Builder
- Base: `node:18-alpine`
- Builds React app with `npm run build`
- Produces optimized static files

### Stage 2: Production
- Base: `nginx:alpine`
- Copies built files from Stage 1
- Copies custom nginx.conf
- Starts Nginx server

## Nginx Configuration

### File: `frontend/nginx.conf`

**Key Features:**

1. **Static File Serving**
   - Root: `/usr/share/nginx/html`
   - Serves React SPA
   - React Router support (all routes → index.html)

2. **Health Endpoint**
   ```nginx
   location /health {
       return 200 "healthy\n";
   }
   ```

3. **API Proxy**
   ```nginx
   location /api {
       proxy_pass http://ai-schedule-backend:8000;
   }
   ```
   - Proxies all `/api/*` to backend
   - Includes headers for client IP, forwarding
   - 300s timeout for long requests

4. **Performance**
   - Gzip compression enabled
   - 1-year cache for static assets
   - DNS resolver for dynamic backend resolution

5. **Security Headers**
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection enabled
   - CSP and referrer policies

## Port Mapping

| Service | Internal Port | External Port | Protocol |
|---------|--------------|---------------|----------|
| Frontend (Nginx) | 80 | 80 | HTTP |
| Backend API | 8000 | 8000 | HTTP |
| PostgreSQL | 5432 | 5432 | TCP |
| Redis | 6379 | 6379 | TCP |

## Access Points

- **Frontend UI**: http://localhost:80 (or http://localhost)
- **Backend API Direct**: http://localhost:8000
- **Backend API via Nginx**: http://localhost:80/api/*

## Testing Connectivity

```bash
# Frontend health
curl http://localhost:80/health
# Returns: healthy

# Backend direct
curl http://localhost:8000/health
# Returns: {"status":"healthy",...}

# Login via Nginx proxy
curl -X POST http://localhost:80/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
# Returns: {"access_token":"...","token_type":"bearer"}
```

## Why No Separate Nginx Container?

**Benefits of embedded Nginx:**

1. **Simplicity** - One container instead of two
2. **Performance** - No network hop between containers
3. **Deployment** - Single image contains everything
4. **Security** - Smaller attack surface
5. **Build Optimization** - Multi-stage keeps image small

## Container Status

```bash
$ docker ps
NAMES                  STATUS        PORTS
ai-schedule-frontend   Up (healthy)  0.0.0.0:80->80/tcp
ai-schedule-backend    Up (healthy)  0.0.0.0:8000->8000/tcp
ai-schedule-db         Up (healthy)  5432/tcp
ai-schedule-redis      Up (healthy)  0.0.0.0:6379->6379/tcp
```

## Notes

- **No orphan containers** - The old `ai-schedule-manager-nginx-1` was removed
- **Health checks** - Both frontend and backend have proper health endpoints
- **Docker DNS** - Nginx uses Docker's internal DNS (127.0.0.11) for backend resolution
- **Reverse proxy** - All API calls go through Nginx for centralized access control
