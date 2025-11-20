#!/bin/bash
# Backend Health Monitor - Automatically restart on failure

CONTAINER_NAME="ai-schedule-backend"
CHECK_INTERVAL=30  # seconds
MAX_FAILURES=2

failure_count=0

echo "Starting backend health monitor..."
echo "Checking every ${CHECK_INTERVAL}s, will restart after ${MAX_FAILURES} consecutive failures"

while true; do
    # Test health endpoint with 5 second timeout
    if curl -sf -m 5 http://localhost:8000/health > /dev/null 2>&1; then
        if [ $failure_count -gt 0 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend recovered (was failing)"
        fi
        failure_count=0
    else
        failure_count=$((failure_count + 1))
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check FAILED (${failure_count}/${MAX_FAILURES})"

        if [ $failure_count -ge $MAX_FAILURES ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting backend container..."
            docker restart $CONTAINER_NAME
            failure_count=0
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting 30s for backend to start..."
            sleep 30
        fi
    fi

    sleep $CHECK_INTERVAL
done
