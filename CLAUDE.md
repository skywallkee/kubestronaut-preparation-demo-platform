# Kubernetes Certification Exam Simulator

A local-only platform for simulating CKAD, CKA, and other Kubernetes certifications with real cluster environments.

## Project Overview

This application simulates Kubernetes certification exams (CKAD, CKA, CKS, KCNA) with authentic multi-cluster environments. Designed for local deployment only, users can practice with realistic exam conditions including time limits, SSH-like cluster access, and automated scoring.

## User Flow

1. **Launch Application**: Run Docker container to start the application
2. **Select Exam**: Choose certification type and difficulty via web interface
3. **Get Helm Chart**: Download generated Helm chart specific to selected exam
4. **Apply to Cluster**: Apply Helm chart to local Kubernetes cluster
5. **Take Exam**: Use two-column interface with questions and integrated terminal
6. **Review Results**: Get scored results with detailed explanations and correct answers

## Architecture

### Core Components

1. **Frontend Application** (React/Vue.js)
   - Exam selection and configuration
   - Two-column exam interface
   - Question management with flagging
   - Integrated terminal (Wetty)
   - Timer and progress tracking
   - Enhanced review mode with solution steps
   - CopyableValue component with quote stripping
   - QuestionWithCopyables component for value highlighting

2. **Backend API** (Node.js/Python)
   - In-memory session management
   - Exam configuration
   - Question serving with individual question details
   - Scoring engine with validation command execution
   - Helm chart generation
   - QuestionService with getQuestionById method

3. **Multi-Cluster Environment**
   - 3-4 Kubernetes nodes per exam
   - Supports Rancher Kubernetes and Minikube
   - Dynamic cluster provisioning
   - SSH-like access simulation

4. **Helm Chart System**
   - Test-specific deployments
   - Environment setup automation
   - Resource management
   - Cleanup procedures

## Features

### Certification Support
- **CKAD** (Certified Kubernetes Application Developer)
- **CKA** (Certified Kubernetes Administrator)
- **CKS** (Certified Kubernetes Security Specialist)
- **KCNA** (Kubernetes and Cloud Native Associate)

### Exam Experience
- 15-19 questions per exam
- 67/100 passing score
- Configurable difficulty levels
- Time-bound sessions (2-3 hours)
- Question flagging and completion tracking
- Linear question progression
- Enhanced review mode with solution steps and validation commands
- Copy functionality for important values with quote stripping

### Cluster Environment
- Multi-node cluster simulation
- SSH-equivalent access via terminal
- Real Kubernetes environments
- In-memory exam state management
- Network policies and security contexts

### Scoring System
- Automated answer validation with kubectl commands
- Detailed feedback per question with solution steps
- Sub-point scoring breakdown with point values
- Comprehensive explanations with validation commands
- Performance analytics and post-exam review mode
- Collapsible solution sections with numbered instructions

## Technology Stack

### Frontend
```
- React 18+ or Vue 3+
- TypeScript
- Tailwind CSS or Material-UI
- Xterm.js for terminal
- WebSocket for real-time communication
```

### Backend
```
- Node.js with Express or Python FastAPI
- WebSocket support (Socket.io/WebSockets)
- In-memory data storage (no database required)
- File-based question bank
- Docker for containerization
```

### Infrastructure
```
- Kubernetes 1.28+
- Helm 3.x
- Rancher Kubernetes Engine (RKE2)
- Minikube support
- Wetty for web-based terminal
- nginx for reverse proxy
```

### DevOps
```
- Single Dockerfile for easy deployment
- Kubernetes manifests
- Helm charts
- Local development only (no CI/CD needed)
```

## Project Structure

```
kubernetes-exam-simulator/
├── app/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ExamInterface/
│   │   │   │   ├── QuestionPanel/
│   │   │   │   ├── Terminal/
│   │   │   │   └── Timer/
│   │   │   ├── pages/
│   │   │   └── utils/
│   │   └── package.json
│   └── backend/
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   │   ├── helm-generator/
│       │   │   ├── scoring-engine/
│       │   │   └── question-provider/
│       │   └── utils/
│       └── package.json
├── helm-templates/
│   ├── ckad/
│   │   ├── templates/
│   │   ├── values.yaml
│   │   └── Chart.yaml
│   ├── cka/
│   └── cks/
├── question-bank/
│   ├── ckad/
│   │   ├── beginner/
│   │   │   ├── 001-pod-creation.json
│   │   │   └── *.json
│   │   ├── intermediate/
│   │   └── advanced/
│   ├── cka/
│   ├── cks/
│   └── kcna/
├── scoring-scripts/
│   ├── validators/
│   ├── checkers/
│   └── explanations/
├── Dockerfile
├── docker-entrypoint.sh
└── README.md
```

