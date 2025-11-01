# Infrastructure Package (AWS CDK)

AWS Cloud Development Kit (CDK) infrastructure code for deploying the Datadog Observability Playground to AWS ECS Fargate.

## Overview

This package contains Infrastructure as Code using AWS CDK (TypeScript) to deploy:

- **ECS Fargate cluster** with the application and Datadog agent
- **Application Load Balancer** for public access
- **VPC** with public and private subnets
- **ECR repository** for Docker images
- **FireLens log router** for direct log forwarding to Datadog
- **CloudWatch log groups** for infrastructure component logging
- **Secrets Manager** for secure Datadog API key storage
- **Auto-scaling** configuration (1-4 tasks based on CPU/memory)

## Quick Start

### Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured (`aws configure`)
- Node.js 18+ and pnpm installed
- Docker installed
- Datadog account and API key

### **IMPORTANT: Deployment Order**

⚠️ **Before deploying the full stack**, you must complete these steps in order:

#### Step 1: Create Datadog API Key Secret

Either pass the API key via context OR create the secret manually:

```bash
# Option 1: Pass via context when deploying (see below)
pnpm deploy --context datadogApiKey=your-datadog-api-key

# Option 2: Create secret manually (recommended for production)
aws secretsmanager create-secret \
  --name datadog-api-key-dev \
  --description "Datadog API Key for development environment" \
  --secret-string "your-datadog-api-key" \
  --region ap-southeast-1
```

#### Step 2: Deploy Infrastructure (Creates ECR Repository)

```bash
# From monorepo root
pnpm install

# Bootstrap CDK (first time only)
cd packages/cdk
pnpm cdk bootstrap

# Deploy infrastructure (this creates ECR but won't start ECS tasks yet)
pnpm deploy --context datadogApiKey=your-datadog-api-key

# The deployment will create the ECR repository but WILL FAIL on first run
# because no Docker image exists yet. This is expected!
```

#### Step 3: Build and Push Docker Image to ECR

**EASY WAY - Use the deployment script:**

```bash
# From repository root - this handles everything!
pnpm deploy
```

**MANUAL WAY:**

```bash
# Get ECR URI from CDK outputs
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name DatadogAppStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' \
  --output text)

# Build and push the application image
cd ../app
docker build -t test-datadog-crud-api:latest .

# Login to ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin $ECR_URI

# Tag and push
docker tag test-datadog-crud-api:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

#### Step 4: Re-deploy Stack (Now with Image Available)

```bash
# Now that the image exists, deploy again
cd ../cdk
pnpm deploy
```

## Deployment Scripts (Recommended)

We provide automated deployment scripts that handle building, pushing, and deploying in one command:

```bash
# Full deployment with validation
pnpm deploy              # Deploy to dev environment
pnpm deploy:prod         # Deploy to prod environment

# Quick deployment (faster, no wait)
pnpm deploy:quick

# Check deployment status
./scripts/status.sh dev

# Rollback to previous version
./scripts/rollback.sh dev <image-tag>
```

See [scripts/README.md](../../scripts/README.md) for detailed documentation.

**The stack now includes validation checks that will fail if:**
1. ❌ Datadog secret doesn't exist in Secrets Manager (when not provided via context)
2. ❌ ECR repository doesn't have a 'latest' tagged image

See **[Deployment Guide](../../docs/deployment.md)** for complete deployment instructions.

## Project Structure

```
packages/cdk/
├── bin/
│   └── app.ts                   # CDK app entry point
├── lib/
│   └── datadog-app-stack.ts     # Main infrastructure stack
├── cdk.json                     # CDK configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## Architecture

### AWS Resources Created

**Networking**:
- VPC with 2 Availability Zones
- Public subnets for ALB
- Private subnets for ECS tasks
- Internet Gateway and NAT Gateway
- Route tables

**Compute**:
- ECS Fargate cluster
- ECS service with task definition
- Application container (from ECR)
- Datadog agent sidecar container
- FireLens log router (Fluent Bit) for log forwarding
- Auto-scaling (1-4 tasks)

**Load Balancing**:
- Application Load Balancer (internet-facing)
- Target group (port 3000)
- Health check on `/health` endpoint

**Storage & Logging**:
- ECR repository for Docker images
- FireLens with Fluent Bit for direct log forwarding to Datadog
- CloudWatch log groups (7-day retention) for FireLens and infrastructure logs

**Security**:
- Secrets Manager for Datadog API key
- IAM roles for ECS task execution
- Security groups for ALB and ECS

