# AWS Deployment Guide

Deploy the Datadog Observability Playground to AWS ECS Fargate using AWS CDK.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js** 18+ and pnpm installed
4. **Docker** installed and running
5. **Datadog Account** and API key

## Architecture Overview

The deployment creates:
- **VPC**: Multi-AZ with public and private subnets
- **ECS Cluster**: Fargate cluster with Container Insights
- **ECS Service**: Application with Datadog agent sidecar and FireLens log router
- **FireLens Integration**: Fluent Bit log router for direct log forwarding to Datadog
- **Application Load Balancer**: Public-facing HTTP load balancer
- **ECR Repository**: Container image storage
- **CloudWatch Log Groups**: Logging for infrastructure components (FireLens, Datadog Agent)
- **Secrets Manager**: Secure Datadog API key storage
- **Auto Scaling**: CPU/memory-based scaling (1-4 tasks)

**Log Flow**:
- Application logs → FireLens (Fluent Bit) → Datadog Logs API (direct)
- Infrastructure logs (FireLens, Agent) → CloudWatch Log Groups
- APM traces → Datadog Agent → Datadog APM
- Metrics → Datadog Agent → Datadog Metrics

## Step 1: Configure AWS CLI

```bash
# Configure AWS credentials
aws configure

# Or configure a named profile
aws configure --profile myprofile

# Verify configuration
aws sts get-caller-identity

# List all configured profiles
aws configure list-profiles
```

### AWS Profile Management

The deployment script (`./scripts/deploy.sh`) intelligently handles AWS profile selection:

**Local/Interactive Mode** (default):
- Displays your current AWS profile and region
- Asks for confirmation before proceeding
- Simple numbered selection menus (just type a number)
  - Profile menu: Shows all configured AWS profiles
  - Region menu: Displays 14 common AWS regions with location names
- Perfect for laptop deployments where you might use multiple AWS accounts

**CI/CD Mode** (`cicd=true`):
- Uses current AWS credentials without prompting
- Displays configuration for logging purposes
- Fails fast if credentials are invalid
- Perfect for automated pipelines

**Examples**:
```bash
# Local deployment - interactive mode
./scripts/deploy.sh dev

# Example interaction:
# ❯ Use current profile and region? (y/n): n
#
# ℹ  Available AWS profiles:
#
# 1) default
# 2) staging
# 3) production
#
# ❯ Enter profile number: 2
# ✓ Selected profile: staging
#
# ℹ  Available AWS regions:
#
# 1)  ap-southeast-1 (Singapore)
# 2)  ap-southeast-2 (Sydney)
# 3)  ap-northeast-1 (Tokyo)
# ...
# 14) sa-east-1 (São Paulo)
#
# ❯ Enter region number (1-14): 1
# ✓ Selected region: ap-southeast-1

# CI/CD deployment - no interaction
./scripts/deploy.sh prod cicd=true
```

## Step 2: Bootstrap CDK

If this is your first time using CDK in this AWS account/region:

```bash
cd packages/cdk

# Bootstrap CDK
pnpm cdk bootstrap
```

## Step 3: Configure Datadog API Key

### Option A: Pass During Deployment (Quick)

```bash
pnpm cdk:deploy --context datadogApiKey=your-datadog-api-key
```

### Option B: Create Secret Manually (Recommended)

```bash
aws secretsmanager create-secret \
  --name datadog-api-key-dev \
  --secret-string "your-datadog-api-key" \
  --region us-east-1
```

Then deploy without the context parameter:
```bash
pnpm cdk:deploy
```

## Step 4: Deploy Infrastructure

### Preview Changes

```bash
# From repository root
pnpm cdk:diff

# Or from cdk directory
cd packages/cdk
pnpm diff
```

### Deploy

**From repository root**:
```bash
# Deploy to dev environment (default)
pnpm cdk:deploy

# Deploy with API key
pnpm cdk:deploy --context datadogApiKey=your-key

# Deploy to specific environment
pnpm cdk:deploy --context environment=staging
```

**From cdk directory**:
```bash
cd packages/cdk
pnpm deploy
```

### Deployment Output

After successful deployment, note these outputs:

