#!/bin/bash
set -e

echo "🚀 Starting Kubernetes Exam Simulator..."

# Check if kubectl is available
if command -v kubectl &> /dev/null; then
    echo "✅ kubectl is available"
    kubectl version --client || echo "⚠️  kubectl client version check failed"
else
    echo "❌ kubectl not found"
fi

# Check if helm is available
if command -v helm &> /dev/null; then
    echo "✅ helm is available"
    helm version || echo "⚠️  helm version check failed"
else
    echo "❌ helm not found"
fi

# Try to connect to Kubernetes cluster
echo "🔍 Checking Kubernetes cluster connectivity..."
if kubectl cluster-info &> /dev/null; then
    echo "✅ Connected to Kubernetes cluster"
    kubectl get nodes --no-headers 2>/dev/null | wc -l | xargs -I {} echo "📊 Found {} nodes in cluster"
else
    echo "⚠️  No Kubernetes cluster connection detected"
    echo "   This is normal if you haven't set up kubectl access yet"
    echo "   The application will still start and generate Helm charts"
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