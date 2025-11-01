#!/bin/bash

# ========================================
# Docker Build & Push + CDK Deploy Script
# ========================================
# This script builds the Docker image, pushes to ECR, and deploys via CDK
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh dev

set -e  # Exit on any error

# ========================================
# Configuration
# ========================================
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
ECR_REPOSITORY_NAME="test-datadog-crud-api"
APP_DIR="packages/app"

# Modern color palette
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'

# Bright colors
BRIGHT_GREEN='\033[1;32m'
BRIGHT_BLUE='\033[1;34m'
BRIGHT_CYAN='\033[1;36m'
BRIGHT_MAGENTA='\033[1;35m'

# Background colors
BG_GREEN='\033[42m'
BG_BLUE='\033[44m'
BG_CYAN='\033[46m'

# ========================================
# Modern Helper Functions
# ========================================
print_header() {
    echo ""
    echo -e "${BRIGHT_CYAN}${BOLD}╔════════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${BRIGHT_CYAN}${BOLD}║${RESET}  $1"
    echo -e "${BRIGHT_CYAN}${BOLD}╚════════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
}

print_step() {
    echo -e "${BRIGHT_BLUE}${BOLD}▶${RESET} ${WHITE}$1${RESET}"
}

log_info() {
    echo -e "${CYAN}ℹ${RESET}  $1"
}

log_success() {
    echo -e "${BRIGHT_GREEN}✓${RESET}  ${GREEN}$1${RESET}"
}

log_warning() {
    echo -e "${YELLOW}⚠${RESET}  ${YELLOW}$1${RESET}"
}

log_error() {
    echo -e "${RED}✗${RESET}  ${RED}$1${RESET}"
}

log_progress() {
    echo -e "${BRIGHT_MAGENTA}⟳${RESET}  ${MAGENTA}$1${RESET}"
}

print_separator() {
    echo -e "${DIM}────────────────────────────────────────────────────────────────${RESET}"
}

print_box() {
    local color=$1
    local emoji=$2
    local title=$3
    local content=$4

    echo -e "${color}┌─ ${emoji}  ${BOLD}${title}${RESET}"
    echo -e "${DIM}│${RESET}  ${content}"
    echo -e "${color}└───────────────────────────────────────────────────────${RESET}"
}

# ========================================
# Validation
# ========================================
print_header "🚀 Datadog Observability Deployment"
log_info "Environment: ${BOLD}${BRIGHT_CYAN}${ENVIRONMENT}${RESET}"
log_info "Region: ${BOLD}${BRIGHT_CYAN}${AWS_REGION}${RESET}"
print_separator

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    log_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is not installed. Please install it first."
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    log_error "Application directory not found: $APP_DIR"
    exit 1
fi

# Get AWS Account ID
print_step "Validating AWS Credentials"
log_progress "Fetching AWS account information..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    log_error "Failed to get AWS account ID. Please check your AWS credentials."
    exit 1
fi
log_success "AWS Account: ${BOLD}$AWS_ACCOUNT_ID${RESET}"

# ========================================
# ECR Repository URI
# ========================================
ECR_REPOSITORY_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_NAME}"

# ========================================
# Build Application
# ========================================
echo ""
print_step "Building Application"
cd "$APP_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    log_progress "Installing dependencies..."
    pnpm install > /dev/null 2>&1
    log_success "Dependencies installed"
fi

# Build TypeScript
log_progress "Compiling TypeScript..."
pnpm run build > /dev/null 2>&1

cd ../..
log_success "Application built successfully"

# ========================================
# Docker Build
# ========================================
echo ""
print_step "Building Docker Image"
IMAGE_TAG="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"
log_info "Image tag: ${BOLD}${BRIGHT_CYAN}${IMAGE_TAG}${RESET}"

log_progress "Building multi-stage Docker image..."
docker build \
    -t "${ECR_REPOSITORY_NAME}:${IMAGE_TAG}" \
    -t "${ECR_REPOSITORY_NAME}:latest" \
    -f "${APP_DIR}/Dockerfile" \
    "${APP_DIR}" > /dev/null 2>&1

log_success "Docker image built: ${BOLD}${IMAGE_TAG}${RESET}"

# ========================================
# ECR Login
# ========================================
echo ""
print_step "Pushing to Amazon ECR"
log_progress "Authenticating with ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com" > /dev/null 2>&1
log_success "ECR authentication successful"