See **[Architecture Guide](../../docs/architecture.md)** for detailed system design.

### Log Forwarding Architecture

**FireLens Integration**:

The stack uses AWS FireLens with Fluent Bit to forward application logs directly to Datadog, bypassing CloudWatch for application logs. This provides several benefits:

**Why FireLens?**
- **Direct Forwarding**: Logs go straight from the application to Datadog without intermediate storage
- **Lower Latency**: Reduced lag between log generation and availability in Datadog
- **Cost Optimization**: Reduces CloudWatch Logs ingestion and storage costs
- **Better Performance**: Dedicated log router container handles log processing
- **Native Datadog Support**: Fluent Bit has built-in Datadog output plugin

**Architecture**:
```
Application Container
  └─> stdout/stderr
      └─> FireLens (Fluent Bit)
          └─> Datadog Logs API (direct)

Infrastructure Components (FireLens, Datadog Agent)
  └─> CloudWatch Logs (for monitoring the monitoring!)
```

**What Goes Where**:
- **Application logs** → FireLens → Datadog (structured JSON with trace correlation)
- **FireLens logs** → CloudWatch (to monitor the log router itself)
- **Datadog Agent logs** → CloudWatch (to monitor the agent)
- **APM traces** → Datadog Agent → Datadog APM
- **Metrics** → Datadog Agent → Datadog Metrics

**FireLens Configuration** (`datadog-app-stack.ts:278-335`):
- Uses `amazon/aws-for-fluent-bit` image
- Configured with Datadog output plugin
- Automatic trace ID injection for log-trace correlation
- Secure API key handling via Secrets Manager

## Available Scripts

```bash
# Synthesize CloudFormation template
pnpm synth

# Show infrastructure differences
pnpm diff

# Deploy stack
pnpm deploy

# Destroy stack
pnpm destroy
```

## Deployment Process

### 1. Bootstrap CDK

First time only:

```bash
pnpm cdk bootstrap
```

### 2. Deploy Infrastructure

```bash
# From this directory
pnpm deploy --context datadogApiKey=your-key

# Or from repository root
pnpm cdk:deploy --context datadogApiKey=your-key

# Deploy to specific environment
pnpm deploy --context environment=staging
```

### 3. Build and Push Application

After infrastructure is deployed:

```bash
# Get ECR URI from CDK outputs
# Build Docker image
cd ../app
docker build -t test-datadog-crud-api:latest .

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ECR_URI>

# Tag and push
docker tag test-datadog-crud-api:latest <ECR_URI>:latest
docker push <ECR_URI>:latest
```

### 4. Force ECS Deployment

```bash
aws ecs update-service \
  --cluster datadog-test-cluster-dev \
  --service test-datadog-crud-api-service-dev \
  --force-new-deployment \
  --region us-east-1
```

See **[Deployment Guide](../../docs/deployment.md)** for detailed step-by-step instructions.

## Configuration

### Context Parameters

Customize deployment with CDK context:

```bash
pnpm deploy \
  --context environment=prod \
  --context datadogSite=datadoghq.eu \
  --context datadogApiKey=your-key
```

Available context parameters:
- `environment`: Environment name (dev, staging, prod) - default: dev
- `datadogApiKey`: Your Datadog API key
- `datadogSite`: Datadog site (datadoghq.com, datadoghq.eu) - default: datadoghq.com

### Infrastructure Parameters

Edit `bin/app.ts` to change:

```typescript
new DatadogAppStack(app, `DatadogAppStack-${environment}`, {
  environment: environment,
  datadogApiKey: datadogApiKey,
  datadogSite: datadogSite,

  // Customize these:
  desiredCount: 1,        // Number of ECS tasks
  cpu: 256,               // Task CPU (256, 512, 1024, 2048, 4096)
  memory: 512,            // Task memory in MB
});
```

## Auto Scaling

The deployment includes auto-scaling configuration:

- **Min Tasks**: 1
- **Max Tasks**: 4
- **CPU Target**: 70%
- **Memory Target**: 80%
- **Scale Out Cooldown**: 60 seconds
- **Scale In Cooldown**: 60 seconds

## Verification

### Check Service Status

```bash
aws ecs describe-services \
  --cluster datadog-test-cluster-dev \
  --services test-datadog-crud-api-service-dev \
  --region us-east-1
```

### View Logs

