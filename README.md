# Datadog Learning Playground - Monorepo

> TypeScript REST API with full Datadog observability integration (APM, tracing, logging). Practice monitoring, error tracking, and performance analysis.

This is a pnpm monorepo containing:
- **Application**: TypeScript REST API with Datadog integration
- **Infrastructure**: AWS CDK code for ECS Fargate deployment

## 📦 Monorepo Structure

```
datadog-observability-playground/
├── packages/
│   ├── app/              # Application code
│   │   ├── src/          # TypeScript source files
│   │   ├── Dockerfile    # Docker configuration
│   │   └── README.md     # Detailed app documentation
│   └── cdk/              # AWS CDK infrastructure
│       ├── bin/          # CDK app entry point
│       ├── lib/          # CDK stacks
│       └── README.md     # CDK deployment guide
├── package.json          # Root monorepo configuration
├── pnpm-workspace.yaml   # pnpm workspace config
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **pnpm** 8+ installed (`npm install -g pnpm`)
- **Docker** (for containerized setup)
- **Datadog account** and API key

### Installation

```bash
# Install all dependencies for all packages
pnpm install
```

### Running the Application

```bash
# Run in development mode
pnpm dev

# Build the application
pnpm build

# Start production build
pnpm start

# Build all packages
pnpm build:all
```

## 📋 Available Commands

### Root Level (Monorepo)

```bash
# Application commands
pnpm dev                    # Run app in development mode
pnpm build                  # Build application
pnpm start                  # Start application
pnpm build:all              # Build all packages

# Infrastructure commands
pnpm cdk:deploy             # Deploy infrastructure to AWS
pnpm cdk:destroy            # Destroy AWS infrastructure
pnpm cdk:synth              # Synthesize CloudFormation template
pnpm cdk:diff               # Show infrastructure changes

# Maintenance
pnpm clean                  # Clean all build outputs
pnpm clean:all              # Clean all including node_modules
pnpm lint                   # Run linting (if configured)
pnpm test                   # Run tests (if configured)
```

### Package-Specific Commands

Run commands in specific packages using `--filter`:

```bash
# Application
pnpm --filter app dev
pnpm --filter app build
pnpm --filter app start

# CDK
pnpm --filter cdk deploy
pnpm --filter cdk destroy
pnpm --filter cdk synth
```

## 🏗️ Packages

### 1. Application (`packages/app`)

TypeScript REST API with Datadog integration featuring:
- CRUD operations for products
- Scenario simulation (errors, latency, timeouts)
- Full Datadog APM, tracing, and logging
- Docker and docker-compose setup

**[View detailed app documentation →](packages/app/README.md)**

### 2. Infrastructure (`packages/cdk`)

AWS CDK infrastructure as code including:
- VPC with public/private subnets
- ECS Fargate cluster and service
- Application Load Balancer
- ECR repository
- CloudWatch log groups
- Secrets Manager for Datadog API key
- Auto-scaling configuration

**[View CDK deployment guide →](packages/cdk/README.md)**

## 🎯 Development Workflow

### Local Development

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Run locally with Docker Compose** (easiest):
   ```bash
   cd packages/app
   export DD_API_KEY=your-datadog-api-key
   docker-compose up
   ```

3. **Or run with local Node.js**:
   ```bash
   # Start Datadog agent in Docker
   cd packages/app
   docker run -d --name datadog-agent \
     -e DD_API_KEY=your-key \
     -e DD_SITE=datadoghq.com \
     -e DD_APM_ENABLED=true \
     -e DD_APM_NON_LOCAL_TRAFFIC=true \
     -p 8126:8126 -p 8125:8125/udp \
     gcr.io/datadoghq/agent:latest

   # Run app
   cd ../..
   pnpm dev
   ```

### AWS Deployment

1. **Configure AWS credentials**:
   ```bash
   aws configure
   ```

2. **Bootstrap CDK** (first time only):
   ```bash
   cd packages/cdk
   pnpm cdk bootstrap
   ```

3. **Deploy infrastructure**:
   ```bash
   pnpm cdk:deploy --context datadogApiKey=your-key
   ```

4. **Build and push Docker image**:
   ```bash
   cd packages/app

   # Build
   docker build -t test-datadog-crud-api:latest .

   # Login to ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin <ECR_URI>

   # Tag and push
   docker tag test-datadog-crud-api:latest <ECR_URI>:latest
   docker push <ECR_URI>:latest

   # Force new deployment
   aws ecs update-service \
     --cluster datadog-test-cluster-dev \
     --service test-datadog-crud-api-service-dev \
     --force-new-deployment
   ```

See detailed deployment instructions in [packages/cdk/README.md](packages/cdk/README.md).

## 🧪 Testing Datadog Features

Once the application is running, test different scenarios:

```bash
# Normal request
curl http://localhost:3000/api/products

