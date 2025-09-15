#!/bin/bash

# Quick test script to verify kubeconfig modifications
echo "Testing kubeconfig modifications for Docker networking..."

# Get current server
current_server=$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')
echo "Current server: $current_server"

if [[ "$current_server" == *"127.0.0.1"* ]] || [[ "$current_server" == *"localhost"* ]]; then
    echo "✅ Localhost server detected - script will modify this"

    # Test the modification logic
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        new_server=$(echo "$current_server" | sed -E 's/(127\.0\.0\.1|localhost)/172.17.0.1/g')
        echo "Linux: Would convert to: $new_server"
    else
        new_server=$(echo "$current_server" | sed -E 's/(127\.0\.0\.1|localhost)/host.docker.internal/g')
        echo "macOS/Windows: Would convert to: $new_server"
    fi

    echo "Would add: insecure-skip-tls-verify: true"
else
    echo "✅ External server - no modification needed"
fi

# Test cluster connectivity
echo
echo "Testing cluster connectivity from host..."
if kubectl cluster-info &> /dev/null; then
    echo "✅ Host can connect to cluster"
else
    echo "❌ Host cannot connect to cluster"
fi

echo
echo "Current context: $(kubectl config current-context)"
echo "Cluster nodes:"
kubectl get nodes --no-headers 2>/dev/null | wc -l | xargs -I {} echo "  {} nodes found"