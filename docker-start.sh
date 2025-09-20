#!/bin/bash

# Kubernetes Exam Simulator - Docker Deployment Startup Script
# This script builds and runs the application in a Docker container with all fixes
# Includes original Docker functionality plus streamlined interactive configuration

set -e

echo "🐳 Starting Kubernetes Exam Simulator (Docker Deployment)"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD_GREEN='\033[1;32m'
DIM='\033[2m'
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

print_input() {
    echo -e "${CYAN}[INPUT]${NC} $1"
}

print_default() {
    echo -e "${BOLD_GREEN}[DEFAULT]${NC} $1"
}

# Step 1: Verify we're in the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$PROJECT_ROOT/Dockerfile" ]; then
    print_error "Dockerfile not found. Please run this script from the project root."
    exit 1
fi

cd "$PROJECT_ROOT"
print_success "Project root verified"

# Step 2: Streamlined Interactive Configuration
echo ""
echo "🔧 Configuration (press Enter for defaults)"
echo "================================================"

# Port selection with input field
print_input "Application port:"
print_default "Press Enter for default: ${BOLD_GREEN}8080${NC}"
read -p "Port: " port_input
if [[ "$port_input" =~ ^[0-9]+$ ]] && [ "$port_input" -ge 1000 ] && [ "$port_input" -le 65535 ]; then
    APP_PORT=$port_input
elif [ -z "$port_input" ]; then
    APP_PORT=8080
    print_success "Using default port: 8080"
else
    print_warning "Invalid port '$port_input'. Using default 8080."
    APP_PORT=8080
fi

if [ "$APP_PORT" != "8080" ]; then
    print_success "Using port: $APP_PORT"
fi

# Kubernetes context selection
echo ""
print_input "Kubernetes Configuration:"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_warning "kubectl not found on host system"
    KUBECTL_AVAILABLE=false
else
    KUBECTL_AVAILABLE=true
    print_success "kubectl found on host system"
fi

# Kubeconfig and context selection
MOUNT_KUBECONFIG=""
KUBE_CONTEXT=""

if [ "$KUBECTL_AVAILABLE" = true ]; then
    # Check for kubeconfig
    if [ -f "$HOME/.kube/config" ]; then
        print_success "Found kubeconfig at $HOME/.kube/config"
        
        # Get current context
        current_context=$(kubectl config current-context 2>/dev/null || echo "")
        
        if [ -n "$current_context" ]; then
            print_input "Kubernetes context:"
            print_default "Press Enter for default: ${BOLD_GREEN}$current_context${NC}"
            echo -e "  ${DIM}Or type:${NC}"
            echo -e "  ${DIM}- 'none' to run without kubeconfig${NC}"
            echo -e "  ${DIM}- context name to use specific context${NC}"
            
            # Get available contexts for reference
            contexts=$(kubectl config get-contexts -o name 2>/dev/null || echo "")
            if [ -n "$contexts" ] && [ $(echo "$contexts" | wc -l) -gt 1 ]; then
                echo -e "  ${DIM}Available: $(echo "$contexts" | tr '\n' ', ' | sed 's/, $//')${NC}"
            fi
            
            read -p "Context: " context_input
            
            if [ -z "$context_input" ]; then
                # Default: use current context
                KUBE_CONTEXT=$current_context
                MOUNT_KUBECONFIG="-v $HOME/.kube/config:/root/.kube/config:ro"
                print_success "Using default context: $current_context"
            elif [ "$context_input" = "none" ]; then
                # Run isolated
                KUBE_CONTEXT=""
                MOUNT_KUBECONFIG=""
                print_status "Container will run isolated (no kubeconfig)"
            else
                # Check if specified context exists
                if echo "$contexts" | grep -q "^$context_input$"; then
                    KUBE_CONTEXT=$context_input
                    MOUNT_KUBECONFIG="-v $HOME/.kube/config:/root/.kube/config:ro"
                    print_success "Using context: $context_input"
                else
                    print_warning "Context '$context_input' not found. Using default: $current_context"
                    KUBE_CONTEXT=$current_context
                    MOUNT_KUBECONFIG="-v $HOME/.kube/config:/root/.kube/config:ro"
                fi
            fi
        else
            print_warning "No current context found in kubeconfig"
            MOUNT_KUBECONFIG=""
            KUBE_CONTEXT=""
        fi
    else
        print_warning "No kubeconfig found at $HOME/.kube/config"
        MOUNT_KUBECONFIG=""
        KUBE_CONTEXT=""
    fi