```
Outputs:
DatadogAppStack-dev.LoadBalancerUrl = http://datadog-app-alb-dev-xxxxx.us-east-1.elb.amazonaws.com
DatadogAppStack-dev.EcrRepositoryUri = 123456789012.dkr.ecr.us-east-1.amazonaws.com/test-datadog-crud-api
DatadogAppStack-dev.ClusterName = datadog-test-cluster-dev
DatadogAppStack-dev.ServiceName = test-datadog-crud-api-service-dev
```

Save these values for the next steps.

## Step 5: Build and Push Docker Image

### Build Application Image

From repository root:

```bash
cd packages/app

# Build Docker image
docker build -t test-datadog-crud-api:latest .
```

### Login to ECR

Replace `<ECR_URI>` with your ECR repository URI from CDK outputs:

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ECR_URI>
```

Example:
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com
```

### Tag and Push Image

```bash
# Tag the image
docker tag test-datadog-crud-api:latest <ECR_URI>:latest

# Push to ECR
docker push <ECR_URI>:latest
```

Example:
```bash
docker tag test-datadog-crud-api:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/test-datadog-crud-api:latest

docker push \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/test-datadog-crud-api:latest
```

### Force ECS Deployment

After pushing the image, force ECS to deploy it:

```bash
aws ecs update-service \
  --cluster datadog-test-cluster-dev \
  --service test-datadog-crud-api-service-dev \
  --force-new-deployment \
  --region us-east-1
```

## Step 6: Verify Deployment

### Check Service Status

```bash
aws ecs describe-services \
  --cluster datadog-test-cluster-dev \
  --services test-datadog-crud-api-service-dev \
  --region us-east-1
```

Look for:
- `runningCount`: Should be 1 (or your desired count)
- `desiredCount`: Should match running count
- Health check status

### Check Running Tasks

```bash
aws ecs list-tasks \
  --cluster datadog-test-cluster-dev \
  --service-name test-datadog-crud-api-service-dev \
  --region us-east-1
```

### View Logs

**Application Logs**: Application logs are sent directly to Datadog via FireLens, so check Datadog Logs UI:
- Navigate to Datadog → Logs
- Filter by `service:test-datadog-crud-api env:dev`

**Infrastructure Component Logs** (FireLens, Datadog Agent):
```bash
# FireLens log router logs
aws logs tail /ecs/firelens-dev --follow

# Datadog agent logs
aws logs tail /ecs/datadog-agent-dev --follow
```

### Test the Application

Get the Load Balancer URL from CDK outputs:

```bash
# Health check
curl http://<ALB_URL>/health

# Get products
curl http://<ALB_URL>/api/products

# Test with scenario
curl http://<ALB_URL>/api/products?scenario=error
```

## Deployment Automation Script

Create a deployment script for easier updates:

**`deploy-to-aws.sh`**:
```bash
#!/bin/bash
set -e

# Configuration
REGION=${AWS_REGION:-us-east-1}
ENV=${ENVIRONMENT:-dev}
CLUSTER_NAME="datadog-test-cluster-${ENV}"
SERVICE_NAME="test-datadog-crud-api-service-${ENV}"

# Get ECR URI from CloudFormation outputs
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name DatadogAppStack-${ENV} \
  --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' \
  --output text \
  --region ${REGION})

echo "Building Docker image..."
cd packages/app
docker build -t test-datadog-crud-api:latest .

echo "Logging into ECR..."
aws ecr get-login-password --region ${REGION} | \
  docker login --username AWS --password-stdin ${ECR_URI}

echo "Tagging image..."
docker tag test-datadog-crud-api:latest ${ECR_URI}:latest

echo "Pushing to ECR..."
docker push ${ECR_URI}:latest

echo "Forcing ECS deployment..."
aws ecs update-service \
  --cluster ${CLUSTER_NAME} \
  --service ${SERVICE_NAME} \
  --force-new-deployment \
  --region ${REGION}

echo ""
echo "Deployment triggered successfully!"
echo "Monitor progress: https://console.aws.amazon.com/ecs"
```

Make executable and run:
```bash
chmod +x deploy-to-aws.sh
./deploy-to-aws.sh
```

## Environment Configuration

### Context Parameters

Customize deployment with CDK context:

```bash
pnpm cdk:deploy \
  --context environment=prod \
  --context datadogSite=datadoghq.eu \
  --context datadogApiKey=your-key
```

