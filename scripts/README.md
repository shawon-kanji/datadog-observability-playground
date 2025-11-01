# Deployment Scripts

Automated scripts for building, pushing, and deploying the Datadog Observability Playground to AWS.

## Quick Start

### Local Development (Interactive Mode)
```bash
# Interactive - shows menus for profile/region selection
./scripts/deploy.sh dev
```

### CI/CD Pipeline (Non-Interactive Mode)
```bash
# Non-interactive - uses current credentials
./scripts/deploy.sh prod cicd=true
```

## Main Script: `deploy.sh`

### Usage
```bash
./scripts/deploy.sh [environment] [cicd=true|false]
```

### Arguments
- **environment** (optional): Target environment - `dev`, `staging`, or `prod` (default: `dev`)
- **cicd** (optional): CI/CD mode - `true` or `false` (default: `false`)

### Modes

#### Local Mode (Interactive)
**When to use:** Local development, laptop deployments, manual testing

**What it does:**
1. Shows current AWS profile and region
2. Asks: "Use current profile and region? (y/n)"
3. If `n`, shows interactive menus:
   - **Profile menu**: All configured AWS profiles
   - **Region menu**: 14 common AWS regions with locations
4. Validates credentials
5. Proceeds with deployment

**Example:**
```bash
./scripts/deploy.sh dev
# or
./scripts/deploy.sh staging cicd=false
```

**Interactive Experience:**
```
╔════════════════════════════════════════════════════════════════╗
║  🚀 Datadog Observability Deployment
╚════════════════════════════════════════════════════════════════╝

ℹ  Mode: Local (interactive)

ℹ  Current AWS Profile: default
ℹ  Current AWS Region: ap-southeast-1
ℹ  Target Environment: dev

❯ Use current profile and region? (y/n): n

ℹ  Available AWS profiles:

1) default
2) staging
3) production

❯ Enter profile number: 2
✓ Selected profile: staging

ℹ  Profile 'staging' default region: us-east-1
❯ Keep this region? (y/n): n

ℹ  Available AWS regions:

1)  ap-southeast-1 (Singapore)
2)  ap-southeast-2 (Sydney)
3)  ap-northeast-1 (Tokyo)
4)  ap-northeast-2 (Seoul)
5)  ap-south-1 (Mumbai)
6)  us-east-1 (N. Virginia)
7)  us-east-2 (Ohio)
8)  us-west-1 (N. California)
9)  us-west-2 (Oregon)
10) eu-west-1 (Ireland)
11) eu-west-2 (London)
12) eu-central-1 (Frankfurt)
13) ca-central-1 (Canada)
14) sa-east-1 (São Paulo)

❯ Enter region number (1-14): 1
✓ Selected region: ap-southeast-1
```

#### CI/CD Mode (Non-Interactive)
**When to use:** GitHub Actions, GitLab CI, Jenkins, automated pipelines

**What it does:**
1. Uses current AWS credentials (from environment variables or config)
2. Displays profile and region for logging
3. Validates credentials (fails fast if invalid)
4. Proceeds without any prompts

**Example:**
```bash
./scripts/deploy.sh prod cicd=true
```

**CI/CD Output:**
```
╔════════════════════════════════════════════════════════════════╗
║  🚀 Datadog Observability Deployment
╚════════════════════════════════════════════════════════════════╝

ℹ  Mode: CI/CD (non-interactive)
ℹ  AWS Profile: default
ℹ  AWS Region: us-east-1
ℹ  Environment: prod
✓  AWS credentials validated
```

## What the Script Does

The deployment script performs these steps automatically:

1. **Validates Prerequisites**
   - Checks AWS CLI installation
   - Checks Docker is running
   - Checks pnpm is installed
   - Validates AWS credentials

2. **Builds Application**
   - Installs dependencies (if needed)
   - Compiles TypeScript
   - Creates production build

3. **Builds Docker Image**
   - Multi-stage Docker build
   - Tags with timestamp and git commit
   - Tags as `latest`

4. **Pushes to ECR**
   - Authenticates with Amazon ECR
   - Pushes both versioned and latest tags

5. **Deploys Infrastructure**
   - Runs AWS CDK deployment
   - Updates ECS service with new image
   - Waits for deployment to complete

6. **Displays Summary**
   - Shows deployment URL
   - Provides useful commands
   - Displays next steps

## CI/CD Integration Examples

### GitHub Actions
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

      - name: Deploy
        run: ./scripts/deploy.sh prod cicd=true
```

### GitLab CI
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

### Jenkins
```groovy
pipeline {
    agent any

    environment {
        AWS_REGION = 'ap-southeast-1'
    }

    stages {
        stage('Deploy') {
            steps {
                sh './scripts/deploy.sh prod cicd=true'
            }
        }
    }
}
```

## Environment Variables

The script respects these environment variables:

- `AWS_PROFILE`: AWS profile to use (can be overridden interactively in local mode)
- `AWS_REGION`: AWS region to use (can be overridden interactively in local mode)
- `AWS_ACCESS_KEY_ID`: AWS access key (typically used in CI/CD)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key (typically used in CI/CD)

## Available AWS Regions

The script provides 14 commonly used regions:

| Region | Location | Best For |
|--------|----------|----------|
| ap-southeast-1 | Singapore | Asia Pacific applications |
| ap-southeast-2 | Sydney | Australia/New Zealand |
| ap-northeast-1 | Tokyo | Japan |
| ap-northeast-2 | Seoul | South Korea |
| ap-south-1 | Mumbai | India |
| us-east-1 | N. Virginia | US East Coast (most services) |
| us-east-2 | Ohio | US East Coast |
| us-west-1 | N. California | US West Coast |
| us-west-2 | Oregon | US West Coast (many services) |
| eu-west-1 | Ireland | Europe (most services) |
| eu-west-2 | London | United Kingdom |
| eu-central-1 | Frankfurt | Central Europe |
| ca-central-1 | Canada | Canadian compliance |
| sa-east-1 | São Paulo | South America |

## Troubleshooting

### "AWS CLI is not installed"
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### "Docker is not running"
```bash
# Start Docker Desktop or Docker daemon
sudo systemctl start docker  # Linux
# or open Docker Desktop manually
```

### "No AWS profiles found"
```bash
# Configure AWS CLI
aws configure

# Or configure with a profile name
aws configure --profile myprofile
```

### "AWS credentials validation failed"
```bash
# Check your AWS credentials
aws sts get-caller-identity

# Verify your profile
aws configure list --profile yourprofile

# Check if credentials are expired (for SSO)
aws sso login --profile yourprofile
```

## Tips

### Multiple AWS Accounts
If you work with multiple AWS accounts, configure named profiles:

```bash
# Personal account
aws configure --profile personal

# Work staging account
aws configure --profile work-staging

# Work production account
aws configure --profile work-production
```

Then use the interactive menu to select the right profile.

### Speeding Up Deployments
The script builds and pushes on every run. To skip unnecessary builds:

1. Check what changed: `git diff`
2. If only infrastructure changed, manually run CDK: `pnpm cdk:deploy`
3. If only code changed, manually push image and force ECS update

### Dry Run
To see what would be deployed without actually deploying:
```bash
pnpm cdk:diff
```

## Related Documentation

- [Main Deployment Guide](../docs/deployment.md)
- [CDK Package README](../packages/cdk/README.md)
- [Architecture Documentation](../docs/architecture.md)
- [Troubleshooting Guide](../docs/troubleshooting.md)

## License

MIT
