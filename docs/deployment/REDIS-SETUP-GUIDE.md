# Redis Setup Guide

## Installation on WSL

### 1. Install Redis

```bash
# Update package list
sudo apt update

# Install Redis server
sudo apt install -y redis-server

# Verify installation
redis-server --version
```

### 2. Start Redis Service

```bash
# Start Redis
sudo service redis-server start

# Check status
sudo service redis-server status

# Test connection
redis-cli ping
# Should return: PONG
```

### 3. Configure Redis (Optional)

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Key settings to consider:
# maxmemory 256mb                    # Set memory limit
# maxmemory-policy allkeys-lru       # Eviction policy
# save 900 1                         # Persistence settings
# save 300 10
# save 60 10000

# Restart after changes
sudo service redis-server restart
```

### 4. Update Backend Environment Variables

```bash
cd /home/peter/AI-Schedule-Manager/backend

# Update .env with Redis configuration
cat >> .env <<EOF

# Redis Configuration
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379/0
REDIS_MAX_CONNECTIONS=10
CACHE_TTL=3600
EOF
```

### 5. Test Redis Connection

```bash
# Test via redis-cli
redis-cli

# Inside redis-cli:
SET test_key "Hello Redis"
GET test_key
DEL test_key
PING
QUIT
```

### 6. Test from Python

```bash
cd /home/peter/AI-Schedule-Manager/backend

python3 <<EOF
import redis
import asyncio
from src.config import settings

# Test basic connection
try:
    r = redis.from_url(settings.REDIS_URL or "redis://localhost:6379/0")
    r.ping()
    print("✅ Redis connection successful!")

    # Test set/get
    r.set("test_key", "Hello from Python")
    value = r.get("test_key")
    print(f"✅ Test value: {value.decode('utf-8')}")

    # Cleanup
    r.delete("test_key")
    print("✅ Redis is working properly!")
except Exception as e:
    print(f"❌ Redis connection failed: {e}")
EOF
```

## Redis Use Cases in Schedule Manager

### 1. Session Caching

```python
# Cache user sessions
await redis_client.setex(
    f"session:{user_id}",
    3600,  # 1 hour TTL
    session_data
)
```

### 2. Schedule Caching

```python
# Cache frequently accessed schedules
await redis_client.setex(
    f"schedule:{schedule_id}",
    1800,  # 30 minutes TTL
    schedule_data
)
```

### 3. Rate Limiting

```python
# Track API request rates
key = f"rate_limit:{user_id}:{endpoint}"
count = await redis_client.incr(key)
if count == 1:
    await redis_client.expire(key, 60)  # 1 minute window
```

### 4. Real-time Updates

```python
# Pub/Sub for real-time schedule updates
await redis_client.publish(
    f"schedule_updates:{department_id}",
    update_message
)
```

## Troubleshooting

### Redis Not Starting

```bash
# Check logs
sudo tail -f /var/log/redis/redis-server.log

# Restart service
sudo service redis-server restart

# Check if port is in use
sudo netstat -plnt | grep 6379
```

### Connection Refused

```bash
# Check if Redis is running
sudo service redis-server status

# Check if listening on correct interface
redis-cli -h localhost ping

# Check firewall settings
sudo ufw status
```

### Memory Issues

```bash
# Check memory usage
redis-cli info memory

# Clear all data (CAUTION!)
redis-cli FLUSHALL

# Set memory limit
redis-cli CONFIG SET maxmemory 256mb
```

### Performance Tuning

```bash
# Monitor Redis in real-time
redis-cli --stat

# Monitor commands
redis-cli MONITOR

# Get slow queries
redis-cli SLOWLOG GET 10
```

## Optional: Redis for Production

### Enable Persistence

```bash
# Edit config
sudo nano /etc/redis/redis.conf

# Enable RDB snapshots
save 900 1      # Save after 900 sec if at least 1 key changed
save 300 10     # Save after 300 sec if at least 10 keys changed
save 60 10000   # Save after 60 sec if at least 10000 keys changed

# Enable AOF (Append Only File)
appendonly yes
appendfsync everysec
```

### Set Up Replication (Advanced)

```bash
# On replica server
redis-cli CONFIG SET replicaof master_ip 6379
```

### Monitoring

```bash
# Install Redis monitoring tools
sudo apt install -y redis-tools

# Set up monitoring script
cat > /home/peter/AI-Schedule-Manager/scripts/monitor_redis.sh <<'EOF'
#!/bin/bash
while true; do
    echo "=== Redis Status at $(date) ==="
    redis-cli INFO | grep -E "(used_memory_human|connected_clients|total_commands_processed)"
    echo ""
    sleep 60
done
EOF

chmod +x /home/peter/AI-Schedule-Manager/scripts/monitor_redis.sh
```

## Security Best Practices

1. **Bind to localhost only** (default): `bind 127.0.0.1`
2. **Set password**: `requirepass YourStrongPasswordHere`
3. **Disable dangerous commands**:
   ```
   rename-command FLUSHDB ""
   rename-command FLUSHALL ""
   rename-command CONFIG ""
   ```
4. **Use TLS for production**: Configure Redis with SSL/TLS

## Backup and Restore

### Manual Backup

```bash
# Trigger save
redis-cli SAVE

# Copy RDB file
sudo cp /var/lib/redis/dump.rdb /backups/redis_backup_$(date +%Y%m%d_%H%M%S).rdb
```

### Restore from Backup

```bash
# Stop Redis
sudo service redis-server stop

# Replace dump.rdb
sudo cp /backups/redis_backup_20250121_120000.rdb /var/lib/redis/dump.rdb

# Fix permissions
sudo chown redis:redis /var/lib/redis/dump.rdb

# Start Redis
sudo service redis-server start
```

## Alternative: Redis Optional

If you prefer to run without Redis initially:

```bash
# Update backend/.env
REDIS_ENABLED=false

# Application will work without caching
# Performance may be slower for repeated queries
```

## Next Steps

After Redis setup:
1. ✅ Redis installed and running
2. ✅ Backend configured to use Redis
3. ✅ Connection tested
4. ⏭️  Test full stack with caching enabled
5. ⏭️  Monitor cache hit rates
