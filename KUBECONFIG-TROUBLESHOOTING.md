# Kubernetes Connection Troubleshooting

This guide helps resolve common Kubernetes connectivity issues when running the exam simulator in Docker.

## Quick Fix

If you're getting connection refused errors like:
```
dial tcp 127.0.0.1:6443: connect: connection refused
```

**Stop the current container and re-run the setup script:**

```bash
# Stop and remove current container
docker stop k8s-exam-simulator
docker rm k8s-exam-simulator

# Re-run the setup script (it will fix the kubeconfig automatically)
./docker-start.sh
```

## Common Issues and Solutions

### 1. localhost/127.0.0.1 Connection Issues

**Problem**: Container can't reach Kubernetes API at `127.0.0.1:6443` or `localhost:6443`

**Solution**: The updated `docker-start.sh` script automatically detects and fixes this by:
- **Linux**: Converting to Docker bridge IP (`172.17.0.1:6443`) or using host networking
- **macOS/Windows**: Converting to `host.docker.internal:6443`

### 2. Rancher Desktop

**Problem**: Rancher Desktop often uses `127.0.0.1:6443`

**Solution**:
```bash
# Check your current context
kubectl config current-context

# The script will automatically convert the server URL
# From: https://127.0.0.1:6443
# To:   https://host.docker.internal:6443 (macOS/Windows)
# Or:   https://172.17.0.1:6443 (Linux)
```

### 3. Docker Desktop Kubernetes

**Problem**: Similar localhost issues

**Solution**: Automatically handled by the script. Server URL is converted to `host.docker.internal:6443`

### 4. Minikube

**Problem**: Minikube IP not accessible from container

**Solution**:
```bash
# If minikube is using a VM, get the IP
minikube ip

# The script preserves real IP addresses like 192.168.x.x
# Only localhost/127.0.0.1 are converted
```

### 5. kind (Kubernetes in Docker)

**Problem**: kind clusters use localhost by default

**Solution**:
```bash
# Check kind cluster
kind get clusters

# The script automatically handles kind's localhost URLs
```

## Manual Troubleshooting

If the automatic fixes don't work, you can manually troubleshoot:

### Check Your Cluster Connection (Host)
```bash
# Test from host machine
kubectl cluster-info
kubectl get nodes

# Check server URL
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
```

### Check From Inside Container
```bash
# Get shell access to running container
docker exec -it k8s-exam-simulator /bin/bash

# Test kubectl inside container
kubectl cluster-info
kubectl get nodes

# Check the modified kubeconfig
cat /root/.kube/config
```

### Check Container Networking
```bash
# Test network connectivity from container
docker exec -it k8s-exam-simulator ping host.docker.internal  # macOS/Windows
docker exec -it k8s-exam-simulator ping 172.17.0.1          # Linux
```

## Platform-Specific Notes

### Linux
- Uses Docker bridge network (usually `172.17.0.1`)
- May use `--network host` for localhost clusters
- Bridge IP is auto-detected from `ip route` command

### macOS
- Uses `host.docker.internal` (provided by Docker Desktop)
- Requires Docker Desktop to be running

### Windows
- Uses `host.docker.internal` (provided by Docker Desktop)
- Requires Docker Desktop to be running
- WSL2 backend recommended

## Verification Commands

After the container starts, verify connectivity:

```bash
# From your host machine, check container logs
docker logs k8s-exam-simulator

# Test the application
curl http://localhost:8080/api/health

# Test kubectl from inside container
docker exec k8s-exam-simulator kubectl get ns
```

## Common Kubernetes Distributions

| Distribution | Default Server | Auto-Fixed To |
|--------------|---------------|---------------|
| Docker Desktop | `127.0.0.1:6443` | `host.docker.internal:6443` |
| Rancher Desktop | `127.0.0.1:6443` | `host.docker.internal:6443` |
| minikube | `192.168.x.x:8443` | No change needed |
| kind | `127.0.0.1:xxxxx` | `host.docker.internal:xxxxx` |
| k3d | `127.0.0.1:6550` | `host.docker.internal:6550` |

## Getting Help

If you're still having issues:

1. **Check the container logs**: `docker logs k8s-exam-simulator`
2. **Verify host connectivity**: `kubectl cluster-info` (from host)
3. **Check Docker networking**: `docker network ls`
4. **Try host networking** (Linux only): Add `--network host` manually to docker run

## Contact

If none of these solutions work, please provide:
- Your OS and Docker version
- Kubernetes distribution (Docker Desktop, Rancher, minikube, etc.)
- Output of `kubectl config view --minify`
- Container logs: `docker logs k8s-exam-simulator`