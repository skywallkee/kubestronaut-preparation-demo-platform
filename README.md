# Kubernetes Certification Exam Simulator

A comprehensive local platform for simulating CKAD, CKA, CKS, and KCNA certification exams with real Kubernetes cluster environments.

## 🌟 Key Features

- 🎯 **Four Certifications**: CKAD, CKA, CKS, KCNA with comprehensive question banks
- 🚀 **One-Command Setup**: `./docker-start.sh` handles everything automatically
- 🔧 **Real Kubernetes Integration**: Deploy actual resources to your cluster
- 📝 **80+ CKAD Questions**: Complete coverage of all 20 CKAD subcategories
- ⏱️ **Realistic Exam Experience**: Timed exams with integrated terminal
- 📊 **Automated Scoring**: Instant feedback with detailed explanations
- 🌐 **Local-Only**: No external dependencies or data sharing
- 🎨 **Professional UI**: Two-column layout with question navigation

## ⚡ Quick Start

### Prerequisites

- **Docker** (for containerized deployment)
- **kubectl** (for Kubernetes cluster access)
- **helm** (for chart deployment)
- **Running Kubernetes cluster** (minikube recommended: `minikube start --nodes 3`)

### 🐳 Recommended: One-Command Startup

```bash
# Clone the repository
git clone <repository-url>
cd kubernetes-exam-simulator

# Start with interactive configuration (recommended)
./docker-start.sh

# Or start with a clean build
./docker-start.sh --clean
```

The `docker-start.sh` script provides:
- ✅ **Automatic prerequisite checking**
- ✅ **Interactive configuration** (port, network, Kubernetes context)
- ✅ **Intelligent kubeconfig mounting**
- ✅ **Container health verification**
- ✅ **Complete setup validation**

### Alternative: Manual Docker Commands

```bash
# Build the Docker image
docker build -t k8s-exam-simulator .

# Start with kubeconfig access
docker run -p 8080:8080 -v ~/.kube/config:/kube-config:ro k8s-exam-simulator

# Or start isolated (no cluster access)
docker run -p 8080:8080 k8s-exam-simulator
```

## 🎯 Complete Exam Workflow

### Step 1: Launch Application
```bash
./docker-start.sh
# Application starts at http://localhost:8080
```

### Step 2: Select Your Exam
- Visit **http://localhost:8080**
- Choose certification type: **CKAD**, **CKA**, **CKS**, or **KCNA**
- Select difficulty level: **Easy** (beginner), **Intermediate**, or **Hard** (advanced)

### Step 3: Generate Exam Environment
- Click **"Generate Helm Chart"**
- System creates custom chart with:
  - Real exam questions (15-19 questions)
  - Infrastructure requirements (namespaces, RBAC, etc.)
  - Planetary namespace system (saturn, venus, pluto, mars)
- Download the generated `.tgz` chart file

### Step 4: Deploy to Your Cluster
```bash
# Extract and deploy the chart
tar -xzf downloaded-exam-chart.tgz
helm install k8s-exam ./exam-chart

# Verify deployment
kubectl get pods --all-namespaces
```

### Step 5: Take the Exam
- Return to the web interface
- Use the **two-column layout**:
  - **Left**: Question panel with navigation
  - **Right**: Integrated terminal (Wetty)
- Features available during exam:
  - ⏱️ **Timer** with configurable time limits
  - 🏷️ **Question flagging** for review
  - 📍 **Progress tracking**
  - 🔄 **Linear navigation** through questions

### Step 6: Review Results
After submission:
- 📊 **Automated scoring** with validation commands
- 📋 **Detailed feedback** for each question
- 🎯 **Solution steps** with copyable values
- 📈 **Performance analytics**
- 🔍 **Review flagged questions**

## 📚 Exam Content Details

### Question Bank Coverage
- **📘 CKAD**: 80 intermediate questions covering 20 subcategories
- **📗 CKA**: 50+ questions across administrator topics
- **📙 CKS**: 40+ security-focused questions
- **📕 KCNA**: 60+ cloud-native fundamentals

### Subcategory Coverage (CKAD Example)
Each subcategory appears in 10+ questions:
- `application-scaling`, `configmaps-secrets`, `container-images`
- `debugging-troubleshooting`, `deployments-rolling-updates`
- `dns-service-discovery`, `health-probes`, `helm-package-manager`
- `ingress`, `jobs-cronjobs`, `logging-monitoring`
- `multi-container-pods`, `network-policies`, `persistent-volumes-claims`
- `resource-management`, `security-contexts`, `service-accounts-rbac`
- `services`, `storage-classes`, `volume-types`

## 🎯 Supported Certifications

- **CKAD** (Certified Kubernetes Application Developer)
- **CKA** (Certified Kubernetes Administrator) 
- **CKS** (Certified Kubernetes Security Specialist)
- **KCNA** (Kubernetes and Cloud Native Associate)

## ✨ Features

### Exam Experience
- 15-19 questions per exam
- 67/100 passing score
- 2-3 hour time limits
- Question flagging and tracking
- Linear progression through questions
- Integrated web-based terminal

### Environment
- Multi-node cluster simulation (3-4 nodes)
- SSH-equivalent access via Wetty terminal
- Real Kubernetes environments
- Network policies and security contexts
- Automated resource provisioning

### Scoring & Feedback
- Automated answer validation
- Detailed explanations for each question
- Sub-point scoring breakdown
- Performance analytics
- Review of flagged questions

## 🏗️ Architecture

### Frontend
- React/Vue.js application
- Two-column exam interface
- Integrated Xterm.js terminal
- Real-time WebSocket communication
- Timer and progress tracking

