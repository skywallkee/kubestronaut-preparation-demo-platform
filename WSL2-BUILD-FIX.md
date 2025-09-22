# WSL2 OneDrive Docker Build Fix

## Problem
WSL2 with OneDrive sync causes file system I/O errors during Docker builds, preventing the standard build process from working.

## Quick Fix (Recommended)

Since you already have a working Docker image built (`k8s-exam-simulator:latest`), you can run the application directly:

```bash
# Use the existing image
docker run -p 8080:8080 -v ~/.kube/config:/root/.kube/config:ro k8s-exam-simulator
```

## Alternative Solutions

### 1. Copy to Native Linux Filesystem
```bash
# Copy the project to a native Linux path
cp -r . /tmp/k8s-exam-simulator
cd /tmp/k8s-exam-simulator

# Remove node_modules to avoid issues
rm -rf app/*/node_modules

# Build from native filesystem
docker build -t k8s-exam-simulator .
```

### 2. Use Different Directory
Move your project out of OneDrive to a regular Windows or Linux directory:
```bash
# Move to Windows C: drive (not in OneDrive)
cp -r . /mnt/c/temp/k8s-exam-simulator
cd /mnt/c/temp/k8s-exam-simulator
docker build -t k8s-exam-simulator .
```

### 3. Use WSL2 Native Directory
```bash
# Copy to WSL2 home directory
cp -r . ~/k8s-exam-simulator
cd ~/k8s-exam-simulator
docker build -t k8s-exam-simulator .
```

## Why This Happens
- OneDrive sync interferes with file system operations in WSL2
- Extended attributes and symlinks in node_modules cause I/O errors
- Docker build context cannot handle the file system inconsistencies

## Current Status
✅ You have a working Docker image built successfully
✅ The application is ready to run
✅ No further build fixes needed unless you modify the code