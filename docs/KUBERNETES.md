# Kubernetes Deployment Guide

This directory contains Kubernetes manifests to deploy the Datadog Observability Playground application with 4 replicas.

## Prerequisites

- Local Kubernetes cluster running (e.g., Docker Desktop, Minikube, or Kind)
- kubectl installed and configured
- Docker image built for the application
- Datadog API key

## Quick Start

### 1. Build the Docker Image

```bash
cd packages/app
docker build -t datadog-crud-api:latest .
```

### 2. Set up Datadog API Key

Option A: Edit the secret file directly
```bash
# Edit k8s/datadog-secret.yaml and replace YOUR_DATADOG_API_KEY with your actual key
```

Option B: Create secret via kubectl (recommended)
```bash
kubectl create secret generic datadog-secret --from-literal=api-key=YOUR_DATADOG_API_KEY
```

If you use Option B, skip applying the datadog-secret.yaml file in step 3.

### 3. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or apply them individually in order
kubectl apply -f k8s/datadog-secret.yaml          # Skip if using Option B above
kubectl apply -f k8s/datadog-agent-deployment.yaml
kubectl apply -f k8s/datadog-agent-service.yaml
kubectl apply -f k8s/app-deployment.yaml
kubectl apply -f k8s/app-service.yaml
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods

# Check services
kubectl get services

# Check deployment status
kubectl get deployments
```

You should see:
- 4 replicas of `datadog-crud-api` pods running
- 1 replica of `datadog-agent` pod running

### 5. Access the Application

The application is exposed via NodePort on port 30000:

```bash
# For Docker Desktop or Minikube
curl http://localhost:30000/health

# For Minikube, you might need to use:
minikube service datadog-crud-api --url
```

## Architecture

- **app-deployment.yaml**: Deploys the Node.js application with 4 replicas
- **app-service.yaml**: Exposes the application via NodePort on port 30000
- **datadog-agent-deployment.yaml**: Deploys the Datadog agent for observability
- **datadog-agent-service.yaml**: Internal service for the Datadog agent
- **datadog-secret.yaml**: Stores the Datadog API key securely

## Configuration

### Scaling Replicas

To change the number of replicas:

```bash
kubectl scale deployment datadog-crud-api --replicas=6
```

Or edit `app-deployment.yaml` and change the `replicas` field.

### Resource Limits

Current resource settings per pod:

**Application:**
- Requests: 256Mi memory, 250m CPU
- Limits: 512Mi memory, 500m CPU

**Datadog Agent:**
- Requests: 256Mi memory, 200m CPU
- Limits: 512Mi memory, 500m CPU

Adjust these in the respective deployment files based on your needs.

## Monitoring

### View Logs

```bash
# Application logs
kubectl logs -l app=datadog-crud-api

# Datadog agent logs
kubectl logs -l app=datadog-agent

# Follow logs
kubectl logs -f -l app=datadog-crud-api
```

### Check Health

```bash
# Health check endpoint
curl http://localhost:30000/health

# Describe pod
kubectl describe pod <pod-name>
```

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl get pods

# Check events
kubectl get events --sort-by='.lastTimestamp'

# Describe failing pod
kubectl describe pod <pod-name>
```

### Image pull errors

If you see `ImagePullBackOff`:
```bash
# For local images, ensure imagePullPolicy is set to IfNotPresent or Never
# The current configuration uses IfNotPresent
```

### Datadog agent connection issues

```bash
# Check if Datadog agent is running
kubectl get pods -l app=datadog-agent

# Check Datadog agent logs
kubectl logs -l app=datadog-agent

# Verify API key is set correctly
kubectl get secret datadog-secret -o yaml
```

## Cleanup

To remove all resources:

```bash
kubectl delete -f k8s/
```

Or delete individually:

```bash
kubectl delete deployment datadog-crud-api
kubectl delete deployment datadog-agent
kubectl delete service datadog-crud-api
kubectl delete service datadog-agent
kubectl delete secret datadog-secret
```

## Additional Commands

```bash
# Port forward to a specific pod
kubectl port-forward deployment/datadog-crud-api 3000:3000

# Execute command in pod
kubectl exec -it <pod-name> -- sh

# View all resources
kubectl get all

# Restart deployment
kubectl rollout restart deployment/datadog-crud-api
```
