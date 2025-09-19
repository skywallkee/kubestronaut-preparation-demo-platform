# Kubernetes Exam Simulator - Startup Scripts

This document explains how to use the provided startup scripts that include all the recent fixes for question loading, Helm chart generation, and API routes.

## Quick Start

### Local Development
```bash
# Start backend only
./local-start.sh

# Start backend + frontend (if you need frontend development)
./local-start.sh --with-frontend
```

### Docker Deployment
```bash
# Build and run (recommended)
./docker-start.sh

# Build and run with complete cleanup
./docker-start.sh --clean
```

## What's Fixed

Both scripts ensure the following fixes are applied:

✅ **Questions API**: `/api/questions` route properly loads real question data  
✅ **Path Resolution**: Correct path to question bank (`../../../../../question-bank`)  
✅ **Helm Generation**: `/api/helm/generate` endpoint works with infrastructure requirements  
✅ **Question IDs**: Original question IDs (ckad-e-001, etc.) displayed in UI and NOTES.txt  
✅ **Process Cleanup**: Kills old Node.js processes before starting fresh  

## Local Script Features

- **Process Management**: Automatically kills existing Node.js/npm processes
- **Dependency Check**: Verifies all critical files and services exist
- **Health Testing**: Tests APIs to ensure they're working with real data
- **Service Validation**: Checks that all services can be imported correctly
- **Clean Shutdown**: Ctrl+C properly stops all processes

## Docker Script Features

- **Clean Build**: Uses `--no-cache` to ensure all changes are included
- **Container Management**: Stops and removes existing containers
- **Health Validation**: Tests all APIs work inside the container
- **Image Cleanup**: Optional `--clean` flag removes old images
- **Production Ready**: Runs in production mode with proper environment

## Testing APIs

After running either script, test these endpoints:

```bash
# Health check
curl http://localhost:8080/api/health

# Questions API (should return real question data)
curl "http://localhost:8080/api/questions?exam_type=ckad&difficulty=beginner"

# Helm generation
curl -X POST http://localhost:8080/api/helm/generate \
  -H "Content-Type: application/json" \
  -d '{"type":"ckad","difficulty":"beginner"}'
```

## Expected Behavior

1. **Questions Load**: Should see real question IDs like `ckad-e-001`, `ckad-e-020`, etc.
2. **Helm Charts**: Generate with infrastructure requirements from selected questions
3. **NOTES.txt**: Include selected question IDs for verification
4. **UI Display**: Question names show original IDs alongside titles

## Troubleshooting

### Local Issues
- **Port conflicts**: Script kills existing processes automatically
- **Permission errors**: Ensure script is executable: `chmod +x local-start.sh`
- **Service errors**: Script validates all services load before starting

### Docker Issues  
- **Old cache**: Use `./docker-start.sh --clean` to force fresh build
- **Port conflicts**: Script stops existing containers automatically
- **Build failures**: Check Docker daemon is running

## Manual Commands

If you prefer manual control:

### Local
```bash
# Kill processes
pkill -f node && pkill -f npm

# Start backend
cd app/backend
NODE_ENV=development PORT=8080 node src/index.js
```

### Docker
```bash
# Build fresh
docker build --no-cache -t k8s-exam-simulator .

# Run container
docker run -p 8080:8080 k8s-exam-simulator
```

## Development

Both scripts are designed for development and testing. The Docker script is suitable for production deployment as well.

For development iterations, the local script is faster since it doesn't require rebuilding containers.