### Backend
- Node.js with Express
- In-memory session management
- WebSocket support via Socket.io
- Dynamic Helm chart generation
- Automated scoring engine

### Infrastructure
- Kubernetes 1.28+
- Helm 3.x for deployments
- Wetty for web-based terminal access
- nginx reverse proxy
- Docker containerization

## 📁 Project Structure

```
kubernetes-exam-simulator/
├── app/
│   ├── frontend/          # React/Vue.js application
│   └── backend/           # Node.js API server
├── helm-templates/        # Helm charts for each certification
│   ├── ckad/
│   ├── cka/
│   ├── cks/
│   └── kcna/
├── question-bank/         # JSON files with questions and answers
├── scoring-scripts/       # Validation and scoring logic
├── Dockerfile
├── docker-entrypoint.sh
└── README.md
```

## 🔧 Configuration

### Environment Variables

```bash
CLUSTER_PROVIDER=minikube    # or rancher
EXAM_TIMEOUT=10800          # 3 hours in seconds
WETTY_PORT=3000
APP_PORT=8080
```

### Cluster Configuration

The application supports both Minikube and Rancher Kubernetes environments:

```yaml
# Example cluster config
clusters:
  minikube:
    nodes: 3
    version: "1.28.0"
    driver: "docker"
  rancher:
    nodes: 4
    version: "1.28.5"
    networking: "calico"
```

## 📡 API Endpoints

### Exam Management
```
POST   /api/exams              # Create new exam session
GET    /api/exams/current      # Get current exam details
POST   /api/exams/start        # Start exam timer
POST   /api/exams/submit       # Submit exam for scoring
GET    /api/exams/results      # Get results with explanations
```

### Question Navigation
```
GET    /api/questions/current  # Get current question
POST   /api/questions/next     # Move to next question
POST   /api/questions/flag     # Flag current question
GET    /api/questions/flagged  # Get flagged questions
```

### Helm Chart Generation
```
POST   /api/helm/generate      # Generate exam-specific Helm chart
GET    /api/helm/download      # Download generated chart
GET    /api/helm/status        # Check deployment status
```

## 🧪 Testing

### Local Development

```bash
# Run with volume mount for development
docker run -p 8080:8080 -v $(pwd):/app k8s-exam-simulator

# Test with minikube
minikube start --nodes 4
helm install test-exam ./helm-templates/ckad
```

### Health Check

The application includes a health check endpoint:

```bash
curl -f http://localhost:8080/api/health
```

## 🔒 Security

- Container isolation
- Resource quotas and limits in Helm charts
- RBAC configuration for cluster access
- Secure terminal access via Wetty
- Local-only deployment (no external data exposure)
- Input validation and sanitization
- Session timeout handling

## 🔧 Advanced Configuration

### Container Options

```bash
# Run with specific port
./docker-start.sh
# Then select custom port during interactive setup

# Run with host networking
./docker-start.sh
# Then select 'host' for network configuration

# Run with specific Kubernetes context
./docker-start.sh
# Then specify your context during setup
```

### Environment Variables

```bash
# Manual configuration (if not using docker-start.sh)
docker run -p 8080:8080 \
  -e CLUSTER_PROVIDER=minikube \
  -e EXAM_TIMEOUT=10800 \
  -e NODE_ENV=production \
  -v ~/.kube/config:/kube-config:ro \
  k8s-exam-simulator
```

### Kubernetes Cluster Requirements

**Minimum cluster specs:**
- 3-4 nodes (recommended)
- 4GB+ total memory
- Support for multiple namespaces
- RBAC enabled

**Quick cluster setup:**
```bash
# Minikube (recommended)
minikube start --nodes 3 --memory 4096 --disk-size 20g

# Kind (alternative)
kind create cluster --config cluster-config.yaml

# Verify cluster
kubectl cluster-info
kubectl get nodes
```

## 🤝 Contributing

This is a local-only certification practice platform. The application is designed to run entirely on your local machine without external dependencies.

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

**Docker build fails**:
```bash
# Ensure sufficient disk space and clean old images
docker system prune -f
./docker-start.sh --clean
```

**Container won't start**:
```bash
# Check container logs
docker logs k8s-exam-simulator

# Verify prerequisites
./docker-start.sh  # Interactive diagnosis
```

**Cluster connection issues**:
```bash
# Test cluster access
kubectl cluster-info
kubectl get nodes

# Check kubeconfig
cat ~/.kube/config

# Test from container
docker exec k8s-exam-simulator kubectl get nodes
```

**Helm chart deployment fails**:
```bash
# Check cluster resources
kubectl get pods --all-namespaces
kubectl describe nodes

# Verify RBAC permissions
kubectl auth can-i create pods --all-namespaces

# Clean up failed deployments
helm list --all-namespaces
helm uninstall <release-name>
```

**Application not accessible**:
```bash
# Check if port is in use
lsof -i :8080
netstat -tulpn | grep 8080

# Verify container networking
docker ps
docker port k8s-exam-simulator
```

**Questions not loading**:
```bash
# Test questions API directly
curl -s http://localhost:8080/api/questions?exam_type=ckad&difficulty=intermediate

# Check question bank files
find question-bank/ -name "*.json" | wc -l
```

### Health Check Commands

```bash
# Application health
curl -f http://localhost:8080/api/health

# Container status
docker exec k8s-exam-simulator ps aux

# Question bank integrity
docker exec k8s-exam-simulator find /app/question-bank -name "*.json" | wc -l
```

### Support

- 📖 **Complete documentation**: See `CLAUDE.md` for detailed project information
- 🐛 **Issues**: Create an issue in the project repository
- 💡 **Quick fix**: Try `./docker-start.sh --clean` for most startup issues