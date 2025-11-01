#!/bin/bash

# ========================================
# Docker Build & Push + CDK Deploy Script
# ========================================
# This script builds the Docker image, pushes to ECR, and deploys via CDK
# Usage: ./scripts/deploy.sh [environment] [cicd=true|false]
# Example: ./scripts/deploy.sh dev cicd=false
#          ./scripts/deploy.sh prod cicd=true

set -e  # Exit on any error

# ========================================
# Parse Arguments
# ========================================
ENVIRONMENT="${1:-dev}"
CICD_MODE="false"
ECR_REPOSITORY_NAME="test-datadog-crud-api"
APP_DIR="packages/app"

# Parse arguments for cicd parameter
for arg in "$@"; do
    case $arg in
        cicd=*)
            CICD_MODE="${arg#*=}"
            shift
            ;;
    esac
done

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
# Region Selection Function
# ========================================
select_region() {
    echo ""
    log_info "Available AWS regions:"
    echo ""

    # Common AWS regions with descriptions
    echo -e "  ${CYAN}1)${RESET}  ap-southeast-1 (Singapore)"
    echo -e "  ${CYAN}2)${RESET}  ap-southeast-2 (Sydney)"
    echo -e "  ${CYAN}3)${RESET}  ap-northeast-1 (Tokyo)"
    echo -e "  ${CYAN}4)${RESET}  ap-northeast-2 (Seoul)"
    echo -e "  ${CYAN}5)${RESET}  ap-south-1 (Mumbai)"
    echo -e "  ${CYAN}6)${RESET}  us-east-1 (N. Virginia)"
    echo -e "  ${CYAN}7)${RESET}  us-east-2 (Ohio)"
    echo -e "  ${CYAN}8)${RESET}  us-west-1 (N. California)"
    echo -e "  ${CYAN}9)${RESET}  us-west-2 (Oregon)"
    echo -e "  ${CYAN}10)${RESET} eu-west-1 (Ireland)"
    echo -e "  ${CYAN}11)${RESET} eu-west-2 (London)"
    echo -e "  ${CYAN}12)${RESET} eu-central-1 (Frankfurt)"
    echo -e "  ${CYAN}13)${RESET} ca-central-1 (Canada)"
    echo -e "  ${CYAN}14)${RESET} sa-east-1 (São Paulo)"

    echo ""
    read -p "$(echo -e "${YELLOW}❯${RESET} Enter region number (1-14): ")" REGION_NUMBER

    # Validate input is a number
    if ! [[ "$REGION_NUMBER" =~ ^[0-9]+$ ]]; then
        log_error "Invalid input. Please enter a number."
        exit 1
    fi

    # Map number to region code
    case $REGION_NUMBER in
        1) SELECTED_REGION="ap-southeast-1" ;;
        2) SELECTED_REGION="ap-southeast-2" ;;
        3) SELECTED_REGION="ap-northeast-1" ;;
        4) SELECTED_REGION="ap-northeast-2" ;;
        5) SELECTED_REGION="ap-south-1" ;;
        6) SELECTED_REGION="us-east-1" ;;
        7) SELECTED_REGION="us-east-2" ;;
        8) SELECTED_REGION="us-west-1" ;;
        9) SELECTED_REGION="us-west-2" ;;
        10) SELECTED_REGION="eu-west-1" ;;
        11) SELECTED_REGION="eu-west-2" ;;
        12) SELECTED_REGION="eu-central-1" ;;
        13) SELECTED_REGION="ca-central-1" ;;
        14) SELECTED_REGION="sa-east-1" ;;
        *)
            log_error "Invalid selection. Please choose a number between 1 and 14."
            exit 1
            ;;
    esac

    log_success "Selected region: ${BOLD}${SELECTED_REGION}${RESET}"
    echo "$SELECTED_REGION"
    return 0
}

# ========================================
# AWS Profile & Region Configuration
# ========================================
print_header "🚀 Datadog Observability Deployment"

# Get current AWS profile (or default)
CURRENT_PROFILE="${AWS_PROFILE:-$(aws configure list | grep profile | awk '{print $2}' || echo 'default')}"
CURRENT_REGION="${AWS_REGION:-$(aws configure get region --profile "$CURRENT_PROFILE" 2>/dev/null || echo 'ap-southeast-1')}"

if [ "$CICD_MODE" = "true" ]; then
    # CI/CD Mode: Display info only, no interaction
    log_info "Mode: ${BOLD}${BRIGHT_MAGENTA}CI/CD${RESET} (non-interactive)"
    log_info "AWS Profile: ${BOLD}${BRIGHT_CYAN}${CURRENT_PROFILE}${RESET}"
    log_info "AWS Region: ${BOLD}${BRIGHT_CYAN}${CURRENT_REGION}${RESET}"
    log_info "Environment: ${BOLD}${BRIGHT_CYAN}${ENVIRONMENT}${RESET}"

    # Verify credentials work
    if ! aws sts get-caller-identity --profile "$CURRENT_PROFILE" &>/dev/null; then
        log_error "AWS credentials validation failed for profile: $CURRENT_PROFILE"
        exit 1
    fi
    log_success "AWS credentials validated"

    # Set for rest of script
    export AWS_PROFILE="$CURRENT_PROFILE"
    export AWS_REGION="$CURRENT_REGION"
