#!/bin/bash
set -e

echo "========================================="
echo "AI Schedule Manager - Backend Startup"
echo "========================================="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "  PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "✓ PostgreSQL is ready!"

# Run migrations
echo ""
echo "Running database migrations..."
cd /app
alembic upgrade head
echo "✓ Migrations complete!"

# Run database seeding
echo ""
echo "Seeding database..."
python scripts/seed_data.py || echo "⚠ Seeding skipped (data may already exist)"
echo "✓ Database initialization complete!"

echo ""
echo "========================================="
echo "Starting application server..."
echo "========================================="

# Start the application
exec uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