## Development Phases

### Phase 1: Core Infrastructure ✅
- [x] Set up project structure
- [x] Implement basic frontend with exam selection
- [x] Create backend API with in-memory session management
- [x] Implement Wetty integration
- [x] Create single Dockerfile for deployment

### Phase 2: Helm Chart System ✅
- [x] Create Helm chart templates for each certification
- [x] Implement dynamic Helm chart generation
- [x] Add cluster node configuration
- [x] Set up SSH-like access simulation
- [x] Configure networking and security

### Phase 3: Question System ✅
- [x] Build file-based question bank
- [x] Implement question serving logic
- [x] Create flagging and completion system
- [x] Develop linear progression logic
- [x] Add timer functionality

### Phase 4: Scoring Engine ✅
- [x] Create automated validation scripts
- [x] Implement in-memory scoring algorithms
- [x] Build feedback generation
- [x] Add explanation system
- [x] Create answer review interface

### Phase 5: Integration & Testing ✅
- [x] End-to-end testing
- [x] Local deployment testing
- [x] User flow validation
- [x] Documentation completion

## Quick Start

### For Exam Takers
```bash
# 1. Launch the application
docker run -p 8080:8080 k8s-exam-simulator

# 2. Visit the web interface
open http://localhost:8080

# 3. Select exam type and difficulty, download Helm chart

# 4. Apply Helm chart to your cluster
helm install k8s-exam ./downloaded-chart

# 5. Return to web interface to start exam

# 6. Review results after completion
```

### For Developers
```bash
# Build Docker image
docker build -t k8s-exam-simulator .

# Run locally for development
docker run -p 8080:8080 -v $(pwd):/app k8s-exam-simulator

# Test with minikube
minikube start --nodes 4
helm install test-exam ./helm-templates/ckad
```

## Configuration

### Cluster Configuration
```yaml
# cluster-config.yaml
clusters:
  rancher:
    nodes: 4
    version: "1.28.5"
    networking: "calico"
  minikube:
    nodes: 3
    version: "1.28.0"
    driver: "docker"

exams:
  ckad:
    questions: 17
    duration: 120 # minutes
    passing_score: 67
  cka:
    questions: 15
    duration: 180
    passing_score: 67
```

### Environment Variables
```bash
# .env (optional - defaults provided)
CLUSTER_PROVIDER=minikube # or rancher
EXAM_TIMEOUT=10800 # 3 hours in seconds
WETTY_PORT=3000
APP_PORT=8080
```

## API Documentation

### Exam Endpoints
```
POST   /api/exams              # Create exam session (in-memory)
GET    /api/exams/current      # Get current exam details
POST   /api/exams/start        # Start exam timer
POST   /api/exams/flag         # Flag current question
POST   /api/exams/complete     # Mark current question complete
POST   /api/exams/submit       # Submit exam for scoring
GET    /api/exams/results      # Get results with explanations
```

### Question Endpoints
```
GET    /api/questions/current      # Get current question
GET    /api/questions/:questionId/details  # Get full question data with solutions
POST   /api/questions/next         # Move to next question
GET    /api/questions/flagged      # Get flagged questions list
POST   /api/questions/goto         # Go to specific flagged question
```

### Helm Chart Endpoints
```
POST   /api/helm/generate      # Generate Helm chart for exam
GET    /api/helm/download      # Download generated chart
GET    /api/helm/status        # Check if chart is applied
```

## Security Considerations

- Container isolation for application
- Resource quotas and limits in Helm charts
- RBAC configuration for cluster access
- Secure terminal access via Wetty
- Local-only deployment (no external data exposure)
- Session timeout handling
- Input validation and sanitization

## Deployment

### Single Container Deployment
```bash
# Build and run
docker build -t k8s-exam-simulator .
docker run -p 8080:8080 k8s-exam-simulator

# Run with cluster access (mount kubeconfig)
docker run -p 8080:8080 -v ~/.kube/config:/kube-config:ro k8s-exam-simulator

# Access application
http://localhost:8080
```

### Prerequisites
```bash
# Required tools on host system
- Docker
- kubectl
- helm
- A running Kubernetes cluster (minikube/rancher)

# Verify cluster access
kubectl cluster-info
helm version
```

## Application Workflow

### 1. Initial Setup
- User runs Docker container
- Application starts on localhost:8080
- Web interface loads with exam selection

### 2. Exam Configuration
- User selects certification type (CKAD/CKA/CKS/KCNA)
- Chooses difficulty level (beginner/intermediate/advanced)
- System generates custom Helm chart
- User downloads Helm chart package

