#!/bin/bash

# Kubernetes Exam Simulator - Local Development Startup Script
# This script ensures a clean startup with all recent fixes

set -e

echo "🚀 Starting Kubernetes Exam Simulator (Local Development)"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Clean up any existing processes
print_status "Cleaning up existing Node.js processes..."
pkill -f node || true
pkill -f npm || true
sleep 2
print_success "Existing processes cleaned up"

# Step 2: Verify project structure
PROJECT_ROOT="/mnt/c/Users/ramaistroaie/OneDrive - ENDAVA/Documents/kubernetes-demo-platform"
BACKEND_DIR="$PROJECT_ROOT/app/backend"
FRONTEND_DIR="$PROJECT_ROOT/app/frontend"

if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

print_success "Project structure verified"

# Step 3: Check for question banks
QUESTION_BANK="$PROJECT_ROOT/question-bank"
if [ ! -d "$QUESTION_BANK" ]; then
    print_error "Question bank not found: $QUESTION_BANK"
    exit 1
fi

# Check all exam types and difficulties
EXAM_TYPES=("ckad" "cka" "cks" "kcna")
DIFFICULTIES=("easy" "intermediate" "hard")
TOTAL_QUESTIONS=0

print_status "Checking question banks..."
for exam_type in "${EXAM_TYPES[@]}"; do
    EXAM_DIR="$QUESTION_BANK/$exam_type"
    if [ -d "$EXAM_DIR" ]; then
        print_status "Found $exam_type exam type"
        
        for difficulty in "${DIFFICULTIES[@]}"; do
            DIFFICULTY_DIR="$EXAM_DIR/$difficulty"
            if [ -d "$DIFFICULTY_DIR" ]; then
                QUESTION_COUNT=$(find "$DIFFICULTY_DIR" -name "*.json" | wc -l)
                if [ $QUESTION_COUNT -gt 0 ]; then
                    print_success "  $difficulty: $QUESTION_COUNT questions"
                    TOTAL_QUESTIONS=$((TOTAL_QUESTIONS + QUESTION_COUNT))
                else
                    print_warning "  $difficulty: no questions found"
                fi
            else
                print_warning "  $difficulty: directory not found"
            fi
        done
    else
        print_warning "$exam_type exam type not found"
    fi
done

print_success "Total questions available: $TOTAL_QUESTIONS"

if [ $TOTAL_QUESTIONS -eq 0 ]; then
    print_error "No questions found in any question bank"
    exit 1
fi

# Step 4: Check frontend dependencies
if [ ! -d "$FRONTEND_DIR" ]; then
    print_warning "Frontend directory not found: $FRONTEND_DIR"
    START_FRONTEND=false
else
    print_status "Checking frontend dependencies..."
    cd "$FRONTEND_DIR"
    
    if [ ! -f "package.json" ]; then
        print_warning "Frontend package.json not found"
        START_FRONTEND=false
    elif [ ! -d "node_modules" ]; then
        print_warning "Frontend node_modules not found, installing dependencies..."
        npm install
        START_FRONTEND=true
    else
        START_FRONTEND=true
    fi
    
    if [ "$START_FRONTEND" = true ]; then
        print_success "Frontend dependencies ready"
    fi
fi

# Step 5: Verify backend dependencies
print_status "Checking backend dependencies..."
cd "$BACKEND_DIR"

if [ ! -f "package.json" ]; then
    print_error "Backend package.json not found"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    print_warning "Backend node_modules not found, installing dependencies..."
    npm install
fi

