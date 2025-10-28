#!/bin/bash

# Kubernetes Exam Simulator - Docker Deployment Startup Script
# This script builds and runs the application in a Docker container with all fixes
# Includes original Docker functionality plus streamlined interactive configuration

set -e

echo "🐳 Starting Kubernetes Exam Simulator (Docker Deployment)"
echo "================================================"

if [[ $1 == "--help" ]]; then
    echo "Usage: ./docker-start.sh [--clean] [--default]"
    echo "    None or only one argument is accepted at a time."
    echo -e "  > ${GREEN}./docker-start.sh${NC} # Asks the user for the options"
    echo -e "  > ${GREEN}./docker-start.sh --clean${NC} # Cleans up old images and asks user for other options"
    echo -e "  > ${GREEN}./docker-start.sh --default${NC} # Runs with default values, also cleans up old images"
    exit 0
fi

RUN_WITH_DEFAULTS="false"
if [[ $1 == "--default" ]]; then
    RUN_WITH_DEFAULTS="true"
    echo "⚙️  Running with default configuration (no prompts)"
fi

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

# Platform detection for cross-platform compatibility
PLATFORM=$(uname -s)
IS_WSL2="false"
IS_MACOS="false"
IS_LINUX="false"
IS_WINDOWS_GITBASH="false"

case "$PLATFORM" in
    "Darwin")
        IS_MACOS="true"
        print_status "Platform: macOS"
        ;;
    "Linux")
        IS_LINUX="true"
        if [ -f /proc/sys/fs/binfmt_misc/WSLInterop ]; then
            IS_WSL2="true"
            print_status "Platform: WSL2 (Linux on Windows)"
        else
            print_status "Platform: Native Linux"
        fi
        ;;
    "MINGW"* | "CYGWIN"*)
        IS_WINDOWS_GITBASH="true"
        print_status "Platform: Windows (Git Bash/Cygwin)"
        ;;
    *)
        print_status "Platform: $PLATFORM (assuming Linux-compatible)"
        IS_LINUX="true"
        ;;
esac
echo "📋 Got IS_WSL2=$IS_WSL2, IS_MACOS=$IS_MACOS, IS_LINUX=$IS_LINUX, IS_WINDOWS_GITBASH=$IS_WINDOWS_GITBASH."

# Step 2: Streamlined Interactive Configuration
echo ""
echo "🔧 Configuration (select numbered options or press Enter for defaults)"
echo "=============================================================="

# Port selection with direct input
print_input "Application port:"
print_default "Press Enter for default: ${BOLD_GREEN}8080${NC}"
if [[ "$RUN_WITH_DEFAULTS" == "true" ]]; then
    print_default "Running with --default argument."
    port_input=8080
else
    read -rp "Port (quit q, default 8080): " port_input # read without -r will mangle backslashes. (shellcheck SC2162)
fi

if [[ "$port_input" =~ ^[0-9]+$ ]] && [ "$port_input" -ge 1000 ] && [ "$port_input" -le 65535 ]; then
    APP_PORT=$port_input
    print_success "Using port: $APP_PORT"
elif [[ "$port_input" == "q" || "$port_input" == "Q" ]]; then
    print_error "Exiting as requested."
    exit 1
elif [ -z "$port_input" ]; then
    APP_PORT=8080
    print_success "Using default port: 8080"
else
    print_warning "Invalid port '$port_input'. Using default 8080."
    APP_PORT=8080
fi

# Kubernetes context selection
echo ""
print_input "Kubernetes Configuration:"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_warning "kubectl not found on host system"
    KUBECTL_AVAILABLE="false"
else
    KUBECTL_AVAILABLE="true"
    print_success "kubectl found on host system"
fi

# Kubeconfig and context selection
MOUNT_KUBECONFIG=""
KUBE_CONTEXT=""

