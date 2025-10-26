# AWS CDK Infrastructure for Datadog Test Application

This CDK project defines the AWS infrastructure for deploying the Datadog test application on ECS Fargate with full observability.

## Architecture

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public and private subnets
- **ECS Cluster**: Fargate cluster with Container Insights enabled
- **ECS Service**: Fargate service running your application with Datadog agent sidecar
- **Application Load Balancer**: Public-facing ALB for HTTP traffic
- **ECR Repository**: Container registry for your application images
- **CloudWatch Log Groups**: Centralized logging for both app and Datadog agent
- **Secrets Manager**: Secure storage for Datadog API key
- **Auto Scaling**: CPU and memory-based auto scaling (1-4 tasks)
- **Security Groups**: Properly configured security groups for ALB and ECS service

## Prerequisites

1. **AWS CLI** configured with credentials
   ```bash
   aws configure
   ```

2. **Node.js** 18+ and npm installed

3. **AWS CDK CLI** installed globally
   ```bash
   npm install -g aws-cdk
   ```

4. **Datadog Account** and API key from https://app.datadoghq.com/

5. **Docker** installed (for building and pushing images)

## Setup

### 1. Install Dependencies

```bash
cd cdk
npm install
```

### 2. Bootstrap CDK (First Time Only)

If this is your first time using CDK in this AWS account/region:

```bash
cdk bootstrap
```

### 3. Configure Datadog API Key

You have two options:

#### Option A: Pass API Key During Deployment (Quick)
```bash
cdk deploy --context datadogApiKey=your-datadog-api-key
```

#### Option B: Create Secret Manually (Recommended)
```bash
aws secretsmanager create-secret \
  --name datadog-api-key-dev \
  --secret-string "your-datadog-api-key" \
  --region us-east-1
```

Then deploy without the API key parameter:
```bash
cdk deploy
```

## Deployment

### View Infrastructure Changes

Before deploying, review what will be created:

```bash
cdk diff
```

### Deploy Infrastructure

**Deploy to dev environment (default):**
```bash
cdk deploy
```

**Deploy to a specific environment:**
```bash
cdk deploy --context environment=staging
```

**Deploy with custom settings:**
```bash
cdk deploy \
  --context environment=prod \
  --context datadogSite=datadoghq.eu \
  --context datadogApiKey=your-key
```

### Deployment Output

After deployment, you'll see outputs like:
```
Outputs:
DatadogAppStack-dev.LoadBalancerUrl = http://datadog-app-alb-dev-xxxxx.us-east-1.elb.amazonaws.com
DatadogAppStack-dev.EcrRepositoryUri = 123456789012.dkr.ecr.us-east-1.amazonaws.com/test-datadog-crud-api
DatadogAppStack-dev.ClusterName = datadog-test-cluster-dev
DatadogAppStack-dev.ServiceName = test-datadog-crud-api-service-dev
```

## Build and Push Application

After infrastructure is deployed, build and push your application image:

### 1. Build Docker Image

From the project root (not the cdk folder):

```bash
cd ..
docker build -t test-datadog-crud-api:latest .
```

### 2. Login to ECR

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <YOUR_ECR_REPOSITORY_URI>
```

Example:
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com
```

### 3. Tag and Push Image

```bash
# Tag the image
docker tag test-datadog-crud-api:latest <YOUR_ECR_REPOSITORY_URI>:latest

# Push the image
docker push <YOUR_ECR_REPOSITORY_URI>:latest
```

Example:
```bash
docker tag test-datadog-crud-api:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/test-datadog-crud-api:latest

docker push \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/test-datadog-crud-api:latest
```

### 4. Force New Deployment

After pushing a new image, force ECS to deploy it:

```bash
aws ecs update-service \
  --cluster datadog-test-cluster-dev \
  --service test-datadog-crud-api-service-dev \
  --force-new-deployment \
  --region us-east-1
```

### All-in-One Script

Create a `deploy-app.sh` script in the project root:

```bash
#!/bin/bash
set -e

# Variables
REGION=${AWS_REGION:-us-east-1}
ENV=${ENVIRONMENT:-dev}
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name DatadogAppStack-${ENV} \
  --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' \
  --output text \
  --region ${REGION})

echo "Building Docker image..."
docker build -t test-datadog-crud-api:latest .

echo "Logging in to ECR..."
aws ecr get-login-password --region ${REGION} | \
  docker login --username AWS --password-stdin ${ECR_URI}

echo "Tagging image..."
docker tag test-datadog-crud-api:latest ${ECR_URI}:latest

echo "Pushing image to ECR..."
docker push ${ECR_URI}:latest

echo "Forcing new ECS deployment..."
aws ecs update-service \
  --cluster datadog-test-cluster-${ENV} \
  --service test-datadog-crud-api-service-${ENV} \
  --force-new-deployment \
  --region ${REGION}

echo "Deployment triggered! Monitor progress in AWS Console or CLI."
```

