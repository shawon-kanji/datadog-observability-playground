#!/bin/bash

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Deploy to EKS ===${NC}\n"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Not connected to a Kubernetes cluster${NC}"
    echo -e "${YELLOW}Configure kubectl to connect to your EKS cluster:${NC}"
    echo -e "  aws eks update-kubeconfig --name your-cluster-name --region your-region"
    exit 1
fi

echo -e "${YELLOW}Connected to cluster:${NC}"
kubectl cluster-info | head -1

# Check if EBS CSI driver is installed
echo -e "\n${YELLOW}Checking for EBS CSI driver...${NC}"
if ! kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver 2>/dev/null | grep -q "Running"; then
    echo -e "${RED}⚠️  WARNING: EBS CSI driver not found or not running!${NC}"
    echo -e "${YELLOW}The MongoDB PersistentVolumeClaim will fail without the EBS CSI driver.${NC}"
    echo -e "${YELLOW}Please run the following command first:${NC}"
    echo -e "  ${BLUE}./setup-ebs-csi-driver.sh <cluster-name> <region>${NC}"
    echo -e "\n${YELLOW}Do you want to continue anyway? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ EBS CSI driver is running${NC}"
fi

# First, update the manifests with ECR registry
echo -e "\n${YELLOW}Step 1: Updating manifests with ECR registry...${NC}"
bash "${SCRIPT_DIR}/update-ecr-registry.sh"

MANIFEST_DIR="${SCRIPT_DIR}/generated"

# Check if generated directory exists
if [ ! -d "$MANIFEST_DIR" ]; then
    echo -e "${RED}Error: Generated manifests directory not found${NC}"
    exit 1
fi

# Create namespace if it doesn't exist
NAMESPACE="datadog-playground"
echo -e "\n${YELLOW}Step 2: Creating namespace (if not exists)...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Deploy in order: secrets -> storage -> database -> services -> frontend
echo -e "\n${YELLOW}Step 3: Deploying secrets...${NC}"
kubectl apply -f "${MANIFEST_DIR}/secrets.yaml" -n $NAMESPACE

echo -e "\n${YELLOW}Step 4: Deploying storage (PVC)...${NC}"
kubectl apply -f "${MANIFEST_DIR}/mongo-pvc.yaml" -n $NAMESPACE

echo -e "\n${YELLOW}Step 5: Deploying MongoDB...${NC}"
kubectl apply -f "${MANIFEST_DIR}/mongo-deployment.yaml" -n $NAMESPACE
kubectl apply -f "${MANIFEST_DIR}/mongo-service.yaml" -n $NAMESPACE

echo -e "\n${YELLOW}Waiting for MongoDB to be ready...${NC}"
kubectl wait --for=condition=available --timeout=120s deployment/mongo-deployment -n $NAMESPACE || true

echo -e "\n${YELLOW}Step 6: Deploying backend services...${NC}"
kubectl apply -f "${MANIFEST_DIR}/user-auth-deployment.yaml" -n $NAMESPACE
kubectl apply -f "${MANIFEST_DIR}/user-auth-service.yaml" -n $NAMESPACE

kubectl apply -f "${MANIFEST_DIR}/order-service-deployment.yaml" -n $NAMESPACE
kubectl apply -f "${MANIFEST_DIR}/order-service-svc-clusterip.yaml" -n $NAMESPACE

kubectl apply -f "${MANIFEST_DIR}/app-deployment.yaml" -n $NAMESPACE
kubectl apply -f "${MANIFEST_DIR}/app-svc.yaml" -n $NAMESPACE

echo -e "\n${YELLOW}Step 7: Deploying frontend...${NC}"
kubectl apply -f "${MANIFEST_DIR}/frontend-deployment.yaml" -n $NAMESPACE
kubectl apply -f "${MANIFEST_DIR}/frontend-service.yaml" -n $NAMESPACE

echo -e "\n${GREEN}=== Deployment initiated! ===${NC}"

echo -e "\n${YELLOW}Checking deployment status...${NC}"
sleep 5
kubectl get pods -n $NAMESPACE
kubectl get svc -n $NAMESPACE

echo -e "\n${BLUE}=== Useful commands ===${NC}"
echo -e "  Watch pods:           ${YELLOW}kubectl get pods -n $NAMESPACE -w${NC}"
echo -e "  Check logs:           ${YELLOW}kubectl logs -f deployment/dd-app-api -n $NAMESPACE${NC}"
echo -e "  Get services:         ${YELLOW}kubectl get svc -n $NAMESPACE${NC}"
echo -e "  Get LoadBalancer URLs:${YELLOW}kubectl get svc -n $NAMESPACE -o wide${NC}"
echo -e "  Port forward:         ${YELLOW}kubectl port-forward svc/frontend-service 8080:80 -n $NAMESPACE${NC}"
echo -e "  Delete all:           ${YELLOW}kubectl delete namespace $NAMESPACE${NC}"

echo -e "\n${GREEN}Waiting for LoadBalancer services to get external IPs...${NC}"
echo -e "${YELLOW}This may take a few minutes. Run this to check:${NC}"
echo -e "  kubectl get svc -n $NAMESPACE -w"
