# CKAD (Certified Kubernetes Application Developer) Categories

This document outlines the official CKAD exam categories and their weight distribution, along with key topics covered in each area.

## Overview

The CKAD exam focuses on developing and managing applications on Kubernetes. The exam covers 6 main categories with the following weight distribution:

---

## 1. Application Design and Build (20%)

### Container Images
- Building container images
- Image security and best practices
- Multi-stage builds
- Image optimization

### Jobs and CronJobs
- Creating and managing Jobs
- Scheduling CronJobs
- Job completion and failure handling
- Parallel processing

### Multi-Container Pod Design
- **Sidecar pattern**: Helper containers (logging, monitoring)
- **Ambassador pattern**: Proxy containers for external communication
- **Adapter pattern**: Transform output for external systems
- **Init containers**: Pre-configuration before main containers start
- Shared volumes and localhost networking between containers

---

## 2. Application Deployment (20%)

### Deployments and Rolling Updates
- Creating and managing Deployments
- Rolling update strategies (RollingUpdate, Recreate)
- Rollback mechanisms and deployment history
- Deployment scaling

### Application Scaling
- Manual scaling with kubectl scale
- Horizontal Pod Autoscaler (HPA)
- Resource-based scaling strategies

### Helm (Package Manager)
- Using Helm charts for application deployment
- Installing and upgrading applications
- Helm templates and values configuration

---

## 3. Application Observability and Maintenance (15%)

### Health Probes
- **Liveness Probes**: Detect when to restart containers
- **Readiness Probes**: Determine when pods are ready to receive traffic
- **Startup Probes**: Handle slow-starting containers
- Probe types: HTTP, TCP, Exec
- Probe configuration and timing

### Logging and Monitoring
- Accessing container and pod logs with kubectl logs
- Container-level vs pod-level logging
- Log aggregation strategies

### Debugging and Troubleshooting
- Using kubectl describe for resource inspection
- Executing commands in containers (kubectl exec)
- Debugging failed pods and services
- Ephemeral containers for debugging

---

## 4. Application Environment, Configuration and Security (25%)

### ConfigMaps and Secrets
- Creating and managing ConfigMaps
- Creating and managing Secrets (generic, docker-registry, TLS)
- Mounting as volumes vs environment variables
- Secret types and security best practices

### Security Contexts
- Pod-level security contexts
- Container-level security contexts
- Running as non-root users (runAsUser, runAsGroup)
- Filesystem permissions and capabilities

### Resource Management
- CPU and memory requests and limits
- Quality of Service (QoS) classes
- Resource quotas and limit ranges
- Container resource optimization

### Service Accounts and RBAC
- Creating and managing service accounts
- Role-Based Access Control (RBAC)
- Binding service accounts to pods
- Principle of least privilege

---

## 5. Services and Networking (20%)

### Services
- **ClusterIP**: Internal cluster communication (default)
- **NodePort**: External access via node ports (30000-32767)
- **LoadBalancer**: Cloud provider load balancers
- **ExternalName**: DNS aliases for external services

### Ingress
- Ingress controllers and ingress resources
- Path-based and host-based routing
- TLS termination and SSL certificates

### Network Policies
- Ingress and egress traffic rules
- Pod-to-pod communication control
- Namespace isolation patterns
- Label-based traffic filtering

### DNS and Service Discovery
- Kubernetes DNS for service discovery
- Service FQDN patterns
- DNS resolution debugging
- Service mesh basics

---

## 6. Storage (10%)

### Persistent Volumes (PV) and Claims (PVC)
- Static provisioning of persistent volumes
- Dynamic provisioning with storage classes
- Access modes: ReadWriteOnce, ReadOnlyMany, ReadWriteMany
- Reclaim policies: Retain, Delete, Recycle

### Storage Classes
- Dynamic volume provisioning
- Storage class parameters and provisioners
- Default storage classes

### Volume Types
- **EmptyDir**: Temporary storage shared between containers
- **HostPath**: Mount host filesystem paths
- **ConfigMap/Secret**: Mount configuration as files
- **Persistent volumes**: Durable storage for stateful applications

---

## Question Categories Mapping

Based on the current question bank, here's how our internal categories map to official CKAD exam topics:

| Our Question Category | Official CKAD Category | Coverage |
|----------------------|------------------------|----------|
| **Core Concepts** | Application Design and Build | Pods, ReplicaSets, basic workloads |
| **Workloads** | Application Deployment | Deployments, Jobs, scaling |
| **Configuration** | Application Environment, Configuration and Security | ConfigMaps, Secrets, resource limits |
| **Security** | Application Environment, Configuration and Security | Security contexts, service accounts |
| **Storage** | Storage | PVs, PVCs, volume mounts |
| **Services** | Services and Networking | Service types, exposure |
| **Networking** | Services and Networking | Network policies, connectivity |
| **Troubleshooting** | Application Observability and Maintenance | Debugging, logs, events |
| **Monitoring** | Application Observability and Maintenance | Probes, health checks |
| **Pod Design** | Application Design and Build | Multi-container patterns, labels |

---

## Exam Details

### Format and Timing
- **Duration**: 2 hours
- **Questions**: 15-20 hands-on tasks
- **Passing Score**: 66%
- **Environment**: Remote proctored, browser-based terminal
- **Kubernetes Version**: v1.28+

### Key Skills to Practice
1. **kubectl CLI mastery** - Know imperative commands by heart
2. **YAML manifest creation** - Write from scratch quickly
3. **Troubleshooting workflows** - Debug failed pods and services systematically
4. **Resource management** - Understand requests/limits impact
5. **Multi-container patterns** - Design and implement sidecar/init containers

### Essential kubectl Commands
```bash
# Quick resource creation
kubectl run pod-name --image=nginx
kubectl create deployment my-app --image=nginx --replicas=3

# Generate YAML templates
kubectl create deployment my-app --image=nginx --dry-run=client -o yaml
kubectl expose deployment my-app --port=80 --dry-run=client -o yaml

# Troubleshooting
kubectl describe pod pod-name
kubectl logs pod-name -c container-name --previous
kubectl exec -it pod-name -- /bin/bash

# Service exposure
kubectl expose deployment my-app --port=80 --type=ClusterIP
kubectl create service nodeport my-service --tcp=80:8080

# Scaling and updates
kubectl scale deployment my-app --replicas=5
kubectl rollout status deployment/my-app
kubectl rollout undo deployment/my-app

# Resource management
kubectl top nodes
kubectl top pods --sort-by=cpu
```

---

## Study Resources

### Official Resources
- [CKAD Curriculum](https://github.com/cncf/curriculum/blob/master/CKAD_Curriculum_v1.28.pdf)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

### Practice Environments
- **Local**: Kind, Minikube, Docker Desktop
- **Cloud**: EKS, GKE, AKS free tiers
- **Online**: Katacoda, Play with Kubernetes

### Exam Tips
1. **Practice time management** - Average 6-8 minutes per question
2. **Use kubectl help** - kubectl create deployment --help
3. **Master vim/nano** - You'll be editing YAML files
4. **Bookmark documentation** - Allowed during exam
5. **Practice imperative commands** - Faster than writing YAML from scratch

---

*Last Updated: December 2024 - Based on CKAD v1.28+ curriculum*
