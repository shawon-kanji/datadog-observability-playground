#!/bin/bash

# ECS Deployment Script for Datadog CRUD API
# This script builds, tags, pushes the Docker image and updates the ECS service

set -e

# Configuration
AWS_REGION="us-east-1"
ECR_REPO_NAME="test-datadog-crud-api"
ECS_CLUSTER="datadog-test-cluster"
ECS_SERVICE="test-datadog-crud-api-service"
TASK_FAMILY="test-datadog-crud-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ECS deployment process...${NC}\n"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${YELLOW}AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"

# Construct ECR repository URI
ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"
echo -e "${YELLOW}ECR Repository: ${ECR_REPO_URI}${NC}\n"

# Authenticate Docker to ECR
echo -e "${GREEN}Step 1: Authenticating Docker to ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO_URI}

# Build Docker image
echo -e "\n${GREEN}Step 2: Building Docker image...${NC}"
docker build -t ${ECR_REPO_NAME}:latest .

# Tag Docker image
echo -e "\n${GREEN}Step 3: Tagging Docker image...${NC}"
docker tag ${ECR_REPO_NAME}:latest ${ECR_REPO_URI}:latest
docker tag ${ECR_REPO_NAME}:latest ${ECR_REPO_URI}:$(git rev-parse --short HEAD)

# Push Docker image to ECR
echo -e "\n${GREEN}Step 4: Pushing Docker image to ECR...${NC}"
docker push ${ECR_REPO_URI}:latest
docker push ${ECR_REPO_URI}:$(git rev-parse --short HEAD)

# Update task definition with new image URI
echo -e "\n${GREEN}Step 5: Updating ECS task definition...${NC}"
sed "s|YOUR_ECR_REPO_URI|${ECR_REPO_URI}|g" ecs-task-definition.json > ecs-task-definition-updated.json
sed -i.bak "s|YOUR_ACCOUNT_ID|${AWS_ACCOUNT_ID}|g" ecs-task-definition-updated.json

# Register new task definition
TASK_DEFINITION=$(aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition-updated.json \
  --region ${AWS_REGION} \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo -e "${YELLOW}New task definition: ${TASK_DEFINITION}${NC}"

# Update ECS service with new task definition
echo -e "\n${GREEN}Step 6: Updating ECS service...${NC}"
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --task-definition ${TASK_DEFINITION} \
  --region ${AWS_REGION} \
  --force-new-deployment

echo -e "\n${GREEN}Deployment initiated successfully!${NC}"
echo -e "${YELLOW}Monitor deployment status with:${NC}"
echo -e "aws ecs describe-services --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE} --region ${AWS_REGION}\n"

# Clean up
rm ecs-task-definition-updated.json
rm ecs-task-definition-updated.json.bak 2>/dev/null || true

echo -e "${GREEN}Done!${NC}"
