#!/bin/bash

# Backend startup script
echo "Starting AI Schedule Manager Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Start the server
echo "Starting FastAPI server on port 8000..."
python src/main.py