else
    print_status "Skipping Kubernetes configuration (kubectl not available)"
    MOUNT_KUBECONFIG=""
    KUBE_CONTEXT=""
fi

# Networking configuration
echo ""
print_input "Container networking:"
print_default "Press Enter for default: ${BOLD_GREEN}bridge${NC} (isolated with port mapping)"
echo -e "  ${DIM}Or type:${NC}"
echo -e "  ${DIM}- 'host' for host networking${NC}"
echo -e "  ${DIM}- network name for custom network${NC}"
read -p "Network: " network_input

if [ -z "$network_input" ]; then
    # Default: bridge network
    NETWORK_CONFIG="-p $APP_PORT:8080"
    NETWORK_MODE="bridge"
    print_success "Using default: bridge network"
elif [ "$network_input" = "host" ]; then
    NETWORK_CONFIG="--network host"
    NETWORK_MODE="host"
    print_success "Using host network"
    print_warning "Application accessible on all host interfaces"
else
    # Custom network
    NETWORK_CONFIG="--network $network_input -p $APP_PORT:8080"
    NETWORK_MODE="custom ($network_input)"
    print_success "Using custom network: $network_input"
fi

# Docker options
echo ""
print_input "Docker options:"
print_default "Press Enter for default: ${BOLD_GREEN}standard${NC} (no special privileges)"
echo -e "  ${DIM}Or type:${NC}"
echo -e "  ${DIM}- 'privileged' for privileged mode${NC}"
echo -e "  ${DIM}- custom options (e.g., '--privileged --cap-add=SYS_ADMIN')${NC}"
read -p "Options: " docker_options_input

if [ -z "$docker_options_input" ]; then
    # Default: standard run
    ADDITIONAL_OPTIONS=""
    print_success "Using default: standard Docker options"
elif [ "$docker_options_input" = "privileged" ]; then
    ADDITIONAL_OPTIONS="--privileged"
    print_success "Using privileged mode"
    print_warning "Running with elevated privileges"
else
    # Custom options
    ADDITIONAL_OPTIONS="$docker_options_input"
    print_success "Using custom options: $docker_options_input"
fi

# Step 3: Display configuration summary
echo ""
echo "📋 Configuration Summary"
echo "================================================"
echo -e "Port: ${GREEN}$APP_PORT${NC}"
echo -e "Network: ${GREEN}$NETWORK_MODE${NC}"
if [ -n "$KUBE_CONTEXT" ]; then
    echo -e "Kubernetes Context: ${GREEN}$KUBE_CONTEXT${NC}"
else
    echo -e "Kubernetes: ${YELLOW}Not configured${NC}"
fi
if [ -n "$ADDITIONAL_OPTIONS" ]; then
    echo -e "Docker Options: ${GREEN}$ADDITIONAL_OPTIONS${NC}"
else
    echo -e "Docker Options: ${GREEN}Standard${NC}"
fi
echo ""

# Quick confirmation
print_input "Continue with this configuration?"
print_default "Press Enter for ${BOLD_GREEN}Yes${NC}, or type 'n' for No"
read -p "Continue? " confirm
if [[ "$confirm" =~ ^[Nn] ]]; then
    print_status "Aborted by user"
    exit 0
fi