Available context:
- `environment`: Environment name (dev, staging, prod) - default: dev
- `datadogApiKey`: Your Datadog API key
- `datadogSite`: Datadog site (datadoghq.com, datadoghq.eu) - default: datadoghq.com

### Infrastructure Parameters

Edit `packages/cdk/bin/app.ts` to change:

```typescript
new DatadogAppStack(app, `DatadogAppStack-${environment}`, {
  environment: environment,
  datadogApiKey: datadogApiKey,
  datadogSite: datadogSite,

  // Customize these:
  desiredCount: 1,        // Number of tasks
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

Test auto-scaling by generating load (see [Testing Guide](./testing.md)).

## Monitoring Deployment

### In Datadog

After deployment, your service will appear in Datadog:

1. **APM → Services**: Service `test-datadog-crud-api` with env `dev`
2. **Infrastructure → ECS**: View ECS cluster, service, and tasks
3. **Logs**: Filter by `service:test-datadog-crud-api env:dev`
4. **Container Map**: Visualize your containers

### In AWS Console

- **ECS**: https://console.aws.amazon.com/ecs
- **CloudFormation**: https://console.aws.amazon.com/cloudformation
- **CloudWatch**: https://console.aws.amazon.com/cloudwatch
- **Load Balancers**: https://console.aws.amazon.com/ec2/v2/home#LoadBalancers

## Cost Estimates

Running this infrastructure on AWS:

- **ECS Fargate** (1 task, 0.25 vCPU, 0.5 GB): ~$15-30/month
- **Application Load Balancer**: ~$16/month
- **NAT Gateway**: ~$32/month
- **CloudWatch Logs** (7-day retention): Minimal
- **Data Transfer**: Varies by usage

**Estimated Total**: ~$60-80/month

To minimize costs:
- Use `dev` environment for learning
- Destroy when not in use: `pnpm cdk:destroy`
- Consider VPC endpoints to avoid NAT costs (production)

## Cleanup

### Destroy All Resources

**Warning**: This will delete all resources and data.

```bash
# From repository root
pnpm cdk:destroy

# Or from cdk directory
cd packages/cdk
pnpm destroy

# Confirm deletion when prompted
```

This will delete:
- ECS service and tasks
- Application Load Balancer
- VPC and networking
- CloudWatch log groups
- ECR repository and images
- Secrets Manager secret (if created by CDK)

## Troubleshooting Deployment

### Task Fails to Start

1. **Check task logs**:
   ```bash
   aws logs tail /ecs/test-datadog-crud-api-dev --follow
   ```

2. **Common issues**:
   - Missing Docker image in ECR
   - Incorrect Datadog API key
   - Network connectivity issues

### Health Check Failures

1. **Verify app is listening on port 3000**
2. **Check `/health` endpoint returns 200**
3. **Review security group rules**
4. **Check task logs for errors**

### No Data in Datadog

1. **Verify Datadog API key** in Secrets Manager
2. **Check agent logs**:
   ```bash
   aws logs tail /ecs/datadog-agent-dev --follow
   ```
3. **Ensure `DD_SITE` matches your Datadog region**

### Image Not Found

Make sure you've:
1. Built the Docker image
2. Logged into ECR
3. Tagged and pushed the image
4. Image tag matches task definition (`latest`)

## Security Best Practices

For production deployments:

1. **HTTPS**: Add ACM certificate and HTTPS listener
2. **Secrets Rotation**: Enable automatic API key rotation
3. **VPC Endpoints**: Add endpoints for ECR, CloudWatch (reduce NAT costs)
4. **IAM Policies**: Follow principle of least privilege
5. **WAF**: Add AWS WAF to protect ALB
6. **Logging**: Enable ALB access logs
7. **Retention**: Change `RemovalPolicy.DESTROY` to `RETAIN` for critical resources

## Multi-Environment Setup

Deploy to multiple environments:

```bash
# Development
pnpm cdk:deploy --context environment=dev

# Staging
pnpm cdk:deploy --context environment=staging

# Production
pnpm cdk:deploy --context environment=prod \
  --context datadogSite=datadoghq.com
```

Each environment gets isolated:
- Separate CloudFormation stacks
- Separate ECS clusters
- Separate log groups
- Separate Secrets Manager secrets

## CI/CD Integration

Integrate with CI/CD pipelines using the `cicd=true` parameter:

**GitHub Actions Example**:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build and deploy
        run: |
          ./scripts/deploy.sh dev cicd=true
        env:
          DATADOG_API_KEY: ${{ secrets.DATADOG_API_KEY }}
```