Make it executable and run:
```bash
chmod +x deploy-app.sh
./deploy-app.sh
```

## Verify Deployment

### Check Service Status

```bash
aws ecs describe-services \
  --cluster datadog-test-cluster-dev \
  --services test-datadog-crud-api-service-dev \
  --region us-east-1
```

### Check Running Tasks

```bash
aws ecs list-tasks \
  --cluster datadog-test-cluster-dev \
  --service-name test-datadog-crud-api-service-dev \
  --region us-east-1
```

### View Logs

**Application logs:**
```bash
aws logs tail /ecs/test-datadog-crud-api-dev --follow
```

**Datadog agent logs:**
```bash
aws logs tail /ecs/datadog-agent-dev --follow
```

### Test the Application

Get the Load Balancer URL from CDK outputs and test:

```bash
# Health check
curl http://<ALB_DNS_NAME>/health

# Get all products
curl http://<ALB_DNS_NAME>/api/products

# Test scenarios
curl http://<ALB_DNS_NAME>/api/products?scenario=error
curl http://<ALB_DNS_NAME>/api/products?scenario=long-latency
```

## CDK Commands

```bash
# Synthesize CloudFormation template
npm run synth

# Show difference between deployed and local
npm run diff

# Deploy stack
npm run deploy

# Destroy all resources (WARNING: Deletes everything!)
npm run destroy
```

## Environment Variables & Customization

You can customize the deployment using CDK context:

```bash
cdk deploy \
  --context environment=prod \
  --context datadogSite=datadoghq.eu \
  --context datadogApiKey=your-key
```

Available context parameters:
- `environment`: Environment name (dev, staging, prod) - default: dev
- `datadogApiKey`: Your Datadog API key
- `datadogSite`: Datadog site (datadoghq.com, datadoghq.eu, etc.) - default: datadoghq.com

Infrastructure parameters (edit `bin/app.ts` to change):
- `desiredCount`: Number of tasks (default: 1)
- `cpu`: Task CPU (default: 256)
- `memory`: Task memory in MB (default: 512)

## Monitoring in Datadog

After deployment, monitor your application in Datadog:

1. **APM & Services**: Navigate to APM → Services → `test-datadog-crud-api`
2. **Traces**: View distributed traces with full request flow
3. **Logs**: Filter by `service:test-datadog-crud-api`
4. **Infrastructure**: View ECS tasks and containers
5. **Container Map**: Visualize your container infrastructure

## Auto Scaling Configuration

The stack is configured with auto scaling:

- **Min Tasks**: 1
- **Max Tasks**: 4
- **CPU Target**: 70%
- **Memory Target**: 80%
- **Scale Out Cooldown**: 60 seconds
- **Scale In Cooldown**: 60 seconds

To test auto scaling, generate load on your application.

## Costs

This infrastructure will incur AWS costs:

- **ECS Fargate**: ~$15-30/month (1 task, 0.25 vCPU, 0.5 GB RAM)
- **Application Load Balancer**: ~$16/month
- **NAT Gateway**: ~$32/month
- **CloudWatch Logs**: Minimal (with 7-day retention)
- **Data Transfer**: Varies by usage

**Estimated monthly cost**: $60-80 for learning/development

## Cleanup

To delete all resources and stop incurring costs:

```bash
# Delete the stack
cdk destroy

# Confirm deletion
# Type 'y' when prompted
```

**Note**: ECR images are automatically deleted due to `autoDeleteImages: true` in the stack.

## Troubleshooting

### Task fails to start

Check the task logs:
```bash
aws logs tail /ecs/test-datadog-crud-api-dev --follow
aws logs tail /ecs/datadog-agent-dev --follow
```

### Health check failures

1. Verify application is listening on port 3000
2. Check `/health` endpoint returns 200
3. Ensure security groups allow ALB → ECS traffic

### No data in Datadog

1. Verify Datadog API key is correct in Secrets Manager
2. Check Datadog agent logs for connection issues
3. Ensure `DD_SITE` matches your Datadog account region

### Image not found

Make sure you've built and pushed the Docker image to ECR before deploying the service.

## Security Best Practices

For production deployments, consider:

1. **HTTPS**: Add ACM certificate and HTTPS listener to ALB
2. **Secrets Rotation**: Enable automatic rotation for Datadog API key
3. **VPC Endpoints**: Add VPC endpoints for ECR, CloudWatch to avoid NAT costs
4. **IAM Policies**: Review and minimize IAM permissions
5. **WAF**: Add AWS WAF to protect the ALB
6. **Remove Removal Policies**: Change `RemovalPolicy.DESTROY` to `RETAIN` for logs

## Project Structure

```
cdk/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   └── datadog-app-stack.ts # Main infrastructure stack
├── cdk.json                # CDK configuration
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
└── README.md               # This file
```

## Support

For issues related to:
- **AWS Infrastructure**: Check CloudFormation events in AWS Console
- **Datadog Integration**: Visit https://docs.datadoghq.com/
- **Application Code**: See main project README

## License

MIT
