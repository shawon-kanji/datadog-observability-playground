# EKS Deployment Configuration

This directory contains Kubernetes manifests optimized for AWS EKS deployment using ECR container images.

## Key Differences from Local k8 Setup

### Images
- **Local k8**: Uses local Docker images with `imagePullPolicy: Never`
- **EKS**: Uses ECR images with `imagePullPolicy: Always`

### Services
- **Local k8**: Uses NodePort services for external access
- **EKS**: Uses LoadBalancer services (creates AWS ELB/ALB)

### Storage
- **Local k8**: Uses default storage class
- **EKS**: Uses `gp3` storage class for better performance and cost

### Resources
- **EKS**: Includes resource requests and limits for better pod scheduling
- **EKS**: Includes liveness and readiness probes for health checks

### Replicas
- **EKS**: Services run with 2 replicas for high availability

### Environment
- **EKS**: Production environment settings
- **EKS**: Secrets managed via Kubernetes Secret objects

## Prerequisites

1. **AWS CLI configured**
   ```bash
   aws configure
   # Verify with:
   aws sts get-caller-identity
   ```

2. **EKS Cluster**
   ```bash
   # Create EKS cluster (if not exists)
   eksctl create cluster --name datadog-playground --region us-east-1

   # Configure kubectl
   aws eks update-kubeconfig --name datadog-playground --region us-east-1

   # Verify connection
   kubectl cluster-info
   ```

3. **ECR Images Built and Pushed**
   ```bash
   # From project root
   ./scripts/build-and-push-to-ecr.sh
   ```

4. **EKS Node IAM Role has ECR permissions**
   The EKS node IAM role needs the following policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ecr:GetAuthorizationToken",
           "ecr:BatchCheckLayerAvailability",
           "ecr:GetDownloadUrlForLayer",
           "ecr:BatchGetImage"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

## Deployment Steps

### Option 1: Automated Deployment (Recommended)

```bash
cd k8-eks
./deploy-to-eks.sh
```

This script will:
1. Update manifests with your ECR registry URL
2. Create namespace
3. Deploy secrets
4. Deploy MongoDB with persistent storage
5. Deploy backend services (user-auth, order-service, app)
6. Deploy frontend
7. Show deployment status

### Option 2: Manual Deployment

```bash
# 1. Update manifests with ECR registry
./update-ecr-registry.sh

# 2. Create namespace
kubectl create namespace datadog-playground

# 3. Deploy secrets (update JWT secret first!)
kubectl apply -f generated/secrets.yaml -n datadog-playground

# 4. Deploy storage
kubectl apply -f generated/mongo-pvc.yaml -n datadog-playground

# 5. Deploy MongoDB
kubectl apply -f generated/mongo-deployment.yaml -n datadog-playground
kubectl apply -f generated/mongo-service.yaml -n datadog-playground

# 6. Wait for MongoDB
kubectl wait --for=condition=available --timeout=120s deployment/mongo-deployment -n datadog-playground

# 7. Deploy services
kubectl apply -f generated/ -n datadog-playground
```

## Configuration

### Update JWT Secret (IMPORTANT!)

Before deploying to production, generate a secure JWT secret:

```bash
# Generate secure secret
JWT_SECRET=$(openssl rand -base64 32)

# Update the secret
kubectl create secret generic app-secrets \
  --from-literal=jwt-secret=$JWT_SECRET \
  --namespace=datadog-playground \
  --dry-run=client -o yaml | kubectl apply -f -
```

Or edit `secrets.yaml` before deploying:
```yaml
stringData:
  jwt-secret: "your-generated-secure-secret-here"
```

### Storage Class

The manifests use `gp3` storage class. If you need different storage:

1. Check available storage classes:
   ```bash
   kubectl get storageclass
   ```

2. Update `mongo-pvc.yaml`:
   ```yaml
   storageClassName: gp3  # Change to your preferred class
   ```

## Monitoring Deployment

