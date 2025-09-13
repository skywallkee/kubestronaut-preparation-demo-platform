# Kubernetes Certification Exam Simulator

A local-only platform for simulating CKAD, CKA, CKS, and KCNA certification exams with real Kubernetes cluster environments.

## 🚀 Quick Start

### Prerequisites

- Docker
- kubectl
- helm
- A running Kubernetes cluster (minikube or rancher)

### Run the Application

```bash
# Build the Docker image
docker build -t k8s-exam-simulator .

# Start the application
docker run -p 8080:8080 k8s-exam-simulator

# Access the web interface
open http://localhost:8080
```

### Verify Prerequisites

```bash
# Check cluster access
kubectl cluster-info

# Verify Helm installation
helm version
```

## 📋 How It Works

1. **Launch Application**: Start the Docker container
2. **Select Exam**: Choose certification type (CKAD/CKA/CKS/KCNA) and difficulty
3. **Get Helm Chart**: Download the generated Helm chart for your exam
4. **Apply to Cluster**: Deploy the chart to your local Kubernetes cluster
5. **Take Exam**: Use the web interface with integrated terminal
6. **Review Results**: Get detailed feedback and scoring

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

## 📊 Example Workflow

1. **Start Application**
   ```bash
   docker run -p 8080:8080 k8s-exam-simulator
   ```

2. **Select CKAD Exam** at http://localhost:8080

3. **Download Generated Helm Chart**

4. **Deploy to Cluster**
   ```bash
   helm install ckad-exam ./downloaded-chart
   ```

5. **Take Exam** using the web interface

6. **Review Results** with detailed feedback

## 🤝 Contributing

This is a local-only certification practice platform. The application is designed to run entirely on your local machine without external dependencies.

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

**Docker build fails**: Ensure you have the latest Docker version and sufficient disk space.

**Cluster connection issues**: Verify kubectl can access your cluster:
```bash
kubectl get nodes
```

**Helm chart deployment fails**: Check cluster resources and permissions:
```bash
kubectl get pods --all-namespaces
helm list
```

**Application not accessible**: Verify port 8080 is not in use:
```bash
lsof -i :8080
```

### Support

For issues and questions, please check the project documentation in CLAUDE.md or create an issue in the project repository.