```bash
# Application logs
aws logs tail /ecs/test-datadog-crud-api-dev --follow

# Datadog agent logs
aws logs tail /ecs/datadog-agent-dev --follow
```

### Test Application

```bash
# Get ALB URL from CDK outputs
curl http://<ALB_URL>/health
curl http://<ALB_URL>/api/products
```

## Cost Estimates

Running this infrastructure on AWS:

- **ECS Fargate** (1 task, 0.25 vCPU, 0.5 GB): ~$15-30/month
- **Application Load Balancer**: ~$16/month
- **NAT Gateway**: ~$32/month
- **CloudWatch Logs** (7-day retention): Minimal
- **Data Transfer**: Varies by usage

**Estimated Total**: ~$60-80/month

**To avoid costs**: Run `pnpm destroy` when done.

## Cleanup

Destroy all resources:

```bash
# From this directory
pnpm destroy

# Or from repository root
pnpm cdk:destroy

# Confirm deletion when prompted
```

This will delete:
- ECS service and tasks
- Application Load Balancer
- VPC and all networking resources
- CloudWatch log groups
- ECR repository and images
- Secrets Manager secret (if created by CDK)

## Multi-Environment Deployment

Deploy to multiple environments:

```bash
# Development
pnpm deploy --context environment=dev

# Staging
pnpm deploy --context environment=staging

# Production
pnpm deploy --context environment=prod
```

Each environment gets:
- Separate CloudFormation stack
- Isolated ECS cluster
- Separate log groups
- Separate secrets

## CDK Commands

```bash
# Synthesize CloudFormation template
pnpm synth

# Show what will change
pnpm diff

# Deploy stack
pnpm deploy

# List all stacks
pnpm cdk list

# Destroy stack
pnpm destroy
```

## Troubleshooting

### ValidationError: Secret Not Found

**Error**: `Secrets Manager can't find the specified secret`

**Solution**: Create the secret before deploying:

```bash
aws secretsmanager create-secret \
  --name datadog-api-key-dev \
  --secret-string "your-datadog-api-key" \
  --region ap-southeast-1
```

Or pass the API key via context:

```bash
pnpm deploy -- --context datadogApiKey=your-key
```

### ValidationError: ECR Image Not Found

**Error**: `ImageNotFoundException` or `RepositoryNotFoundException`

**Solution**: Build and push your Docker image first:

```bash
# Get ECR URI from outputs
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name DatadogAppStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' \
  --output text)

# Build and push
cd packages/app
docker build -t test-datadog-crud-api:latest .
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin $ECR_URI
docker tag test-datadog-crud-api:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### ResourceInitializationError: Unable to Pull Secrets

**Error**: `execution resource retrieval failed: unable to retrieve secret from asm`

**Cause**: Task execution role doesn't have permission to read secrets

**Solution**: This is now fixed in the code. Redeploy the stack:

```bash
pnpm deploy
```

### Deploy Fails

Check CloudFormation events in AWS Console:
- https://console.aws.amazon.com/cloudformation

### Task Won't Start

```bash
# Check task logs
aws logs tail /ecs/test-datadog-crud-api-dev --follow
aws logs tail /ecs/datadog-agent-dev --follow

# Describe tasks
aws ecs describe-tasks \
  --cluster datadog-test-cluster-dev \
  --tasks <task-id>
```

### No Data in Datadog

1. Check Datadog API key in Secrets Manager
2. Verify `DD_SITE` matches your Datadog region
3. Check agent logs for connection errors

See **[Troubleshooting Guide](../../docs/troubleshooting.md)** for complete troubleshooting documentation.

## Security Best Practices

For production deployments, consider:

1. **HTTPS**: Add ACM certificate and HTTPS listener
2. **Secrets Rotation**: Enable automatic Datadog API key rotation
3. **VPC Endpoints**: Add VPC endpoints for ECR, CloudWatch to reduce NAT costs
4. **IAM Policies**: Follow principle of least privilege
5. **WAF**: Add AWS WAF to protect the ALB
6. **Logging**: Enable ALB access logs
7. **Retention**: Change `RemovalPolicy.DESTROY` to `RETAIN` for critical resources

## Learn More

- **[Deployment Guide](../../docs/deployment.md)** - Complete deployment instructions
- **[Architecture Guide](../../docs/architecture.md)** - System architecture
- **[Monitoring Guide](../../docs/monitoring.md)** - Monitor your deployment
- **[Main README](../../README.md)** - Monorepo overview
- **[AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)** - Official CDK docs

## License

MIT