```bash
# Watch pods
kubectl get pods -n datadog-playground -w

# Check services
kubectl get svc -n datadog-playground

# Get LoadBalancer URLs
kubectl get svc -n datadog-playground -o wide

# Check logs
kubectl logs -f deployment/dd-app-api -n datadog-playground
kubectl logs -f deployment/frontend -n datadog-playground
kubectl logs -f deployment/mongo-deployment -n datadog-playground

# Describe pod for troubleshooting
kubectl describe pod <pod-name> -n datadog-playground
```

## Accessing the Application

### Via LoadBalancer (Production)

```bash
# Get LoadBalancer URLs
kubectl get svc -n datadog-playground

# Look for EXTERNAL-IP column:
# - frontend-service: http://<EXTERNAL-IP>
# - dd-app-api-service: http://<EXTERNAL-IP>:3000
```

It may take 2-3 minutes for AWS to provision the LoadBalancer and assign external IPs.

### Via Port Forwarding (Testing)

```bash
# Frontend
kubectl port-forward svc/frontend-service 8080:80 -n datadog-playground

# API
kubectl port-forward svc/dd-app-api-service 3000:3000 -n datadog-playground

# Then access:
# - Frontend: http://localhost:8080
# - API: http://localhost:3000
```

## Scaling

```bash
# Scale deployments
kubectl scale deployment/dd-app-api --replicas=3 -n datadog-playground
kubectl scale deployment/frontend --replicas=4 -n datadog-playground

# Auto-scaling (HPA)
kubectl autoscale deployment dd-app-api \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n datadog-playground
```

## Cleanup

```bash
# Delete everything
kubectl delete namespace datadog-playground

# Or delete specific resources
kubectl delete -f generated/ -n datadog-playground
```

## Troubleshooting

### Pods stuck in ImagePullBackOff

1. Check ECR permissions:
   ```bash
   # Verify node IAM role has ECR permissions
   aws iam get-role --role-name <eks-node-role-name>
   ```

2. Verify images exist in ECR:
   ```bash
   aws ecr list-images --repository-name datadog-playground/app
   ```

3. Check pod events:
   ```bash
   kubectl describe pod <pod-name> -n datadog-playground
   ```

### LoadBalancer not getting external IP

1. Check AWS Load Balancer Controller is installed:
   ```bash
   kubectl get deployment -n kube-system aws-load-balancer-controller
   ```

2. If not installed, install it:
   ```bash
   eksctl utils associate-iam-oidc-provider --cluster=datadog-playground --approve
   # Follow AWS Load Balancer Controller installation guide
   ```

### MongoDB data persistence

The MongoDB uses a PersistentVolumeClaim backed by EBS. Data persists even if pods are deleted/recreated.

To verify:
```bash
kubectl get pvc -n datadog-playground
kubectl get pv
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  AWS LoadBalancer                    │
│                  (frontend-service)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Frontend Pods (x2)                      │
│         (React App - Static Files)                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                  AWS LoadBalancer                    │
│                (dd-app-api-service)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│           Product Service Pods (x2)                  │
│              (dd-app-api)                           │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────┐
│  User Auth Service   │   │   Order Service      │
│     (ClusterIP)      │   │    (ClusterIP)       │
│      Pods (x2)       │   │     Pods (x2)        │
└──────────┬───────────┘   └──────────┬───────────┘
           │                          │
           └──────────┬───────────────┘
                      ▼
           ┌──────────────────────┐
           │      MongoDB         │
           │    (ClusterIP)       │
           │  + EBS Volume (10Gi) │
           └──────────────────────┘
```

## Next Steps

1. **Setup Ingress**: Replace LoadBalancer with Ingress + ALB for better routing
2. **Add TLS**: Configure SSL/TLS certificates
3. **Monitoring**: Install Datadog agent for monitoring
4. **CI/CD**: Automate deployments with GitHub Actions or AWS CodePipeline
5. **Backups**: Setup automated MongoDB backups using EBS snapshots