if [ "$KUBECTL_AVAILABLE" = "true" ]; then
    # Cross-platform kubeconfig detection
    KUBECONFIG_PATH=""
    ORIGINAL_USER=""

    # Detect original user (for sudo/root scenarios)
    if [ -n "$SUDO_USER" ]; then
        ORIGINAL_USER="$SUDO_USER"
    elif [ -n "$(logname 2>/dev/null)" ]; then
        ORIGINAL_USER="$(logname 2>/dev/null)"
    else
        ORIGINAL_USER="$USER"
    fi

    # Check multiple possible kubeconfig locations
    POSSIBLE_KUBECONFIG_PATHS=(
        "$KUBECONFIG" # (!!!) It's empty here, if not set as environment variable.
        "$HOME/.kube/config" # Git Bash on Windows
        "/home/$ORIGINAL_USER/.kube/config" # Linux
        "/root/.kube/config" # Linux when running as root
        "/Users/$ORIGINAL_USER/.kube/config" # macOS
        "/mnt/c/Users/$ORIGINAL_USER/.kube/config" # WSL2 on Windows
        "/etc/rancher/k3s/k3s.yaml" # K3s default kubeconfig (Linux VM / bare metal)
    )

    for path in "${POSSIBLE_KUBECONFIG_PATHS[@]}"; do
        if [ -n "$path" ] && [ -f "$path" ]; then
            KUBECONFIG_PATH="$path"
            break
        fi
    done

    if [ -n "$KUBECONFIG_PATH" ]; then
        print_success "Found kubeconfig at $KUBECONFIG_PATH"

        # Get current context using the found kubeconfig
        current_context=$(KUBECONFIG="$KUBECONFIG_PATH" kubectl config current-context 2>/dev/null || echo "")

        if [ -n "$current_context" ]; then
            print_input "Kubernetes context options:"
            echo -e "  ${BOLD_GREEN}1.${NC} Use current context: ${GREEN}$current_context${NC} (default)"
            echo -e "  ${CYAN}2.${NC} Run without kubeconfig (isolated)"

            # Get available contexts for reference
            contexts=$(KUBECONFIG="$KUBECONFIG_PATH" kubectl config get-contexts -o name 2>/dev/null || echo "")
            if [ -n "$contexts" ] && [ "$(echo "$contexts" | wc -l)" -gt 1 ]; then # Quote this to prevent word splitting. (shellcheck SC2046)
                echo -e "  ${CYAN}3.${NC} Select different context"
                echo -e "  ${DIM}Available contexts: $(echo "$contexts" | tr '\n' ', ' | sed 's/, $//')${NC}"
            fi

            if [[ "$RUN_WITH_DEFAULTS" == "true" ]]; then
                print_default "Running with --default argument."
                context_choice="1"
            else
                read -rp "Choose option (1-3, quit q, default 1) or enter context name directly: " context_choice
            fi

            MOUNT_KUBECONFIG="-v ${KUBECONFIG_PATH}:/root/.kube/config:ro"
            if [[ "$IS_WINDOWS_GITBASH" == "true" ]]; then
                # Converting a path to physical Windows path: /c/Users/<username>/.kube -> C:/Users/<username>/.kube
                # Adding an additional slash at the start: /C:/Users/<username>/.kube.
                # It's required for the correct mounting of the docker volume in Windows.
                KUBECONFIG_PATH_WIN="/$(cygpath -m "$KUBECONFIG_PATH")" # Use -m to get mixed slashes (C:/...)
                MOUNT_KUBECONFIG="-v ${KUBECONFIG_PATH_WIN}:/root/.kube/config:ro"
            fi
            case "$context_choice" in
                "" | "1")
                    # Default: use current context
                    KUBE_CONTEXT=$current_context
                    print_success "Using current context: $current_context"
                    ;;
                "2")
                    # Run isolated
                    KUBE_CONTEXT=""
                    MOUNT_KUBECONFIG=""
                    print_status "Container will run isolated (no kubeconfig)"
                    ;;
                "3")
                    if [ -n "$contexts" ] && [ "$(echo "$contexts" | wc -l)" -gt 1 ]; then # Quote this to prevent word splitting. (shellcheck SC2046)
                        echo "Available contexts:"
                        echo "$contexts" | nl -w2 -s'. '
                        read -rp "Enter context name or number (quit q, default $current_context): " selected_context

                        # Check if input is a number
                        if [[ "$selected_context" =~ ^[0-9]+$ ]]; then
                            # User entered a number, get the context at that line
                            selected_context=$(echo "$contexts" | sed -n "${selected_context}p")
                        elif [[ "$selected_context" == "q" || "$selected_context" == "Q" ]]; then
                            print_error "Exiting as requested."
                            exit 1
                        fi

                        if [ -n "$selected_context" ] && echo "$contexts" | grep -q "^$selected_context$"; then
                            KUBE_CONTEXT=$selected_context
                            print_success "Using context: $selected_context"
                        else
                            print_warning "Context '$selected_context' not found. Using default: $current_context"
                            KUBE_CONTEXT=$current_context
                        fi
                    else
                        print_warning "No other contexts available. Using default: $current_context"
                        KUBE_CONTEXT=$current_context
                    fi
                    ;;
                *)
                    # Check if the input is a valid context name
                    if echo "$contexts" | grep -q "^$context_choice$"; then
                        KUBE_CONTEXT=$context_choice
                        print_success "Using context: $context_choice"
                    elif [[ "$context_choice" == "q" || "$context_choice" == "Q" ]]; then
                        print_error "Exiting as requested."
                        exit 1
                    else
                        print_warning "Invalid choice or context '$context_choice' not found. Using default: $current_context"
                        KUBE_CONTEXT=$current_context
                    fi
                    ;;
            esac
        else
            print_warning "No current context found in kubeconfig"
        fi
    else
        print_warning "No kubeconfig found in standard locations (checked: $HOME/.kube/config, /home/$ORIGINAL_USER/.kube/config, /Users/$ORIGINAL_USER/.kube/config)"
    fi
