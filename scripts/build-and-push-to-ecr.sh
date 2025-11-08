#!/bin/bash

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ECR Build and Push Script ===${NC}"

# Get AWS account information using STS
echo -e "${YELLOW}Fetching AWS account information...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Could not get AWS account ID. Make sure AWS CLI is configured.${NC}"
    exit 1
fi

echo -e "${GREEN}AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo -e "${GREEN}AWS Region: ${AWS_REGION}${NC}"

# Check if AWS profile is being used
AWS_PROFILE=$(aws configure get profile || echo "default")
echo -e "${GREEN}AWS Profile: ${AWS_PROFILE}${NC}"

# ECR registry URL
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Authenticate Docker to ECR
echo -e "${YELLOW}Authenticating Docker to ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Function to create ECR repository if it doesn't exist
create_ecr_repo_if_not_exists() {
    local repo_name=$1
    echo -e "${YELLOW}Checking if ECR repository '${repo_name}' exists...${NC}"

    if ! aws ecr describe-repositories --repository-names ${repo_name} --region ${AWS_REGION} > /dev/null 2>&1; then
        echo -e "${YELLOW}Creating ECR repository: ${repo_name}${NC}"
        aws ecr create-repository \
            --repository-name ${repo_name} \
            --region ${AWS_REGION} \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
        echo -e "${GREEN}Repository created successfully${NC}"
    else
        echo -e "${GREEN}Repository already exists${NC}"
    fi
}

# Function to build and push image
build_and_push() {
    local service_name=$1
    local context=$2
    local dockerfile=$3

    echo -e "\n${GREEN}=== Building and pushing ${service_name} ===${NC}"

    # Create ECR repository if needed
    create_ecr_repo_if_not_exists "datadog-playground/${service_name}"

    # Build image
    local image_tag="${ECR_REGISTRY}/datadog-playground/${service_name}:latest"
    local commit_tag="${ECR_REGISTRY}/datadog-playground/${service_name}:$(git rev-parse --short HEAD)"

    echo -e "${YELLOW}Building image for ${service_name}...${NC}"
    docker build -t ${image_tag} -t ${commit_tag} -f ${context}/${dockerfile} ${context}

    echo -e "${YELLOW}Pushing ${service_name} to ECR...${NC}"
    docker push ${image_tag}
    docker push ${commit_tag}

    echo -e "${GREEN}✓ ${service_name} pushed successfully${NC}"
    echo -e "  Latest: ${image_tag}"
    echo -e "  Commit: ${commit_tag}"
}

# Build and push all services (compatible with bash 3.2+)
build_and_push "frontend" "packages/frontend" "Dockerfile.eks"
build_and_push "app" "packages/app" "Dockerfile"
build_and_push "order-service" "packages/order-service" "Dockerfile"
build_and_push "user-service" "packages/user-service" "Dockerfile"

# Handle MongoDB - we'll create a custom MongoDB image with initialization scripts if needed
echo -e "\n${GREEN}=== MongoDB Image ===${NC}"
echo -e "${YELLOW}Note: MongoDB is using the official mongo:7 image.${NC}"
echo -e "${YELLOW}If you need a custom MongoDB image with init scripts, let me know.${NC}"

# Create ECR repo for MongoDB tracking (optional)
create_ecr_repo_if_not_exists "datadog-playground/mongodb"

# Tag and push the official MongoDB image to our ECR for consistency
echo -e "${YELLOW}Tagging and pushing official mongo:7 image to ECR...${NC}"
docker pull mongo:7
docker tag mongo:7 ${ECR_REGISTRY}/datadog-playground/mongodb:7
docker tag mongo:7 ${ECR_REGISTRY}/datadog-playground/mongodb:latest
docker push ${ECR_REGISTRY}/datadog-playground/mongodb:7
docker push ${ECR_REGISTRY}/datadog-playground/mongodb:latest
echo -e "${GREEN}✓ MongoDB image pushed successfully${NC}"

echo -e "\n${GREEN}=== All images built and pushed successfully! ===${NC}"
echo -e "${GREEN}ECR Registry: ${ECR_REGISTRY}${NC}"
echo -e "\n${YELLOW}Image URLs:${NC}"
echo -e "  Frontend:      ${ECR_REGISTRY}/datadog-playground/frontend:latest"
echo -e "  App:           ${ECR_REGISTRY}/datadog-playground/app:latest"
echo -e "  Order Service: ${ECR_REGISTRY}/datadog-playground/order-service:latest"
echo -e "  User Service:  ${ECR_REGISTRY}/datadog-playground/user-service:latest"
echo -e "  MongoDB:       ${ECR_REGISTRY}/datadog-playground/mongodb:latest"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Update your Kubernetes manifests to use these ECR images"
echo -e "  2. Make sure your Kubernetes cluster has permissions to pull from ECR"
echo -e "  3. Deploy using: kubectl apply -f k8/"
