#!/usr/bin/env bash
# Render build script - Memoir
# This script runs during the Render build phase

set -e  # Exit on error

echo "=== Memoir Render Build ==="

# Install backend Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Create uploads directory
mkdir -p uploads

echo "=== Build complete ==="