# Step 4: Verify project structure
print_status "Verifying project structure..."
REQUIRED_DIRS=(
    "app/backend"
    "app/frontend"
    "question-bank"
    "helm-templates"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        print_error "Required directory not found: $dir"
        exit 1
    fi
done

# Check question bank content for all exam types
EXAM_TYPES=("ckad" "cka" "cks" "kcna")
DIFFICULTIES=("easy" "intermediate" "hard")
TOTAL_QUESTIONS=0

print_status "Checking question banks for Docker build..."
for exam_type in "${EXAM_TYPES[@]}"; do
    EXAM_DIR="question-bank/$exam_type"
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

print_success "Total questions available for Docker build: $TOTAL_QUESTIONS"

if [ $TOTAL_QUESTIONS -eq 0 ]; then
    print_error "No questions found in any question bank"
    exit 1
fi

# Verify critical backend files
CRITICAL_FILES=(
    "app/backend/src/index.js"
    "app/backend/src/routes/questions.js"
    "app/backend/src/routes/exam.js"
    "app/backend/src/routes/helm.js"
    "app/backend/src/services/question-provider/question-service.js"
    "app/backend/src/services/helm-generator/helm-service.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Critical file missing: $file"
        exit 1
    fi
done

print_success "All critical files present for Docker build"

# Step 5: Stop any existing containers
print_status "Stopping any existing containers..."
docker stop k8s-exam-simulator 2>/dev/null || true
docker rm k8s-exam-simulator 2>/dev/null || true
print_success "Existing containers cleaned up"

# Step 6: Remove old images (optional - use --clean flag)
if [ "$1" = "--clean" ]; then
    print_status "Removing old Docker images..."
    docker rmi k8s-exam-simulator 2>/dev/null || true
    docker system prune -f
    print_success "Old images cleaned up"
fi

# Step 7: Build Docker image with optimizations
print_status "Building Docker image with caching optimizations (this may take a few minutes)..."
print_status "Using Docker layer caching for faster builds on subsequent runs"

# Use BuildKit for better performance and caching
export DOCKER_BUILDKIT=1

if docker build -t k8s-exam-simulator .; then
    print_success "Docker image built successfully"
else
    print_error "Docker build failed"
    exit 1
fi

# Step 8: Run the container with selected configuration
print_status "Starting Docker container with selected configuration..."

# Build the docker run command
DOCKER_CMD="docker run -d --name k8s-exam-simulator"
DOCKER_CMD="$DOCKER_CMD $NETWORK_CONFIG"
DOCKER_CMD="$DOCKER_CMD -e NODE_ENV=production -e PORT=8080"

# Add host networking fix for Kubernetes cluster access
# This allows the container to reach the host machine's services
DOCKER_CMD="$DOCKER_CMD --add-host=host.docker.internal:host-gateway"

if [ -n "$KUBE_CONTEXT" ]; then
    DOCKER_CMD="$DOCKER_CMD -e KUBE_CONTEXT=$KUBE_CONTEXT"
fi

if [ -n "$MOUNT_KUBECONFIG" ]; then
    DOCKER_CMD="$DOCKER_CMD $MOUNT_KUBECONFIG"
fi

if [ -n "$ADDITIONAL_OPTIONS" ]; then
    DOCKER_CMD="$DOCKER_CMD $ADDITIONAL_OPTIONS"
fi

DOCKER_CMD="$DOCKER_CMD k8s-exam-simulator"

# Execute the command
print_status "Executing: $DOCKER_CMD"
eval $DOCKER_CMD

# Wait for container to start
print_status "Waiting for container to fully initialize..."
sleep 8

# Step 9: Check container startup and logs
print_status "Checking container startup logs..."
if ! docker ps | grep -q k8s-exam-simulator; then
    print_error "Container failed to start"
    docker logs k8s-exam-simulator
    exit 1
fi

# Show container startup output
echo ""
echo "=== Container Startup Logs ==="
docker logs k8s-exam-simulator | tail -20
echo "============================="
echo ""

# Step 10: Test container health and new functionality
print_status "Testing container health and new features..."

# Determine the correct URL based on network mode
if [ "$NETWORK_MODE" = "host" ]; then
    TEST_URL="http://localhost:8080"
else
    TEST_URL="http://localhost:$APP_PORT"
fi

# Test health endpoint
if curl -f -s $TEST_URL/api/health > /dev/null; then
    print_success "Container is healthy and responding"
else
    print_error "Container health check failed"
    docker logs k8s-exam-simulator
    exit 1
fi

# Test questions API (NEW FIX VALIDATION)
print_status "Testing questions API fixes..."
QUESTIONS_RESPONSE=$(curl -s "$TEST_URL/api/questions?exam_type=ckad&difficulty=beginner")
if echo "$QUESTIONS_RESPONSE" | grep -q "ckad-e-"; then
    print_success "✅ Questions API returning real question data with original IDs"
else
    print_warning "⚠️  Questions API may not be returning real questions"
    echo "Response preview: $(echo "$QUESTIONS_RESPONSE" | head -c 200)..."
fi

# Test helm API availability (NEW FIX VALIDATION)
print_status "Testing Helm API integration..."
HELM_RESPONSE=$(curl -s -X POST $TEST_URL/api/helm/generate \
   -H "Content-Type: application/json" \
   -d '{"type":"ckad","difficulty":"beginner"}')

if echo "$HELM_RESPONSE" | grep -q "success"; then
    print_success "✅ Helm API is working and generating charts with infrastructure requirements"
else
    print_warning "⚠️  Helm API response: $(echo "$HELM_RESPONSE" | head -c 200)..."
fi

# Step 11: Test kubectl/helm availability in container (ORIGINAL FUNCTIONALITY)
print_status "Verifying Kubernetes tools in container..."
docker exec k8s-exam-simulator kubectl version --client > /dev/null 2>&1 && \
    print_success "✅ kubectl available in container" || \
    print_warning "⚠️  kubectl check failed"

docker exec k8s-exam-simulator helm version > /dev/null 2>&1 && \
    print_success "✅ helm available in container" || \
    print_warning "⚠️  helm check failed"

# Step 12: Check cluster connectivity with selected context
if [ -n "$KUBE_CONTEXT" ]; then
    print_status "Testing Kubernetes cluster connectivity with context: $KUBE_CONTEXT"
    if docker exec k8s-exam-simulator kubectl --context="$KUBE_CONTEXT" cluster-info > /dev/null 2>&1; then
        NODE_COUNT=$(docker exec k8s-exam-simulator kubectl --context="$KUBE_CONTEXT" get nodes --no-headers 2>/dev/null | wc -l)
        print_success "✅ Connected to Kubernetes cluster '$KUBE_CONTEXT' with $NODE_COUNT nodes"
    else
        print_warning "⚠️  Cannot connect to cluster with context '$KUBE_CONTEXT'"
    fi
else
    print_status "Skipping cluster connectivity test (no context configured)"
fi

# Step 13: Display comprehensive success summary
echo ""
echo "================================================"
print_success "Kubernetes Exam Simulator Docker Container Started!"
echo "================================================"
echo ""
echo -e "🔗 Application: ${BOLD_GREEN}$TEST_URL${NC}"
echo -e "🔗 Health Check: ${GREEN}$TEST_URL/api/health${NC}"
echo -e "🔗 Questions API: ${GREEN}$TEST_URL/api/questions?exam_type=ckad&difficulty=beginner${NC}"
echo ""
echo -e "📝 Configuration:"
echo -e "   Port: ${GREEN}$APP_PORT${NC}"
echo -e "   Network: ${GREEN}$NETWORK_MODE${NC}"
if [ -n "$KUBE_CONTEXT" ]; then
    echo -e "   Kubernetes Context: ${GREEN}$KUBE_CONTEXT${NC}"
fi
echo ""
echo -e "📝 Question Banks Available:"
echo -e "   📚 Total Questions: ${GREEN}$TOTAL_QUESTIONS${NC} across all exam types"
echo -e "   🎯 Exam Types: ${GREEN}CKAD, CKA, CKS, KCNA${NC}"
echo -e "   📊 Difficulties: ${GREEN}Easy, Intermediate, Hard${NC}"
echo ""
echo -e "📝 Features Available:"
echo -e "   ${GREEN}✅${NC} Real question loading from JSON files"
echo -e "   ${GREEN}✅${NC} Question IDs displayed (ckad-e-001, etc.)"
echo -e "   ${GREEN}✅${NC} Helm chart generation with infrastructure requirements"
echo -e "   ${GREEN}✅${NC} Custom NOTES.txt with selected question IDs"
echo -e "   ${GREEN}✅${NC} kubectl and helm tools available in container"
echo -e "   ${GREEN}✅${NC} Kubernetes cluster integration (if configured)"
echo ""
echo -e "🎯 Complete Exam Workflow:"
echo -e "   ${BOLD_GREEN}1.${NC} Visit $TEST_URL"
echo -e "   ${BOLD_GREEN}2.${NC} Select exam type (CKAD/CKA/CKS/KCNA) and difficulty level"
echo -e "   ${BOLD_GREEN}3.${NC} Click 'Generate Helm Chart' (uses real questions)"
echo -e "   ${BOLD_GREEN}4.${NC} Download the generated chart with infrastructure requirements"
echo -e "   ${BOLD_GREEN}5.${NC} Apply to your cluster: ${GREEN}helm install k8s-exam ./downloaded-chart${NC}"
echo -e "   ${BOLD_GREEN}6.${NC} Return to application to start exam with real questions"
echo ""
echo -e "🐳 Docker Commands:"
echo -e "   View logs: ${GREEN}docker logs k8s-exam-simulator${NC}"
echo -e "   Execute shell: ${GREEN}docker exec -it k8s-exam-simulator /bin/bash${NC}"
if [ -n "$KUBE_CONTEXT" ]; then
    echo -e "   Test kubectl: ${GREEN}docker exec k8s-exam-simulator kubectl --context=$KUBE_CONTEXT get nodes${NC}"
fi
echo -e "   Stop container: ${GREEN}docker stop k8s-exam-simulator${NC}"
echo -e "   Remove container: ${GREEN}docker rm k8s-exam-simulator${NC}"
echo ""
echo -e "${BOLD_GREEN}✅ Ready for Kubernetes certification practice across all exam types!${NC}"