# ========================================
# Tag and Push to ECR
# ========================================
log_progress "Tagging images..."
docker tag "${ECR_REPOSITORY_NAME}:${IMAGE_TAG}" "${ECR_REPOSITORY_URI}:${IMAGE_TAG}"
docker tag "${ECR_REPOSITORY_NAME}:latest" "${ECR_REPOSITORY_URI}:latest"

log_progress "Pushing ${IMAGE_TAG} to ECR..."
docker push "${ECR_REPOSITORY_URI}:${IMAGE_TAG}" > /dev/null 2>&1
log_success "Pushed: ${IMAGE_TAG}"

log_progress "Pushing latest to ECR..."
docker push "${ECR_REPOSITORY_URI}:latest" > /dev/null 2>&1
log_success "Pushed: latest"

# ========================================
# Deploy CDK Stack
# ========================================
echo ""
print_step "Deploying Infrastructure with CDK"
log_progress "Running CDK deployment..."
pnpm --filter cdk run deploy

log_success "CDK stack deployed successfully"

# ========================================
# Get Load Balancer URL
# ========================================
echo ""
print_step "Retrieving Application URL"
log_progress "Fetching Load Balancer DNS..."
ALB_URL=$(aws cloudformation describe-stacks \
    --stack-name "DatadogAppStack-${ENVIRONMENT}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$ALB_URL" ]; then
    log_success "Application URL retrieved"
fi

# ========================================
# Summary
# ========================================
echo ""
echo ""
echo -e "${BG_GREEN}${BOLD}                                                                                                   ${RESET}"
echo -e "${BG_GREEN}${BOLD}  🎉  DEPLOYMENT COMPLETED SUCCESSFULLY!                                                           ${RESET}"
echo -e "${BG_GREEN}${BOLD}                                                                                                   ${RESET}"
echo ""
echo -e "${BRIGHT_CYAN}${BOLD}📊 DEPLOYMENT SUMMARY${RESET}"
echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${DIM}Environment:${RESET}          ${BRIGHT_CYAN}${BOLD}${ENVIRONMENT}${RESET}"
echo -e "  ${DIM}AWS Region:${RESET}           ${BRIGHT_CYAN}${BOLD}${AWS_REGION}${RESET}"
echo -e "  ${DIM}AWS Account:${RESET}          ${BRIGHT_CYAN}${BOLD}${AWS_ACCOUNT_ID}${RESET}"
echo -e "  ${DIM}Image Tag:${RESET}            ${BRIGHT_CYAN}${BOLD}${IMAGE_TAG}${RESET}"
echo ""
echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${DIM}ECR Repository:${RESET}"
echo -e "  ${BRIGHT_CYAN}${BOLD}${ECR_REPOSITORY_URI}${RESET}"
echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
if [ -n "$ALB_URL" ]; then
    echo -e "  ${DIM}Application URL:${RESET}"
    echo -e "  ${BRIGHT_GREEN}${BOLD}${ALB_URL}${RESET}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
fi
echo ""
echo -e "${BRIGHT_MAGENTA}${BOLD}🔗 QUICK LINKS${RESET}"
echo ""
echo -e "  ${CYAN}→${RESET} ${DIM}Test API:${RESET}"
echo -e "    ${WHITE}curl ${ALB_URL}/health${RESET}"
echo ""
echo -e "  ${CYAN}→${RESET} ${DIM}View Logs:${RESET}"
echo -e "    ${WHITE}aws logs tail /ecs/test-datadog-crud-api-${ENVIRONMENT} --follow --region ${AWS_REGION}${RESET}"
echo ""
echo -e "  ${CYAN}→${RESET} ${DIM}Datadog APM:${RESET}"
echo -e "    ${WHITE}https://ap2.datadoghq.com/apm/traces${RESET}"
echo ""
echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "${BRIGHT_BLUE}${BOLD}📝 USEFUL COMMANDS${RESET}"
echo ""
echo -e "  ${DIM}pnpm cdk:diff${RESET}         Preview infrastructure changes"
echo -e "  ${DIM}pnpm cdk:destroy${RESET}      Tear down the stack"
echo -e "  ${DIM}pnpm deploy${RESET}           Redeploy to dev environment"
echo ""