**GitLab CI Example**:
```yaml
deploy:
  stage: deploy
  image: node:18
  before_script:
    - apt-get update && apt-get install -y docker.io awscli
    - npm install -g pnpm
    - pnpm install
  script:
    - ./scripts/deploy.sh $CI_ENVIRONMENT_NAME cicd=true
  only:
    - main
  environment:
    name: production
```

**Key Points for CI/CD**:
- Always use `cicd=true` to skip interactive prompts
- Set AWS credentials via environment variables or CI/CD secrets
- The script will validate credentials and fail fast on errors
- All configuration is displayed in logs for debugging

## Deployment Script Features

### Interactive Menu System

The `deploy.sh` script provides a simple numbered menu interface for selecting AWS profiles and regions:

**Profile Selection:**
- Displays all configured AWS profiles from `~/.aws/config`
- Simple numbered list - just type a number (no typing profile names)
- Works with all Bash versions (compatible with macOS default Bash 3.2)

**Region Selection:**
- 14 commonly used AWS regions with friendly location names
- No need to memorize region codes
- Clear descriptions (e.g., "1) ap-southeast-1 (Singapore)")
- Just type a number from 1-14

**Supported Regions:**

| Region Code | Location | Best For |
|------------|----------|----------|
| `ap-southeast-1` | Singapore | Asia Pacific hub |
| `ap-southeast-2` | Sydney | Australia/NZ |
| `ap-northeast-1` | Tokyo | Japan |
| `ap-northeast-2` | Seoul | Korea |
| `ap-south-1` | Mumbai | India |
| `us-east-1` | N. Virginia | US East (primary) |
| `us-east-2` | Ohio | US East |
| `us-west-1` | N. California | US West |
| `us-west-2` | Oregon | US West (primary) |
| `eu-west-1` | Ireland | Europe (primary) |
| `eu-west-2` | London | UK |
| `eu-central-1` | Frankfurt | Central Europe |
| `ca-central-1` | Canada | Canada |
| `sa-east-1` | São Paulo | South America |

### Benefits

**For Local Development:**
- ✅ **Error-Free**: No typos - just select a number
- ✅ **Discoverable**: See all available profiles and regions
- ✅ **User-Friendly**: Region names with locations (not just codes)
- ✅ **Safe**: Confirms configuration before deployment
- ✅ **Fast**: Number selection vs typing full names

**For CI/CD:**
- ✅ **Non-Interactive**: Zero prompts with `cicd=true`
- ✅ **Fast Fail**: Quick credential validation
- ✅ **Logged**: Configuration visible in pipeline logs
- ✅ **Reliable**: Consistent behavior across runs

### Profile Detection Logic

The script detects AWS profile and region in this order:

1. **AWS_PROFILE** environment variable (highest priority)
2. Current profile from `aws configure list`
3. Falls back to `default` profile

Region detection:
1. **AWS_REGION** environment variable (highest priority)
2. Region configured for the selected profile
3. Falls back to `ap-southeast-1`

### Testing Modes

**Test Interactive Mode:**
```bash
# Test with current profile
./scripts/deploy.sh dev

# Test profile switching
./scripts/deploy.sh dev
# Choose 'n' and select from menu
```

**Test CI/CD Mode:**
```bash
# Test with specific profile
AWS_PROFILE=staging ./scripts/deploy.sh dev cicd=true

# Test with environment variables (like in pipelines)
AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=yyy AWS_REGION=us-east-1 ./scripts/deploy.sh prod cicd=true
```

### Backward Compatibility

The script is **fully backward compatible**:
- Default behavior is interactive mode (safe for manual use)
- Respects existing `AWS_PROFILE` and `AWS_REGION` environment variables
- No breaking changes to existing workflows
- Can still be used with profile set beforehand:
  ```bash
  export AWS_PROFILE=myprofile
  ./scripts/deploy.sh dev
  ```

## Next Steps

- [Monitoring Guide](./monitoring.md) - Monitor your deployed application
- [Testing Guide](./testing.md) - Test your deployment
- [Troubleshooting](./troubleshooting.md) - Common issues
- [Architecture](./architecture.md) - Understand the system design
