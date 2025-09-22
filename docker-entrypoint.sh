#!/bin/bash
set -e

# Mac compatibility fixes for Go runtime issues
export GODEBUG=madvdontneed=1
export GOGC=100
export GOMEMLIMIT=256MiB

echo "🚀 Starting Kubernetes Exam Simulator..."

# Check if kubectl is available with timeout protection
if command -v kubectl &> /dev/null; then
    echo "✅ kubectl is available"
    # Use timeout to prevent hanging and add runtime safeguards
    timeout 10s kubectl version --client &>/dev/null && echo "✅ kubectl client working" || echo "⚠️  kubectl client version check failed"
else
    echo "❌ kubectl not found"
fi

# Check if helm is available with timeout protection
if command -v helm &> /dev/null; then
    echo "✅ helm is available"
    # Use timeout to prevent hanging
    timeout 10s helm version &>/dev/null && echo "✅ helm working" || echo "⚠️  helm version check failed"
else
    echo "❌ helm not found"
fi

# Handle kubeconfig and context setup
if [ -f "/root/.kube/config" ]; then
    echo "🔍 Processing kubeconfig..."

    # Create a working copy of the kubeconfig to avoid modifying the read-only mount
    WORKING_CONFIG="/tmp/kube-config"
    cp /root/.kube/config "$WORKING_CONFIG"
    export KUBECONFIG="$WORKING_CONFIG"

    # If KUBE_CONTEXT is set, configure it as the only available context
    if [ -n "$KUBE_CONTEXT" ]; then
        echo "🎯 Setting up single context: $KUBE_CONTEXT"

        # Create a clean kubeconfig with only the selected context
        TEMP_CONFIG="/tmp/kubeconfig-filtered"

        # Extract only the selected context and its associated cluster and user
        kubectl config view --kubeconfig="$WORKING_CONFIG" --context="$KUBE_CONTEXT" --flatten --minify > "$TEMP_CONFIG"

        # Replace the working config with the filtered one
        cp "$TEMP_CONFIG" "$WORKING_CONFIG"
        rm "$TEMP_CONFIG"

        # Set the current context
        kubectl config use-context "$KUBE_CONTEXT"

        echo "✅ Configured kubeconfig with only context: $KUBE_CONTEXT"
    fi

    # Fix localhost addresses for Docker networking
    echo "🔧 Fixing cluster server addresses for Docker networking..."

    # Get the current server URL
    CURRENT_SERVER=$(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null || echo "")

    if [[ "$CURRENT_SERVER" =~ ^https://127\.0\.0\.1: ]] || [[ "$CURRENT_SERVER" =~ ^https://localhost: ]]; then
        echo "   Detected localhost cluster endpoint: $CURRENT_SERVER"

        # Replace 127.0.0.1 and localhost with host.docker.internal
        # This allows the container to reach the host machine's Kubernetes cluster
        sed -i 's|https://127\.0\.0\.1:|https://host.docker.internal:|g' "$WORKING_CONFIG"
        sed -i 's|https://localhost:|https://host.docker.internal:|g' "$WORKING_CONFIG"

        NEW_SERVER=$(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null || echo "")
        echo "   Updated cluster endpoint: $NEW_SERVER"
        echo "✅ Updated cluster endpoints for container networking"
    elif [[ -n "$CURRENT_SERVER" ]]; then
        echo "   Using external cluster endpoint: $CURRENT_SERVER"
        echo "✅ No endpoint modification needed for external cluster"
    else
        echo "⚠️  Could not determine cluster endpoint"
    fi
fi

# Try to connect to Kubernetes cluster with proper context and timeout protection
echo "🔍 Checking Kubernetes cluster connectivity..."
if [ -n "$KUBE_CONTEXT" ]; then
    echo "   Using context: $KUBE_CONTEXT"
    # Use timeout to prevent kubectl from hanging
    if timeout 15s kubectl cluster-info &> /dev/null; then
        echo "✅ Connected to Kubernetes cluster"
        # Protected node count check
        NODE_COUNT=$(timeout 10s kubectl get nodes --no-headers 2>/dev/null | wc -l || echo "0")
        echo "📊 Found $NODE_COUNT nodes in cluster"
        # Protected context listing
        CONTEXTS=$(timeout 10s kubectl config get-contexts -o name 2>/dev/null | tr '\n' ', ' | sed 's/,$//' || echo "unknown")
        echo "📋 Available contexts: $CONTEXTS"
    else
        echo "⚠️  Cannot connect to Kubernetes cluster with context '$KUBE_CONTEXT'"
        echo "   This might be due to:"
        echo "   - Cluster not running on host machine"
        echo "   - Network connectivity issues"
        echo "   - Invalid certificates or authentication"
        echo "   - Go runtime compatibility issues on Mac (working on fix)"
        echo "   The application will still start and generate Helm charts"
    fi
else
    echo "ℹ️  No specific context configured - using default kubeconfig behavior"
    if timeout 15s kubectl cluster-info &> /dev/null; then
        echo "✅ Connected to Kubernetes cluster"
        NODE_COUNT=$(timeout 10s kubectl get nodes --no-headers 2>/dev/null | wc -l || echo "0")
        echo "📊 Found $NODE_COUNT nodes in cluster"
    else
        echo "⚠️  No Kubernetes cluster connection detected"
        echo "   This is normal if you haven't set up kubectl access yet"
        echo "   The application will still start and generate Helm charts"
    fi
fi

# Set up permissions for generated charts directory
mkdir -p /tmp/generated-charts
chmod 755 /tmp/generated-charts

# Display startup information
echo ""
echo "🌐 Application will be available at: http://localhost:8080"
echo "📖 API health check: http://localhost:8080/api/health"
echo "🎯 Exam workflow:"
echo "   1. Select exam type and difficulty"
echo "   2. Download generated Helm chart"
echo "   3. Apply chart to your cluster: helm install k8s-exam ./chart"
echo "   4. Return to application to start exam"
echo ""
echo "⚡ Starting application server..."

# Execute the main command
exec "$@"