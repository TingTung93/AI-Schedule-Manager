# Backend Dockerfile for AI Schedule Manager
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    libmagic1 \
    libmagic-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads

# Create non-root user and set ownership
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Make startup script executable
RUN chmod +x /app/scripts/startup.sh

# Health check - increased timeout and reduced frequency to prevent overwhelming the app
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f --max-time 4 http://localhost:8000/health || exit 1

# Run the application with startup script
CMD ["/app/scripts/startup.sh"]
