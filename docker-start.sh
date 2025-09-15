#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="k8s-exam-simulator"
IMAGE_NAME="k8s-exam-simulator"
DEFAULT_PORT="8080"

echo -e "${BLUE}🚀 Kubernetes Exam Simulator - Docker Setup${NC}"
echo "================================================="

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        echo "Please install kubectl first: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    print_status "kubectl is available"
}

# Check if Docker is available and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        echo "Please install Docker first: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker is not running"
        echo "Please start Docker and try again"
        exit 1
    fi
    print_status "Docker is available and running"
}

# Get available Kubernetes contexts
get_contexts() {
    echo
    echo -e "${BLUE}🔍 Checking available Kubernetes contexts...${NC}"

    if ! kubectl config get-contexts &> /dev/null; then
        print_error "No Kubernetes contexts found"
        echo "Please set up your kubeconfig first with 'kubectl config'"
        exit 1
    fi

    # Get contexts in a clean format
    contexts=$(kubectl config get-contexts -o name)
    current_context=$(kubectl config current-context 2>/dev/null || echo "")

    if [ -z "$contexts" ]; then
        print_error "No Kubernetes contexts available"
        exit 1
    fi

    echo -e "${GREEN}Available Kubernetes contexts:${NC}"
    echo

    # Display contexts with numbers
    i=1
    declare -a context_array
    while IFS= read -r context; do
        context_array[$i]="$context"
        if [ "$context" = "$current_context" ]; then
            echo -e "  ${GREEN}$i) $context (current)${NC}"
        else
            echo -e "  $i) $context"
        fi
        ((i++))
    done <<< "$contexts"

    echo
    echo -e "${YELLOW}Which context would you like to use for the exam?${NC}"
    echo "Enter the number (1-$((i-1))) or press Enter to use current context:"
    read -r choice

    # Handle user choice
    if [ -z "$choice" ]; then
        if [ -z "$current_context" ]; then
            print_error "No current context set"
            exit 1
        fi
        selected_context="$current_context"
        print_status "Using current context: $selected_context"
    elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -lt "$i" ]; then
        selected_context="${context_array[$choice]}"
        print_status "Selected context: $selected_context"
    else
        print_error "Invalid choice"
        exit 1
    fi

    # Set the selected context as current
    if [ "$selected_context" != "$current_context" ]; then
        echo -e "${YELLOW}Switching to context: $selected_context${NC}"
        kubectl config use-context "$selected_context"
    fi

    # Test connection
    echo
    echo -e "${BLUE}🔗 Testing connection to Kubernetes cluster...${NC}"
    if kubectl cluster-info &> /dev/null; then
        print_status "Successfully connected to cluster"
        kubectl cluster-info | head -2
    else
        print_warning "Could not connect to cluster, but continuing anyway"
        echo "The application will start without cluster access"
    fi
}

