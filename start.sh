#!/bin/bash

# Main startup script for AI Schedule Manager
echo "🚀 Starting AI Schedule Manager..."

# Check if dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install --legacy-peer-deps && cd ..
fi

if [ ! -d "backend/venv" ]; then
    echo "🐍 Setting up Python environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -q -r requirements.txt
    cd ..
fi

# Start both services
echo "✅ Starting services..."
npm start