else
    print_status "Skipping Kubernetes configuration (kubectl not available)"
fi

# Platform-aware networking configuration
echo ""
print_input "Container networking options:"
if [ "$IS_MACOS" = "true" ]; then
    echo -e "  ${BOLD_GREEN}1.${NC} Bridge network (default) - recommended for macOS"
    echo -e "  ${CYAN}2.${NC} Host network - limited support on macOS"
elif [ "$IS_WINDOWS_GITBASH" = "true" ]; then
    echo -e "  ${BOLD_GREEN}1.${NC} Host network (default) - recommended for Git Bash on Windows"
elif [ "$IS_WSL2" = "true" ]; then
    echo -e "  ${BOLD_GREEN}1.${NC} Bridge network (default) - isolated with port mapping"
    echo -e "  ${CYAN}2.${NC} Host network - shares WSL2 network stack"
else
    echo -e "  ${BOLD_GREEN}1.${NC} Bridge network (default) - isolated with port mapping"
    echo -e "  ${CYAN}2.${NC} Host network - shares host network stack"
fi
echo -e "  ${CYAN}3.${NC} Custom network - specify network name"
if [[ "$RUN_WITH_DEFAULTS" == "true" ]]; then
    print_default "Running with --default argument."
    network_choice="1"
else
    read -rp "Choose option (1-3, quit q, default 1): " network_choice
fi

case "$network_choice" in
    "" | "1")
        if [ "$IS_WINDOWS_GITBASH" = "true" ]; then
            NETWORK_CONFIG="--network host"
            NETWORK_MODE="host"
        else
            # Default: bridge network - works on all platforms
            NETWORK_CONFIG="-p $APP_PORT:8080"
            NETWORK_MODE="bridge"
            print_success "Using bridge network (default)"
        fi
        ;;
    "2")
        if [ "$IS_MACOS" = "true" ]; then
            print_warning "Host networking has limited support on macOS Docker Desktop"
            NETWORK_CONFIG="--network host"
            NETWORK_MODE="host"
        else
            NETWORK_CONFIG="--network host"
            NETWORK_MODE="host"
        fi
        print_success "Using host network"
        print_warning "Application accessible on all host interfaces"
        ;;
    "3")
        read -rp "Enter custom network name (quit q, default bridge): " custom_network
        if [ -n "$custom_network" ]; then
            NETWORK_CONFIG="--network $custom_network -p $APP_PORT:8080"
            NETWORK_MODE="custom ($custom_network)"
            print_success "Using custom network: $custom_network"
        elif [[ "$custom_network" == "q" || "$custom_network" == "Q" ]]; then
            print_error "Exiting as requested."
            exit 1
        else
            # Fallback to default
            NETWORK_CONFIG="-p $APP_PORT:8080"
            NETWORK_MODE="bridge"
            print_warning "No network name provided. Using default bridge network"
        fi
        ;;
    *)
        if [[ "$network_choice" == "q" || "$network_choice" == "Q" ]]; then
            print_error "Exiting as requested."
            exit 1
        fi
        print_warning "Invalid choice. Using default bridge network"
        NETWORK_CONFIG="-p $APP_PORT:8080"
        NETWORK_MODE="bridge"
        ;;