# Create kubeconfig for container
create_container_kubeconfig() {
    echo
    echo -e "${BLUE}📁 Preparing kubeconfig for container...${NC}"

    # Create temporary directory for kubeconfig
    TEMP_KUBE_DIR=$(mktemp -d)
    CONTAINER_KUBECONFIG="$TEMP_KUBE_DIR/config"

    # Export current kubeconfig to temporary file
    kubectl config view --raw --minify > "$CONTAINER_KUBECONFIG"

    if [ ! -s "$CONTAINER_KUBECONFIG" ]; then
        print_error "Failed to create kubeconfig"
        exit 1
    fi

    # Get the current server URL
    current_server=$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')

    # Fix localhost/127.0.0.1 URLs for Docker container access
    if [[ "$current_server" == *"127.0.0.1"* ]] || [[ "$current_server" == *"localhost"* ]]; then
        print_warning "Detected localhost server URL: $current_server"

        # Detect the host platform and suggest fixes
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux - use host.docker.internal or docker0 interface IP
            if command -v ip &> /dev/null; then
                docker_host_ip=$(ip route show | grep docker0 | awk '{print $NF}' | head -1)
                if [ -z "$docker_host_ip" ]; then
                    docker_host_ip="172.17.0.1"  # Default docker0 gateway
                fi
            else
                docker_host_ip="172.17.0.1"
            fi

            new_server=$(echo "$current_server" | sed -E 's/(127\.0\.0\.1|localhost)/'"$docker_host_ip"'/g')
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS - use host.docker.internal
            new_server=$(echo "$current_server" | sed -E 's/(127\.0\.0\.1|localhost)/host.docker.internal/g')
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
            # Windows - use host.docker.internal
            new_server=$(echo "$current_server" | sed -E 's/(127\.0\.0\.1|localhost)/host.docker.internal/g')
        else
            # Unknown OS - try host.docker.internal
            new_server=$(echo "$current_server" | sed -E 's/(127\.0\.0\.1|localhost)/host.docker.internal/g')
        fi

        print_status "Converting server URL for container access"
        echo "Original: $current_server"
        echo "Modified: $new_server"
        print_warning "Adding insecure-skip-tls-verify=true for Docker networking"
        echo "This is safe for local development clusters like Rancher Desktop"

        # Update the kubeconfig with the new server URL and disable certificate verification
        # Use a more robust method to replace the server URL and add insecure-skip-tls-verify
        python3 -c "
import yaml, sys
with open('$CONTAINER_KUBECONFIG', 'r') as f:
    config = yaml.safe_load(f)
config['clusters'][0]['cluster']['server'] = '$new_server'
# Add insecure-skip-tls-verify for localhost/Docker scenarios
if 'host.docker.internal' in '$new_server' or '172.17.0.1' in '$new_server':
    config['clusters'][0]['cluster']['insecure-skip-tls-verify'] = True
    # Remove certificate-authority-data to avoid conflicts
    if 'certificate-authority-data' in config['clusters'][0]['cluster']:
        del config['clusters'][0]['cluster']['certificate-authority-data']
with open('$CONTAINER_KUBECONFIG', 'w') as f:
    yaml.dump(config, f, default_flow_style=False)
" 2>/dev/null || {
            # Fallback to sed if python/yaml is not available
            sed -i.bak "s|$current_server|$new_server|g" "$CONTAINER_KUBECONFIG"
            # Add insecure-skip-tls-verify for Docker networking
            if [[ "$new_server" == *"host.docker.internal"* ]] || [[ "$new_server" == *"172.17.0.1"* ]]; then
                sed -i.bak '/server:/a\    insecure-skip-tls-verify: true' "$CONTAINER_KUBECONFIG"
                # Remove certificate-authority-data line if present
                sed -i.bak '/certificate-authority-data:/d' "$CONTAINER_KUBECONFIG"
            fi
            rm -f "$CONTAINER_KUBECONFIG.bak"
        }

        final_server="$new_server"
    else
        final_server="$current_server"
        print_status "Server URL is accessible from container"
    fi

    print_status "Created kubeconfig for container"
    echo "Context: $(kubectl config current-context)"
    echo "Server: $final_server"
}

# Stop and remove existing container
cleanup_container() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo
        echo -e "${YELLOW}🧹 Cleaning up existing container...${NC}"
        docker stop "$CONTAINER_NAME" &> /dev/null || true
        docker rm "$CONTAINER_NAME" &> /dev/null || true
        print_status "Removed existing container"
    fi
}

# Build Docker image
build_image() {
    echo
    echo -e "${BLUE}🔨 Building Docker image...${NC}"

    # Ask user which build type they want
    echo "Choose build type:"
    echo -e "${GREEN}  1) Full build with React frontend (slower, ~2-5 minutes)${NC}"
    echo "  2) Backend-only build for testing (faster, ~30 seconds)"
    echo
    read -p "Enter choice (1 or 2, default: 1): " build_choice

    case $build_choice in
        1|"")
            echo "Building full application with React frontend..."
            docker build -t "$IMAGE_NAME:latest" .
            ;;
        2)
            echo "Building backend-only version for testing..."
            docker build -f Dockerfile.backend-only -t "$IMAGE_NAME:latest" .
            ;;
        *)
            print_error "Invalid choice, using backend-only build"
            docker build -f Dockerfile.backend-only -t "$IMAGE_NAME:latest" .
            ;;
    esac

    print_status "Docker image built successfully"
}

# Get port for application
get_port() {
    echo
    read -p "Enter port for application (default: $DEFAULT_PORT): " port
    port=${port:-$DEFAULT_PORT}

    # Check if port is in use
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        print_warning "Port $port appears to be in use"
        read -p "Continue anyway? (y/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            echo "Please choose a different port and run the script again"
            exit 1
        fi
    fi
}

