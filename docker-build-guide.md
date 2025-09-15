# Docker Build and Run Guide

## Building the Docker Image

```bash
# Build the image
docker build -t k8s-exam-simulator .

# Alternative with build context info
docker build -t k8s-exam-simulator --progress=plain .
```

## Running the Container

### Basic Run
```bash
docker run -p 8080:8080 k8s-exam-simulator
```

### Run with Kubernetes Access (if you have kubectl configured)
```bash
# Mount your kubeconfig to give container access to your cluster
docker run -p 8080:8080 \
  -v ~/.kube/config:/root/.kube/config:ro \
  k8s-exam-simulator
```

### Run in Development Mode (with volumes for hot reload)
```bash
docker run -p 8080:8080 \
  -v $(pwd)/app/backend/src:/app/src:ro \
  -v ~/.kube/config:/root/.kube/config:ro \
  k8s-exam-simulator
```

### Run with Custom Environment Variables
```bash
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e CLUSTER_NAME=my-k8s-cluster \
  -v ~/.kube/config:/root/.kube/config:ro \
  k8s-exam-simulator
```

## Accessing the Application

Once the container is running:

- **Web Interface**: http://localhost:8080
- **Health Check**: http://localhost:8080/api/health
- **Terminal WebSocket**: ws://localhost:8080/terminal

## Container Features

The containerized version includes:

✅ **Full Terminal Functionality**
- Web-based terminal with kubectl access
- CTRL+C handling (works in host terminal)
- kubectl alias (`k=kubectl`) pre-configured
- Proper table formatting for kubectl commands

✅ **Kubernetes Tools**
- kubectl (latest stable version)
- helm (latest stable version)
- All necessary system dependencies

✅ **Production Optimizations**
- Multi-stage build for smaller image size
- Static frontend serving
- Health checks
- Graceful shutdown handling

## Troubleshooting

### Container Won't Start
```bash
# Check container logs
docker logs <container-id>

# Run in interactive mode for debugging
docker run -it k8s-exam-simulator /bin/bash
```

### Terminal Not Working
```bash
# Ensure WebSocket connection is working
curl -I http://localhost:8080

# Check if container has necessary terminal tools
docker exec -it <container-id> bash
which bash kubectl helm
```

### No Kubernetes Access
```bash
# Check if kubeconfig is properly mounted
docker exec -it <container-id> cat /root/.kube/config

# Test kubectl access inside container
docker exec -it <container-id> kubectl cluster-info
```

## Image Details

- **Base Image**: node:18-alpine
- **Final Image Size**: ~200MB (estimated)
- **Exposed Port**: 8080
- **Working Directory**: /app
- **Entry Point**: /usr/local/bin/docker-entrypoint.sh