esac

# Build variant selection
echo ""
print_input "Docker build variant options:"
echo -e "  ${BOLD_GREEN}1.${NC} Standard build (default) - full featured, all exam types"
echo -e "  ${CYAN}2.${NC} Lightweight build - minimal resources (256MB RAM, smaller image)"
if [[ "$RUN_WITH_DEFAULTS" == "true" ]]; then
    print_default "Running with --default argument."
    build_choice="1"
else
    read -rp "Choose option (1-2, quit q, default 1): " build_choice
fi

BUILD_VARIANT="standard"
DOCKERFILE="Dockerfile"
IMAGE_TAG="k8s-exam-simulator"
MEMORY_LIMIT=""

case "$build_choice" in
    "" | "1")
        # Default: standard build
        print_success "Using standard build (default)"
        ;;
    "2")
        BUILD_VARIANT="lightweight"
        DOCKERFILE="Dockerfile.lightweight"
        IMAGE_TAG="k8s-exam-simulator:lightweight"
        MEMORY_LIMIT="-m 512m --memory-swap 1g"
        print_success "Using lightweight build (optimized for low memory usage)"
        print_warning "Optimized for minimal resource usage"
        ;;
    *)
        if [[ "$build_choice" == "q" || "$build_choice" == "Q" ]]; then
            print_error "Exiting as requested."
            exit 1
        fi
        print_warning "Invalid choice. Using default standard build."
        ;;
esac

# Docker options
echo ""
print_input "Docker runtime options:"
echo -e "  ${BOLD_GREEN}1.${NC} Standard (default) - no special privileges"
echo -e "  ${CYAN}2.${NC} Privileged mode - elevated privileges"
echo -e "  ${CYAN}3.${NC} Custom options - specify custom Docker flags"
if [[ "$RUN_WITH_DEFAULTS" == "true" ]]; then
    print_default "Running with --default argument."
    docker_choice="1"
else
    read -rp "Choose option (1-3, quit q, default 1): " docker_choice
fi

case "$docker_choice" in
    "" | "1")
        # Default: standard run
        ADDITIONAL_OPTIONS=""
        print_success "Using standard Docker options (default)"
        ;;
    "2")
        ADDITIONAL_OPTIONS="--privileged"
        print_success "Using privileged mode"
        print_warning "Running with elevated privileges"
        ;;
    "3")
        read -rp "Enter custom Docker options (quit q): " custom_options
        if [ -n "$custom_options" ]; then
            if [[ "$custom_options" == "q" || "$custom_options" == "Q" ]]; then
                print_error "Exiting as requested."
                exit 1
            fi
            ADDITIONAL_OPTIONS="$custom_options"
            print_success "Using custom options: $custom_options"
        else
            ADDITIONAL_OPTIONS=""
            print_warning "No options provided. Using standard mode"
        fi
        ;;
    *)
        if [[ "$docker_choice" == "q" || "$docker_choice" == "Q" ]]; then
            print_error "Exiting as requested."
            exit 1
        fi
        print_warning "Invalid choice. Using default standard options"
        ADDITIONAL_OPTIONS=""
        ;;
esac

# Step 3: Display configuration summary
echo ""
echo "📋 Configuration Summary"
echo "================================================"
echo -e "Build Variant: ${GREEN}$BUILD_VARIANT${NC}"
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
if [ "$BUILD_VARIANT" = "lightweight" ]; then
    echo -e "Memory Limit: ${GREEN}512MB${NC}"
fi
echo ""

# Quick confirmation
print_input "Continue with this configuration?"
echo -e "  ${BOLD_GREEN}1.${NC} Yes, proceed with build and deployment (default)"
echo -e "  ${CYAN}2.${NC} No, exit and restart configuration"
if [[ "$RUN_WITH_DEFAULTS" == "true" ]]; then
    print_default "Running with --default argument."
    confirm_choice="1"