### 3. Cluster Preparation
- User applies Helm chart to local cluster
- Chart provisions exam environment with 3-4 nodes
- Sets up question-specific resources and challenges
- Configures SSH-like access via Wetty

### 4. Exam Execution
- User returns to web interface
- Two-column layout: questions on left, terminal on right
- Linear question progression with flagging system
- Integrated Wetty terminal for cluster interaction
- Timer tracks remaining exam time

### 5. Results & Review
- Automated scoring runs on cluster nodes
- Enhanced review mode with collapsible solution steps
- Detailed feedback with validation commands and expected outputs
- Explanations for each question and sub-point with point values
- Option to review flagged questions with full solution details
- Performance summary and improvement suggestions
- Copy functionality for all highlighted values in solutions

## Implementation Details

### Enhanced Review Mode
The application features a comprehensive review mode accessible after exam submission:

- **Solution Steps**: Each question includes collapsible solution sections with numbered, step-by-step instructions
- **Validation Commands**: Display the exact kubectl commands used for scoring with expected outputs and point values
- **Value Highlighting**: Uses QuestionWithCopyables component to highlight important values throughout the solution text
- **Interactive Elements**: Solution steps and validation commands are collapsible for better organization

### Copy Functionality Enhancement
The CopyableValue component provides intelligent value copying:

- **Quote Stripping**: Automatically removes surrounding single and double quotes when copying values
- **Display vs Copy**: Values like `'server.port=8080'` display with quotes but copy as `server.port=8080`
- **Seamless Integration**: Works throughout the application in questions, solutions, and validation commands

### Docker Deployment Enhancements
The Docker container has been optimized for Kubernetes cluster connectivity:

- **Read-only Kubeconfig Support**: Creates working copy at `/tmp/kube-config` instead of modifying mounted files
- **Network Translation**: Automatically converts `localhost` references to `host.docker.internal` for cluster access
- **Robust Error Handling**: Graceful fallback when kubeconfig is not available or accessible

### Question Bank Structure
Questions are organized in a hierarchical file structure:

```
question-bank/
├── {exam-type}/
│   ├── {difficulty}/
│   │   ├── 001-question-name.json
│   │   └── ...
```

Each question file contains:
- **Basic Info**: id, title, description, points
- **Solution**: Array of numbered step objects with detailed instructions
- **Validations**: Array of validation command objects with command, expected output, and points

### Backend API Enhancements
New endpoints and services for enhanced functionality:

- **Question Details Endpoint**: `/api/questions/:questionId/details` for fetching complete question data
- **QuestionService.getQuestionById**: Method to load individual question files from the file system
- **Enhanced Validation**: Support for complex validation scenarios with detailed feedback

## Testing Strategy

- Container deployment testing
- Helm chart generation validation
- Question bank integrity checks
- Scoring engine accuracy tests
- Multi-cluster environment testing
- User workflow end-to-end testing
- Review mode functionality testing
- Copy functionality validation
- Docker networking verification

## License

MIT License - see LICENSE file for details

---

## 📊 Project Status: COMPLETE ✅

### 🎯 All Major Features Implemented:
- ✅ **Full Stack Application** - React frontend + Node.js backend
- ✅ **Multi-Exam Support** - CKAD, CKA, CKS, KCNA with 50+ questions each
- ✅ **Dynamic Helm Chart Generation** - Real-time chart creation with infrastructure requirements
- ✅ **Planetary Namespace System** - Saturn, Venus, Pluto, Mars namespaces for realistic environments
- ✅ **Automated Scoring System** - Real kubectl validation commands with detailed feedback
- ✅ **Copyable Value System** - ||value|| markup for easy copying of important values
- ✅ **Docker Integration** - Single container deployment with cluster connectivity fixes
- ✅ **Two-Column Interface** - Questions + integrated terminal (Wetty)
- ✅ **Complete Exam Workflow** - Selection → Generation → Application → Exam → Results

### 🚀 Ready for Production Use:
- All development phases completed
- Comprehensive question bank with validations
- Docker container with Kubernetes cluster integration
- Automated scoring with solution steps and detailed feedback
- Professional UI/UX with timer, flagging, and progress tracking

### 🔧 Recent Enhancements:
- **Enhanced Review Mode**: Collapsible solution steps with numbered instructions and validation commands
- **Smart Copy Functionality**: Quote stripping in CopyableValue component for seamless value copying
- **Docker Networking Fixes**: Read-only kubeconfig support with localhost to host.docker.internal conversion
- **Question Details API**: New endpoint for fetching complete question data with solutions
- **Improved Question Bank**: Hierarchical structure with individual JSON files per question
- **Advanced Validation**: Detailed feedback with command outputs and point breakdowns
- **UI/UX Improvements**: QuestionWithCopyables component for better value highlighting