# Trigger client error (400)
curl http://localhost:3000/api/products?scenario=error

# Trigger server error (500)
curl http://localhost:3000/api/products?scenario=internal-error

# Test latency (5 seconds)
curl http://localhost:3000/api/products?scenario=long-latency

# Random latency (100ms-3s)
curl http://localhost:3000/api/products?scenario=random-latency

# Timeout test (30 seconds)
curl http://localhost:3000/api/products?scenario=timeout
```

## 📊 Monitoring in Datadog

After deployment, explore these Datadog features:

1. **APM → Services**: View `test-datadog-crud-api` metrics
2. **Traces**: See distributed traces with request flow
3. **Logs**: Filter by `service:test-datadog-crud-api`
4. **Infrastructure**: Monitor ECS tasks and containers
5. **Profiling**: Analyze CPU and memory usage

## 🛠️ Why pnpm Monorepo?

Benefits of this monorepo structure:

- **Shared dependencies**: Install once, use everywhere
- **Atomic changes**: Update app and infrastructure together
- **Fast**: pnpm uses hard links and content-addressable storage
- **Type safety**: Share types between packages (future)
- **Easy management**: Single command to build/test everything
- **Workspace protocol**: Link packages without publishing

## 📚 Additional Documentation

- **Application Details**: See [packages/app/README.md](packages/app/README.md)
  - API endpoints
  - Scenario simulation
  - Local setup options
  - Troubleshooting

- **Infrastructure Guide**: See [packages/cdk/README.md](packages/cdk/README.md)
  - Architecture overview
  - Deployment steps
  - Cost estimates
  - Security best practices

- **Quick Reference**: See [packages/app/QUICK_REFERENCE.md](packages/app/QUICK_REFERENCE.md)
- **Getting Started**: See [packages/app/GETTING_STARTED.md](packages/app/GETTING_STARTED.md)

## 🔧 Troubleshooting

### pnpm not installed
```bash
npm install -g pnpm
```

### Clean and reinstall
```bash
pnpm clean:all
pnpm install
```

### Datadog agent not receiving data
Check the agent logs:
```bash
# Docker Compose
docker-compose -f packages/app/docker-compose.yml logs datadog-agent

# Docker
docker logs datadog-agent

# ECS
aws logs tail /ecs/datadog-agent-dev --follow
```

### Port already in use
Stop existing containers:
```bash
docker-compose -f packages/app/docker-compose.yml down
```

## 💰 AWS Cost Estimate

Running the infrastructure on AWS:
- **ECS Fargate**: ~$15-30/month (1 task)
- **Application Load Balancer**: ~$16/month
- **NAT Gateway**: ~$32/month
- **CloudWatch Logs**: Minimal
- **Total**: ~$60-80/month for learning

**To avoid costs**: Run `pnpm cdk:destroy` when done.

## 📝 Project Goals

This project is for **learning and practicing**:
- Datadog APM and observability
- Distributed tracing
- Log correlation
- Error monitoring
- Performance profiling
- AWS ECS/Fargate deployment
- Infrastructure as Code (CDK)
- Monorepo management with pnpm

## 🤝 Contributing

Feel free to experiment, break things, and learn! This is a practice project.

## 📄 License

MIT

---

**Need help?** Check the detailed READMEs in each package or visit [Datadog Documentation](https://docs.datadoghq.com/).