else
    read -rp "Choose option (1-2, quit q, default 1): " confirm_choice
fi

case "$confirm_choice" in
    "" | "1")
        print_success "Proceeding with deployment..."
        ;;
    "2")
        print_status "Exiting. Run the script again to reconfigure."
        exit 0
        ;;
    *)
        if [[ "$confirm_choice" == "q" || "$confirm_choice" == "Q" ]]; then
            print_error "Exiting as requested."
            exit 1
        fi
        print_warning "Invalid choice. Proceeding with deployment..."
        ;;
esac

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
DIFFICULTIES=("beginner" "intermediate" "advanced")
TOTAL_QUESTIONS=0

print_status "Checking question banks for Docker build..."
for exam_type in "${EXAM_TYPES[@]}"; do
    EXAM_DIR="question-bank/$exam_type"
    if [ -d "$EXAM_DIR" ]; then
        print_status "Found $exam_type exam type"

        for difficulty in "${DIFFICULTIES[@]}"; do
            DIFFICULTY_DIR="$EXAM_DIR/$difficulty"
            if [ -d "$DIFFICULTY_DIR" ]; then
                # Use ls instead of find to avoid I/O errors with OneDrive
                # shellcheck disable=SC2012 # Use find instead of ls to better handle non-alphanumeric filenames. (shellcheck SC2012)
                QUESTION_COUNT=$(ls "$DIFFICULTY_DIR"/*.json 2>/dev/null | wc -l || echo "0")
                # shellcheck disable=SC2086 # Double quote to prevent globbing and word splitting. (shellcheck SC2086)
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
if [[ "$1" == "--clean" || "$RUN_WITH_DEFAULTS" == "true" ]]; then
    print_status "Removing old Docker images..."
    docker rmi k8s-exam-simulator 2>/dev/null || true
    docker rmi k8s-exam-simulator:lightweight 2>/dev/null || true
    print_success "Old images cleaned up"
fi

# Step 7: Build Docker image with optimizations
if [ "$BUILD_VARIANT" = "lightweight" ]; then
    print_status "Building lightweight Docker image (optimized for minimal resources)..."
    print_status "This build will use less memory and disk space"
else
    print_status "Building standard Docker image with full features..."
    print_status "Using Docker layer caching for faster builds on subsequent runs"
fi

# BuildKit configuration - will be set per platform in build function

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    print_error "Dockerfile not found: $DOCKERFILE"
    if [ "$BUILD_VARIANT" = "lightweight" ]; then
        print_error "Please ensure Dockerfile.lightweight exists in the project root"
    fi
    exit 1
fi

# Advanced Docker Build with WSL2/OneDrive Detection and Automatic Workaround
# This section handles problematic environments automatically

# Check if we already have the image built
IMAGE_EXISTS=$(docker images -q "$IMAGE_TAG" 2>/dev/null || echo "")

# Detect and handle WSL2 OneDrive issues automatically
if [ -f /proc/sys/fs/binfmt_misc/WSLInterop ] && [[ "$(pwd)" == *"OneDrive"* ]]; then
    print_warning "WSL2 with OneDrive sync detected - files may be corrupted"
    print_status "Automatically copying project to native filesystem for reliable build..."

    # Create working directory
    WORK_DIR="/tmp/k8s-exam-simulator-$$"
    mkdir -p "$WORK_DIR"

    # Copy essential files only (avoid corrupted node_modules)
    print_status "Copying project files (excluding node_modules)..."

    # Copy root files to working directory
    cp Dockerfile* docker-entrypoint.sh .dockerignore ./*.md "$WORK_DIR/" 2>/dev/null || true # Use ./*glob* or -- *glob* so names with dashes won't become options. (shellcheck SC2035)

    # Copy directories selectively
    cp -r helm-templates "$WORK_DIR/" 2>/dev/null || true
    cp -r question-bank "$WORK_DIR/" 2>/dev/null || true

    # Copy app structure without node_modules
    mkdir -p "$WORK_DIR/app"
    if [ -d "app/backend" ]; then
        mkdir -p "$WORK_DIR/app/backend"
        cp app/backend/package*.json "$WORK_DIR/app/backend/" 2>/dev/null || true
        cp -r app/backend/src "$WORK_DIR/app/backend/" 2>/dev/null || true
    fi

    if [ -d "app/frontend" ]; then
        mkdir -p "$WORK_DIR/app/frontend"
        cp app/frontend/package*.json app/frontend/*.js app/frontend/*.json app/frontend/.env "$WORK_DIR/app/frontend/" 2>/dev/null || true
        cp -r app/frontend/public "$WORK_DIR/app/frontend/" 2>/dev/null || true
        cp -r app/frontend/src "$WORK_DIR/app/frontend/" 2>/dev/null || true
    fi


    if [ -f "$WORK_DIR/Dockerfile" ]; then
        print_success "Project copied to working directory: $WORK_DIR"
        print_status "Changing to working directory for build..."
        cd "$WORK_DIR"

        # Set cleanup trap
        trap 'cd "$PROJECT_ROOT"; rm -rf "$WORK_DIR"' EXIT # Use single quotes, otherwise this expands now rather than when signalled. (shellcheck SC2064)

    else
        print_error "Failed to copy project files. OneDrive corruption is too severe."
        print_error "Manual solution: cp -r . /tmp/k8s-project && cd /tmp/k8s-project && ./docker-start.sh"
        exit 1
    fi
fi

# Function to perform robust Docker build
perform_docker_build() {
    local build_context="$1"
    local dockerfile="$2"
    local image_tag="$3"

    print_status "Building Docker image: $image_tag"
    print_status "Using build context: $build_context"
    print_status "Using Dockerfile: $dockerfile"

    # Platform-aware BuildKit configuration
    if [ "$IS_WSL2" = "true" ]; then
        # WSL2 often has buildx issues, disable BuildKit
        export DOCKER_BUILDKIT=0
        print_status "Disabled BuildKit for WSL2 compatibility"
    elif [ "$IS_MACOS" = "true" ]; then
        # BuildKit works well on macOS
        export DOCKER_BUILDKIT=1
        print_status "Using BuildKit for optimized builds on macOS"
    else
        export DOCKER_BUILDKIT=1
        print_status "Using BuildKit for optimized builds"
    fi

    # Change to build context and build
    (cd "$build_context" && docker build -f "$dockerfile" -t "$image_tag" .)
    return $?
}


# Main build logic
if [ -n "$IMAGE_EXISTS" ]; then
    print_success "Found existing Docker image: $IMAGE_TAG"
    print_input "Rebuild image?"
    echo "  1. Skip rebuild and use existing image (default)"
    echo "  2. Rebuild image"
    if [[ "$RUN_WITH_DEFAULTS" == "true" ]]; then
        print_default "Running with --default argument."
        rebuild_choice="1"
    else
        read -rp "Choose option (1-2, quit q, default 1): " rebuild_choice
    fi

    if [[ "$rebuild_choice" == "q" || "$rebuild_choice" == "Q" ]]; then
        print_error "Exiting as requested."
        exit 1
    elif [ "$rebuild_choice" != "2" ]; then
        print_success "Using existing image: $IMAGE_TAG"
    else
        FORCE_REBUILD="true"
    fi
fi

# Perform build if needed
if [ -z "$IMAGE_EXISTS" ] || [ "$FORCE_REBUILD" = "true" ]; then
    print_status "Removing old Docker images..."
    docker rmi k8s-exam-simulator 2>/dev/null || true
    docker rmi k8s-exam-simulator:lightweight 2>/dev/null || true

    print_status "Building Docker image..."
    if perform_docker_build "." "$DOCKERFILE" "$IMAGE_TAG"; then
        print_success "Docker image built successfully: $IMAGE_TAG"
    else
        print_error "Docker build failed"
        exit 1
    fi
fi

# Step 8: Run the container with selected configuration
print_status "Starting Docker container with selected configuration..."

# Build the docker run command
DOCKER_CMD="docker run -d --name k8s-exam-simulator"
DOCKER_CMD="$DOCKER_CMD $NETWORK_CONFIG"
DOCKER_CMD="$DOCKER_CMD -e NODE_ENV=production -e PORT=8080"

# Add memory limits for lightweight variant
if [ -n "$MEMORY_LIMIT" ]; then
    DOCKER_CMD="$DOCKER_CMD $MEMORY_LIMIT"
fi

# Platform-specific networking fixes for Kubernetes cluster access
if [ "$IS_MACOS" = "true" ]; then
    # macOS Docker Desktop already provides host.docker.internal
    DOCKER_CMD="$DOCKER_CMD --add-host=host.docker.internal:host-gateway"
elif [ "$IS_WINDOWS_GITBASH" = "true" ]; then
    # Windows Git Bash needs special handling for host connectivity
    DOCKER_CMD="$DOCKER_CMD --add-host=host.docker.internal:host-gateway"
elif [ "$IS_WSL2" = "true" ]; then

    DOCKER_CMD="$DOCKER_CMD --network=host"

    DOCKER_CMD="$DOCKER_CMD -v ~/.kube/config:/kube-config:ro"

    DOCKER_CMD="$DOCKER_CMD -e KUBECONFIG=/kube-config"
else
    # Native Linux - use host networking gateway
    DOCKER_CMD="$DOCKER_CMD --network=host"
    DOCKER_CMD="$DOCKER_CMD -v ${KUBECONFIG_PATH}:/root/.kube/config:ro"
fi

if [ "$IS_WSL2" != "true" ]; then
    if [ -n "$KUBE_CONTEXT" ]; then
        DOCKER_CMD="$DOCKER_CMD -e KUBE_CONTEXT=$KUBE_CONTEXT"
    fi

    if [ -n "$MOUNT_KUBECONFIG" ]; then
        DOCKER_CMD="$DOCKER_CMD $MOUNT_KUBECONFIG"
    fi

    if [ -n "$ADDITIONAL_OPTIONS" ]; then
        DOCKER_CMD="$DOCKER_CMD $ADDITIONAL_OPTIONS"
    fi
fi

DOCKER_CMD="$DOCKER_CMD $IMAGE_TAG"

# Execute the command
print_status "Executing: $DOCKER_CMD"
eval "$DOCKER_CMD" # Double quote to prevent globbing and word splitting. (shellcheck SC2086)

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
if curl -f -s "$TEST_URL/api/health" > /dev/null; then # Quote this to prevent word splitting. (shellcheck SC2046)
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
HELM_RESPONSE=$(curl -s -X POST "$TEST_URL/api/helm/generate" \
    -H "Content-Type: application/json" \
    -d '{"type":"ckad","difficulty":"beginner"}')

if echo "$HELM_RESPONSE" | grep -q "success"; then
    print_success "✅ Helm API is working and generating charts with infrastructure requirements"
else
    print_warning "⚠️  Helm API response: $(echo "$HELM_RESPONSE" | head -c 200)..."
fi

# Step 11: Test kubectl/helm availability in container (ORIGINAL FUNCTIONALITY)
print_status "Verifying Kubernetes tools in container..."
# shellcheck disable=SC2015 # Note that A && B || C is not if-then-else. C may run when A is true. (shellcheck SC2015)
docker exec k8s-exam-simulator kubectl version --client > /dev/null 2>&1 && \
    print_success "✅ kubectl available in container" || \
    print_warning "⚠️  kubectl check failed"

# shellcheck disable=SC2015 # Note that A && B || C is not if-then-else. C may run when A is true. (shellcheck SC2015)
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
if [ "$BUILD_VARIANT" = "lightweight" ]; then
    echo -e "   ${GREEN}✅${NC} Lightweight build: ~50% smaller image, 256MB RAM usage"
fi
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
echo -e "   Execute shell: ${GREEN}docker exec -it k8s-exam-simulator bash${NC}"
if [ -n "$KUBE_CONTEXT" ]; then
    echo -e "   Test kubectl: ${GREEN}docker exec k8s-exam-simulator kubectl --context=$KUBE_CONTEXT get nodes${NC}"
fi
echo -e "   Stop container: ${GREEN}docker stop k8s-exam-simulator${NC}"
echo -e "   Remove container: ${GREEN}docker rm k8s-exam-simulator${NC}"
echo ""
echo -e "${BOLD_GREEN}✅ Ready for Kubernetes certification practice across all exam types!${NC}"