# Step 6: Verify critical files exist
CRITICAL_FILES=(
    "src/index.js"
    "src/routes/questions.js"
    "src/routes/exam.js"
    "src/routes/helm.js"
    "src/services/question-provider/question-service.js"
    "src/services/helm-generator/helm-service.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Critical file missing: $file"
        exit 1
    fi
done

print_success "All critical backend files present"

# Step 7: Test service imports
print_status "Testing service imports..."
node -e "
try {
    require('./src/services/question-provider/question-service');
    require('./src/services/helm-generator/helm-service');
    console.log('✅ All services load successfully');
} catch(error) {
    console.error('❌ Service import error:', error.message);
    process.exit(1);
}
" || exit 1

# Step 8: Start backend in development mode
print_status "Starting backend server on port 8080..."

# Create a background process for the backend with optimized Node.js options
NODE_ENV=development PORT=8080 NODE_OPTIONS="--max-old-space-size=2048 --no-warnings" node src/index.js &
BACKEND_PID=$!

# Wait for backend to start with intelligent polling
print_status "Waiting for backend to start (optimized polling)..."
BACKEND_WAIT_COUNT=0
BACKEND_MAX_WAIT=30  # Reduced from 30 (10 seconds)

while [ $BACKEND_WAIT_COUNT -lt $BACKEND_MAX_WAIT ]; do
    if curl -f -s http://localhost:8080/api/health > /dev/null; then
        print_success "Backend is healthy and responding after $BACKEND_WAIT_COUNT attempts"
        break
    fi
    BACKEND_WAIT_COUNT=$((BACKEND_WAIT_COUNT + 1))
    sleep 0.5  # Check every 0.5 seconds instead of waiting 10 seconds
done

if [ $BACKEND_WAIT_COUNT -eq $BACKEND_MAX_WAIT ]; then
    print_error "Backend health check failed after $BACKEND_MAX_WAIT seconds"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Test questions API
print_status "Testing questions API..."
QUESTIONS_RESPONSE=$(curl -s "http://localhost:8080/api/questions?exam_type=ckad&difficulty=beginner")
if echo "$QUESTIONS_RESPONSE" | grep -q "ckad-e-"; then
    print_success "Questions API returning real question data"
else
    print_warning "Questions API may not be returning real questions"
fi

# Step 9: Start frontend (if available)
if [ "$START_FRONTEND" = true ]; then
    print_status "Starting frontend server on port 3000..."
    print_status "Frontend configured to proxy API calls to backend on port 8080"
    print_warning "React dev server startup optimized - should take 1-2 minutes (was 10+ minutes)"
    cd "$FRONTEND_DIR"
    
    # Install missing dependencies quickly if needed
    if [ ! -d "node_modules/@craco" ]; then
        print_status "Installing CRACO for faster builds..."
        npm install @craco/craco --no-audit --no-fund --silent
    fi
    
    NODE_OPTIONS="--no-deprecation --max-old-space-size=4096" npm start &
    FRONTEND_PID=$!
    print_success "Frontend started in background"
    
    # Reduced wait time - frontend will continue starting in background
    sleep 3
    
    # Test if frontend is responsive (optional - frontend might take longer to start)
    if curl -f -s http://localhost:3000 > /dev/null; then
        print_success "Frontend is responding on port 3000"
        print_success "API calls from frontend will be automatically proxied to backend"
    else
        print_warning "Frontend may still be starting up (this is normal)"
    fi
else
    print_warning "Frontend will not be started"
    FRONTEND_PID=""
fi

# Step 10: Display startup summary
echo ""
echo "================================================"
print_success "Kubernetes Exam Simulator Started Successfully!"
echo "================================================"
echo ""
echo "🔗 Backend API: http://localhost:8080"
echo "🔗 Health Check: http://localhost:8080/api/health"
echo "🔗 Questions API: http://localhost:8080/api/questions?exam_type=ckad&difficulty=beginner"
if [ "$START_FRONTEND" = true ]; then
    echo "🔗 Frontend UI: http://localhost:3000"
fi
echo ""
if [ "$START_FRONTEND" = true ]; then
    echo "   ✅ Full-stack development environment"
    echo "   ⏳ Frontend still starting (may take 1-2 more minutes)"
else
    echo "   ⚠️  Backend-only mode (frontend not available)"
fi
echo ""
echo "Press Ctrl+C to stop all services..."
echo ""

# Cleanup function
cleanup() {
    print_status "Shutting down services..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        print_success "Backend stopped"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        print_success "Frontend stopped"
    fi
    
    print_success "All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running
wait
