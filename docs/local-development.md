# Local Development Guide

This guide covers different workflows for local development with the Datadog Observability Playground.

## Development Workflows

### Workflow 1: Docker Compose (Recommended for Learning)

**Best for**: Learning Datadog, consistent environment, minimal setup

**Pros**:
- Everything containerized
- Consistent across all systems
- Datadog agent pre-configured
- Easy cleanup

**Cons**:
- Slower restart times
- Requires Docker

**Setup**:

```bash
# Navigate to app directory
cd packages/app

# Set your Datadog API key
export DD_API_KEY=your-datadog-api-key

# Start everything
docker-compose up

# View logs
docker-compose logs -f app
docker-compose logs -f datadog-agent

# Stop everything
docker-compose down
```

### Workflow 2: pnpm Workspace Development

**Best for**: Active development, fast iterations, TypeScript development

**Pros**:
- Native execution (fast)
- Hot reload with nodemon
- Better debugging experience
- Works with pnpm workspace

**Cons**:
- Requires separate Datadog agent setup
- Manual environment configuration

**Setup from Repository Root**:

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Or run specific package
pnpm --filter app dev
```

**Setup from App Directory**:

```bash
cd packages/app

# Install dependencies (if not already done from root)
pnpm install

# Run development server
pnpm dev
```

### Workflow 3: Node.js + Dockerized Datadog Agent

**Best for**: Full observability with fast development cycle

**Pros**:
- Native app execution (fast restarts)
- Full Datadog integration
- Easier debugging than fully containerized

**Cons**:
- Requires Docker for agent
- Manual agent management

**Setup**:

```bash
# Terminal 1: Start Datadog agent
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -e DD_LOGS_ENABLED=true \
  -e DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true \
  -e DD_CONTAINER_EXCLUDE="name:datadog-agent" \
  -p 8126:8126 \
  -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Terminal 2: Run application from root
pnpm dev

# Check agent status
docker exec datadog-agent agent status

# Stop agent when done
docker stop datadog-agent
docker rm datadog-agent
```

### Workflow 4: Development Without Datadog

**Best for**: Pure API development, testing without observability overhead

**Setup**:

```bash
# From repository root
pnpm dev

# The app will work normally, but won't send data to Datadog
# Check logs for warnings about missing Datadog agent
```

## Available Commands

### From Repository Root

```bash
# Development
pnpm dev                    # Run app in development mode
pnpm build                  # Build application
pnpm start                  # Start production build

# Build all packages
pnpm build:all              # Build both app and CDK

# Infrastructure (CDK)
pnpm cdk:deploy             # Deploy to AWS
pnpm cdk:destroy            # Destroy AWS infrastructure
pnpm cdk:synth              # Synthesize CloudFormation
pnpm cdk:diff               # Show infrastructure changes

# Maintenance
pnpm clean                  # Clean build outputs
pnpm clean:all              # Clean everything including node_modules
```

### From packages/app Directory

```bash
# Development
pnpm dev                    # Run with nodemon and ts-node
pnpm dev:docker             # Run with Docker-specific settings

# Production
pnpm build                  # Compile TypeScript to JavaScript
pnpm start                  # Run compiled JavaScript
pnpm start:local            # Run with ts-node (no build needed)
```

### Using pnpm Filters

Run commands in specific packages:

```bash
# Application commands
pnpm --filter app dev
pnpm --filter app build
pnpm --filter app start

# CDK commands
pnpm --filter cdk deploy
pnpm --filter cdk destroy
pnpm --filter cdk synth
```

## Environment Variables

### Required Variables

Create a `.env` file in `packages/app/`:

```bash
# Application
PORT=3000
NODE_ENV=development

# Datadog
DD_SERVICE=test-datadog-crud-api
DD_ENV=local
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost          # Use 'datadog-agent' for Docker Compose
DD_TRACE_AGENT_PORT=8126
DD_LOGS_INJECTION=true
DD_RUNTIME_METRICS_ENABLED=true
DD_PROFILING_ENABLED=true
```

### Optional Variables

```bash
# Debug Datadog tracer
DD_TRACE_DEBUG=true

# Datadog site (for EU accounts)
DD_SITE=datadoghq.eu

# Custom service name
DD_SERVICE=my-custom-service-name
```

## Monorepo Structure

```
datadog-observability-playground/
├── packages/
│   ├── app/              # Application code
│   │   ├── src/          # TypeScript source files
│   │   ├── dist/         # Compiled JavaScript (after build)
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── package.json
│   └── cdk/              # AWS CDK infrastructure
│       ├── bin/
│       ├── lib/
│       └── package.json
├── docs/                 # Consolidated documentation
├── package.json          # Root package.json with workspace scripts
├── pnpm-workspace.yaml   # pnpm workspace configuration
└── pnpm-lock.yaml        # Dependency lock file
```

## Development Tips

### Hot Reload

The application uses `nodemon` for automatic reloading:

```bash
pnpm dev
# Edit any file in src/ and the server will restart automatically
```

### Debugging

**VS Code Launch Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug App",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Viewing Logs

**Docker Compose**:
```bash
# All logs
docker-compose -f packages/app/docker-compose.yml logs -f

# App only
docker-compose -f packages/app/docker-compose.yml logs -f app

# Datadog agent only
docker-compose -f packages/app/docker-compose.yml logs -f datadog-agent
```

**Local Node.js**:
```bash
# App logs appear in terminal
# Agent logs:
docker logs -f datadog-agent
```

### Clean Build

If you encounter build issues:

```bash
# From repository root
pnpm clean:all
pnpm install
pnpm build
```

## Working with pnpm Workspaces

### Benefits

- **Shared dependencies**: Install once, use everywhere
- **Fast**: Uses hard links and content-addressable storage
- **Atomic changes**: Update app and infrastructure together
- **Type safety**: Share TypeScript types between packages (future enhancement)

### Common pnpm Commands

```bash
# Install dependencies for all packages
pnpm install

# Add dependency to specific package
pnpm --filter app add express
pnpm --filter cdk add -D @types/node

# Remove dependency
pnpm --filter app remove express

# Update dependencies
pnpm update

# List all workspace packages
pnpm list --depth=0
```

## Docker Build and Testing

### Build Docker Image Locally

```bash
cd packages/app

# Build
docker build -t test-datadog-crud-api:latest .

# Run
docker run -d \
  -p 3000:3000 \
  -e DD_AGENT_HOST=host.docker.internal \
  -e DD_API_KEY=your-key \
  test-datadog-crud-api:latest

# Test
curl http://localhost:3000/api/products
```

## Next Steps

- [API Reference](./api-reference.md) - Learn about all available endpoints
- [Testing Guide](./testing.md) - Test different scenarios
- [Monitoring Guide](./monitoring.md) - Explore Datadog features
- [Deployment Guide](./deployment.md) - Deploy to AWS
