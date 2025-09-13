#!/bin/bash
set -e

echo "🚀 Starting Kubernetes Exam Simulator in Development Mode"
echo "========================================================"

# Change to project directory
cd "$(dirname "$0")"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd app/backend
npm install
cd ../..

# Install frontend dependencies  
echo "📦 Installing frontend dependencies..."
cd app/frontend
npm install
cd ../..

# Build frontend
echo "🏗️  Building frontend..."
cd app/frontend
npm run build
cd ../..

# Start backend server
echo "🎯 Starting backend server..."
cd app/backend
NODE_ENV=production npm start