else
    # Local Mode: Interactive profile selection
    log_info "Mode: ${BOLD}${BRIGHT_MAGENTA}Local${RESET} (interactive)"
    echo ""
    log_info "Current AWS Profile: ${BOLD}${BRIGHT_CYAN}${CURRENT_PROFILE}${RESET}"
    log_info "Current AWS Region: ${BOLD}${BRIGHT_CYAN}${CURRENT_REGION}${RESET}"
    log_info "Target Environment: ${BOLD}${BRIGHT_CYAN}${ENVIRONMENT}${RESET}"
    echo ""

    # Ask for confirmation
    read -p "$(echo -e "${YELLOW}❯${RESET} Use current profile and region? (y/n): ")" -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        # User wants to change
        echo ""
        log_info "Available AWS profiles:"
        echo ""

        # Get profiles and display with numbers
        PROFILE_LIST=$(aws configure list-profiles 2>/dev/null)

        if [ -z "$PROFILE_LIST" ]; then
            log_error "No AWS profiles found. Run 'aws configure' to set one up."
            exit 1
        fi

        # Display profiles with numbers
        counter=1
        while IFS= read -r profile; do
            echo -e "  ${CYAN}${counter})${RESET} $profile"
            counter=$((counter + 1))
        done <<< "$PROFILE_LIST"

        echo ""
        read -p "$(echo -e "${YELLOW}❯${RESET} Enter profile number: ")" PROFILE_NUMBER

        # Validate input is a number
        if ! [[ "$PROFILE_NUMBER" =~ ^[0-9]+$ ]]; then
            log_error "Invalid input. Please enter a number."
            exit 1
        fi

        # Get the selected profile
        NEW_PROFILE=$(echo "$PROFILE_LIST" | sed -n "${PROFILE_NUMBER}p")

        if [ -z "$NEW_PROFILE" ]; then
            log_error "Invalid selection. Please choose a valid profile number."
            exit 1
        fi

        log_success "Selected profile: ${BOLD}${NEW_PROFILE}${RESET}"

        # Get region for the profile or ask
        PROFILE_REGION=$(aws configure get region --profile "$NEW_PROFILE" 2>/dev/null || echo "")

        echo ""
        if [ -n "$PROFILE_REGION" ]; then
            log_info "Profile '${NEW_PROFILE}' default region: ${BOLD}${PROFILE_REGION}${RESET}"
            read -p "$(echo -e "${YELLOW}❯${RESET} Keep this region? (y/n): ")" -n 1 -r
            echo ""

            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Keep the profile's region
                log_success "Using region: ${BOLD}${PROFILE_REGION}${RESET}"
            else
                # Show region selection menu
                PROFILE_REGION=$(select_region)
            fi
        else
            # No default region, show selection menu
            log_info "No default region configured for this profile"
            PROFILE_REGION=$(select_region)
        fi

        CURRENT_PROFILE="$NEW_PROFILE"
        CURRENT_REGION="$PROFILE_REGION"

        echo ""
        log_success "Profile set to: ${BOLD}${CURRENT_PROFILE}${RESET}"
        log_success "Region set to: ${BOLD}${CURRENT_REGION}${RESET}"
    fi

    # Set for rest of script
    export AWS_PROFILE="$CURRENT_PROFILE"
    export AWS_REGION="$CURRENT_REGION"

    # Verify credentials work
    echo ""
    log_progress "Validating AWS credentials..."
    if ! aws sts get-caller-identity --profile "$CURRENT_PROFILE" &>/dev/null; then
        log_error "AWS credentials validation failed for profile: $CURRENT_PROFILE"
        exit 1
    fi
    log_success "AWS credentials validated"
fi

print_separator

# ========================================
# Validation
# ========================================

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

# Get AWS Account ID (already validated above, just fetch)
print_step "Fetching AWS Account Information"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    log_error "Failed to get AWS account ID. Please check your AWS credentials."
    exit 1
fi
AWS_USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
log_success "AWS Account: ${BOLD}$AWS_ACCOUNT_ID${RESET}"
log_info "User/Role: ${DIM}$AWS_USER_ARN${RESET}"

# ========================================
# DEBUG MODE - Exit before deployment
# ========================================
echo ""
echo -e "${BRIGHT_GREEN}${BOLD}✓ Profile and region selection completed successfully!${RESET}"
echo ""
echo -e "${BRIGHT_CYAN}${BOLD}Configuration Summary:${RESET}"
echo -e "  ${DIM}AWS Profile:${RESET}  ${BRIGHT_CYAN}${BOLD}${AWS_PROFILE}${RESET}"
echo -e "  ${DIM}AWS Region:${RESET}   ${BRIGHT_CYAN}${BOLD}${AWS_REGION}${RESET}"
echo -e "  ${DIM}AWS Account:${RESET}  ${BRIGHT_CYAN}${BOLD}${AWS_ACCOUNT_ID}${RESET}"
echo -e "  ${DIM}User/Role:${RESET}    ${DIM}${AWS_USER_ARN}${RESET}"
echo -e "  ${DIM}Environment:${RESET}  ${BRIGHT_CYAN}${BOLD}${ENVIRONMENT}${RESET}"
echo ""
log_warning "DEBUG MODE: Exiting before actual deployment"
log_info "Comment out the exit statement in deploy.sh to enable full deployment"
echo ""
exit 0

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
echo -e "  ${DIM}AWS Profile:${RESET}          ${BRIGHT_CYAN}${BOLD}${AWS_PROFILE}${RESET}"
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