# Run Docker container
run_container() {
    echo
    echo -e "${BLUE}🚀 Starting container...${NC}"

    # Determine Docker run arguments based on OS and detected networking needs
    docker_args=""

    # Check if we need host networking or special host access
    current_server=$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')
    use_host_networking=false

    if [[ "$current_server" == *"127.0.0.1"* ]] || [[ "$current_server" == *"localhost"* ]]; then
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # On Linux, offer choice between host networking and bridge with modified kubeconfig
            echo "Detected Linux with localhost cluster."
            echo "Choose networking mode:"
            echo -e "${GREEN}  1) Host networking (recommended for localhost clusters)${NC}"
            echo "  2) Bridge networking with modified kubeconfig"
            read -p "Enter choice (1 or 2, default: 1): " net_choice

            case ${net_choice:-1} in
                1)
                    echo "Using Docker host networking mode"
                    docker_args="--network host"
                    use_host_networking=true
                    host_port="$port"  # Use the user's chosen port
                    ;;
                2)
                    echo "Using bridge networking with kubeconfig modification"
                    docker_args="--add-host host.docker.internal:host-gateway"
                    host_port="$port"
                    ;;
            esac
        else
            # On macOS/Windows, Docker Desktop provides host.docker.internal
            docker_args="--add-host host.docker.internal:host-gateway"
            host_port="$port"
        fi
    else
        # External cluster, no special networking needed
        host_port="$port"
        docker_args=""
    fi

    if [ "$use_host_networking" = true ]; then
        # Host networking mode - container uses host's network directly
        docker run -d \
            --name "$CONTAINER_NAME" \
            --network host \
            -v "$CONTAINER_KUBECONFIG:/root/.kube/config:ro" \
            -e KUBECONFIG=/root/.kube/config \
            -e PORT="$host_port" \
            "$IMAGE_NAME:latest"
        echo "Container started with host networking on port $host_port"
    else
        # Bridge networking mode with port mapping
        docker run -d \
            --name "$CONTAINER_NAME" \
            -p "$host_port:8080" \
            $docker_args \
            -v "$CONTAINER_KUBECONFIG:/root/.kube/config:ro" \
            -e KUBECONFIG=/root/.kube/config \
            "$IMAGE_NAME:latest"
        echo "Container started with port mapping $host_port:8080"
    fi

    print_status "Container started successfully"

    # Wait a moment for startup
    echo "Waiting for application to start..."
    sleep 5

    # Test health endpoint
    if curl -sf "http://localhost:$host_port/api/health" > /dev/null; then
        print_status "Application is healthy and ready"
    else
        print_warning "Application may still be starting up"
    fi

    echo
    echo -e "808🎉 Kubernetes Exam Simulator is now running!${NC}"
    echo "================================================="
    echo -e "📱 Application URL: ${BLUE}http://localhost:$host_port${NC}"
    echo -e "🏥 Health Check:   ${BLUE}http://localhost:$host_port/api/health${NC}"
    echo -e "🔧 Kubernetes Context: ${YELLOW}$(kubectl config current-context)${NC}"
    echo -e "📋 Container Name: ${YELLOW}$CONTAINER_NAME${NC}"
    echo
    echo "Commands to manage the container:"
    echo "  View logs:     docker logs $CONTAINER_NAME"
    echo "  Stop:          docker stop $CONTAINER_NAME"
    echo "  Remove:        docker rm $CONTAINER_NAME"
    echo "  Shell access:  docker exec -it $CONTAINER_NAME /bin/bash"
    echo

    # Offer to open browser
    read -p "Open application in browser? (Y/n): " open_browser
    if [[ ! "$open_browser" =~ ^[Nn]$ ]]; then
        if command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:$host_port" &> /dev/null || true
        elif command -v open &> /dev/null; then
            open "http://localhost:$host_port" &> /dev/null || true
        else
            echo "Please open http://localhost:$host_port in your browser"
        fi
    fi
}

# Cleanup function
cleanup() {
    if [ -n "$TEMP_KUBE_DIR" ] && [ -d "$TEMP_KUBE_DIR" ]; then
        rm -rf "$TEMP_KUBE_DIR"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    # Check prerequisites
    check_kubectl
    check_docker

    # Get Kubernetes context
    get_contexts

    # Create kubeconfig for container
    create_container_kubeconfig

    # Clean up existing container
    cleanup_container

    # Build image
    build_image

    # Get port
    get_port

    # Run container
    run_container
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Kubernetes Exam Simulator Docker Setup Script"
        echo
        echo "This script will:"
        echo "  1. Check for kubectl and Docker"
        echo "  2. List available Kubernetes contexts"
        echo "  3. Let you choose which context to use"
        echo "  4. Build the Docker image"
        echo "  5. Run the container with proper kubeconfig"
        echo
        echo "Options:"
        echo "  -h, --help    Show this help message"
        echo
        exit 0
        ;;
    *)
        main
        ;;
esac