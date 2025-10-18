#!/bin/bash

# This stops and removes Kubernetes Exam Simulator Docker containers

set -e

echo "🐳 Stopping Kubernetes Exam Simulator (Docker Deployment)"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Step 1: Stop any existing containers
print_status "Stopping any existing containers..."
docker stop k8s-exam-simulator 2>/dev/null || true
docker rm k8s-exam-simulator 2>/dev/null || true
print_success "Existing containers cleaned up"

# Step 2: Remove old images (optional - use --clean flag)
if [ "$1" = "--clean" ]; then
    print_status "Removing old Docker images..."
    docker rmi k8s-exam-simulator 2>/dev/null || true
    docker rmi k8s-exam-simulator:lightweight 2>/dev/null || true
    print_success "Docker Images cleaned up"
fi

# Step 3: Display comprehensive success summary
echo ""
echo "================================================"
print_success "Kubernetes Exam Simulator Docker Container Stopped!"
echo "================================================"
echo ""
echo -e "🐳 Want to start it back? Here are some hints to run from the project root:"
echo -e "  > ${GREEN}./docker-start.sh${NC} # Asks the user for the options"
echo -e "  > ${GREEN}./docker-start.sh --clean${NC} # Clean up old images and ask users for other options"
echo ""
