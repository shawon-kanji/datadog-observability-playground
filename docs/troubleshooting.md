# Troubleshooting Guide

Common issues and solutions for the Datadog Observability Playground.

## Table of Contents

- [Local Development Issues](#local-development-issues)
- [Datadog Integration Issues](#datadog-integration-issues)
- [Docker Issues](#docker-issues)
- [Build and Dependency Issues](#build-and-dependency-issues)
- [AWS Deployment Issues](#aws-deployment-issues)
- [Performance Issues](#performance-issues)

## Local Development Issues

### Port 3000 Already in Use

**Symptoms**: Error when starting the application: `EADDRINUSE: address already in use :::3000`

**Solution**:

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
export PORT=3001
pnpm dev
```

### Application Won't Start

**Symptoms**: Application crashes on startup

**Solutions**:

1. **Check Node.js version**:
   ```bash
   node --version
   # Should be 18 or higher
   ```

2. **Reinstall dependencies**:
   ```bash
   pnpm clean:all
   pnpm install
   ```

3. **Check for TypeScript errors**:
   ```bash
   cd packages/app
   pnpm build
   ```

4. **Review logs for specific error messages**

### pnpm Commands Not Working

**Symptoms**: `pnpm: command not found`

**Solution**:

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

### Workspace Package Not Found

**Symptoms**: `ERR_PNPM_NO_MATCHING_VERSION  No matching version found for @workspace/app`

**Solutions**:

1. **Check workspace configuration**:
   ```bash
   # Verify pnpm-workspace.yaml exists in root
   cat pnpm-workspace.yaml
   ```

2. **Reinstall from root**:
   ```bash
   cd <repository-root>
   pnpm install
   ```

## Datadog Integration Issues

### No Data Appearing in Datadog

**Symptoms**: Application runs but no traces, logs, or metrics in Datadog

**Solutions**:

1. **Wait 1-2 minutes** - Data has latency

2. **Verify Datadog API key**:
   ```bash
   echo $DD_API_KEY
   # Should not be empty
   ```

3. **Check agent status**:
   ```bash
   # Docker Compose
   docker-compose -f packages/app/docker-compose.yml exec datadog-agent agent status

   # Standalone Docker
   docker exec datadog-agent agent status
   ```

4. **Look for "API Key: Valid"** in agent status

5. **Check agent connectivity**:
   ```bash
   # In agent status output, look for:
   # - API Key: Valid
   # - APM Agent: Running
   # - Logs Agent: Running
   ```

### Connection Refused to Datadog Agent

**Symptoms**: `Error: connect ECONNREFUSED 127.0.0.1:8126`

**Solutions**:

1. **Verify agent is running**:
   ```bash
   # Docker Compose
   docker-compose -f packages/app/docker-compose.yml ps

   # Docker
   docker ps | grep datadog
   ```

2. **Check port is accessible**:
   ```bash
   nc -zv localhost 8126
   # Should show: Connection to localhost port 8126 [tcp/*] succeeded!
   ```

3. **Check DD_AGENT_HOST setting**:
   ```bash
   # For local Docker agent
   export DD_AGENT_HOST=localhost

   # For Docker Compose
   # In docker-compose.yml, it should be: DD_AGENT_HOST=datadog-agent
   ```

4. **Restart Datadog agent**:
   ```bash
   # Docker Compose
   docker-compose -f packages/app/docker-compose.yml restart datadog-agent

   # Docker
   docker restart datadog-agent
   ```

### No Traces in APM

**Symptoms**: Application logs show up, but no traces in APM

**Solutions**:

1. **Verify tracer initialization happens first**:
   - Check `packages/app/src/index.ts`
   - Tracer import should be BEFORE Express

2. **Enable tracer debug mode**:
   ```bash
   export DD_TRACE_DEBUG=true
   pnpm dev
   ```

3. **Check trace logs** for error messages

4. **Verify environment variables**:
   ```bash
   node -e "console.log(process.env.DD_AGENT_HOST, process.env.DD_TRACE_AGENT_PORT)"
   # Should show: localhost 8126
   ```

### Logs Missing Trace IDs

**Symptoms**: Logs appear but don't have `dd.trace_id`

**Solutions**:

1. **Check log injection is enabled**:
   ```bash
   # Should be set
   export DD_LOGS_INJECTION=true
   ```

2. **Verify logger configuration** in `packages/app/src/logger.ts`

3. **Ensure tracer loads before logger**

### Wrong Datadog Site

**Symptoms**: Data going to wrong Datadog region (US vs EU)

**Solution**:

```bash
# For EU accounts
export DD_SITE=datadoghq.eu

# For US accounts (default)
export DD_SITE=datadoghq.com

# For US3
export DD_SITE=us3.datadoghq.com

# For US5
export DD_SITE=us5.datadoghq.com
```

## Docker Issues

### Docker Compose Fails to Start

**Symptoms**: `docker-compose up` fails

**Solutions**:

1. **Check Docker is running**:
   ```bash
   docker --version
   docker ps
   ```

2. **Check docker-compose.yml syntax**:
   ```bash
   docker-compose -f packages/app/docker-compose.yml config
   ```

3. **Check for missing environment variables**:
   ```bash
   echo $DD_API_KEY
   ```

4. **View error logs**:
   ```bash
   docker-compose -f packages/app/docker-compose.yml logs
   ```

### Container Keeps Restarting

**Symptoms**: Container starts but immediately restarts

**Solutions**:

1. **Check container logs**:
   ```bash
   docker-compose -f packages/app/docker-compose.yml logs app
   ```

2. **Common causes**:
   - Invalid Datadog API key
   - Application crash on startup
   - Port conflict
   - Missing dependencies

3. **Run container in foreground**:
   ```bash
   docker-compose -f packages/app/docker-compose.yml up
   # (without -d flag to see logs)
   ```

### Cannot Remove Container

**Symptoms**: `Error response from daemon: container is running`

**Solution**:

```bash
# Stop and remove
docker-compose -f packages/app/docker-compose.yml down

# Force remove
docker rm -f <container-id>

# Remove all stopped containers
docker container prune
```

### Permission Denied Errors

**Symptoms**: `Permission denied` when building or running Docker

**Solutions**:

1. **Add user to docker group** (Linux):
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

2. **Run with sudo** (not recommended for development):
   ```bash
   sudo docker-compose up
   ```

## Build and Dependency Issues

### TypeScript Build Errors

**Symptoms**: `tsc` compilation errors

**Solutions**:

1. **Clean build directory**:
   ```bash
   cd packages/app
   rm -rf dist
   pnpm build
   ```

2. **Check TypeScript version**:
   ```bash
   pnpm list typescript
   ```

3. **Fix type errors** shown in output

### Module Not Found Errors

**Symptoms**: `Cannot find module 'express'` or similar

**Solutions**:

1. **Reinstall dependencies**:
   ```bash
   # From repository root
   pnpm clean:all
   pnpm install
   ```

2. **Check package.json** for missing dependencies

3. **Clear pnpm cache**:
   ```bash
   pnpm store prune
   ```

### nodemon Not Restarting

**Symptoms**: Changes not triggering server restart

**Solutions**:

1. **Check nodemon configuration** in `package.json`

2. **Restart manually**:
   ```bash
   # Stop (Ctrl+C) and restart
   pnpm dev
   ```

3. **Try different watch mode**:
   ```bash
   pnpm build --watch
   ```

## AWS Deployment Issues

### CDK Bootstrap Failed

**Symptoms**: `CDK bootstrap` command fails

**Solutions**:

1. **Check AWS credentials**:
   ```bash
   aws sts get-caller-identity
   ```

2. **Verify AWS CLI is configured**:
   ```bash
   aws configure list
   ```

3. **Check IAM permissions** - need:
   - CloudFormation
   - S3
   - IAM
   - ECR

### CDK Deploy Fails

**Symptoms**: `cdk deploy` fails with error

**Solutions**:

1. **Check error message** for specific issue

2. **Verify Datadog API key**:
   ```bash
   # If using context
   pnpm cdk:deploy --context datadogApiKey=your-key

   # If using Secrets Manager
   aws secretsmanager get-secret-value \
     --secret-id datadog-api-key-dev \
     --region us-east-1
   ```

3. **Check CloudFormation events**:
   - Go to AWS Console → CloudFormation
   - View stack events for error details

### ECS Task Won't Start

**Symptoms**: ECS task fails to start or keeps restarting

**Solutions**:

1. **Check task logs**:
   ```bash
   aws logs tail /ecs/test-datadog-crud-api-dev --follow
   aws logs tail /ecs/datadog-agent-dev --follow
   ```

2. **Check task definition**:
   ```bash
   aws ecs describe-task-definition \
     --task-definition test-datadog-crud-api
   ```

3. **Common issues**:
   - Docker image not found in ECR
   - Incorrect environment variables
   - Network connectivity issues
   - Insufficient memory/CPU

### Health Check Failures

**Symptoms**: Task starts but health checks fail

**Solutions**:

1. **Verify `/health` endpoint works**:
   ```bash
   # Get task IP
   aws ecs describe-tasks --cluster <cluster> --tasks <task-id>

   # Test from within VPC
   curl http://<task-ip>:3000/health
   ```

2. **Check security groups**:
   - ALB security group allows inbound 80/443
   - ECS security group allows inbound 3000 from ALB

3. **Review health check settings** in ALB target group

### Cannot Push to ECR

**Symptoms**: `docker push` to ECR fails

**Solutions**:

1. **Login to ECR**:
   ```bash
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin <ECR_URI>
   ```

2. **Verify ECR repository exists**:
   ```bash
   aws ecr describe-repositories --region us-east-1
   ```

3. **Check IAM permissions** for ECR

### Service Not Receiving Traffic

**Symptoms**: Service deployed but no traffic reaching it

**Solutions**:

1. **Get ALB URL from CDK outputs**:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name DatadogAppStack-dev \
     --query 'Stacks[0].Outputs'
   ```

2. **Check target group health**:
   - AWS Console → EC2 → Target Groups
   - Should show "healthy" targets

3. **Verify security groups**:
   - ALB can reach internet
   - ALB can reach ECS tasks

## Performance Issues

### High Memory Usage

**Symptoms**: Application using excessive memory

**Solutions**:

1. **Check memory metrics** in Datadog:
   - `runtime.node.mem.heap_used`
   - `runtime.node.mem.rss`

2. **Review for memory leaks**

3. **Increase task memory** (for ECS):
   - Edit `packages/cdk/bin/app.ts`
   - Increase `memory` parameter

### High CPU Usage

**Symptoms**: Application using excessive CPU

**Solutions**:

1. **Check CPU metrics** in Datadog:
   - `runtime.node.cpu.user`
   - `runtime.node.cpu.system`

2. **Use Datadog Profiling** to identify hot code paths

3. **Increase task CPU** (for ECS)

### Slow Response Times

**Symptoms**: Application responding slowly

**Solutions**:

1. **Check traces** in Datadog for slow operations

2. **Look for**:
   - Database query performance
   - External API calls
   - Heavy computation

3. **Check event loop delay**:
   - Metric: `runtime.node.event_loop.delay.max`

## Getting Additional Help

### Enable Debug Logging

```bash
# Datadog tracer debug
export DD_TRACE_DEBUG=true

# Application debug logs
export LOG_LEVEL=debug

# Run with verbose output
pnpm dev
```

### Collect Diagnostic Information

When reporting issues, collect:

```bash
# Node.js version
node --version

# pnpm version
pnpm --version

# Docker version
docker --version

# Check Datadog agent
docker exec datadog-agent agent status

# Application logs
docker-compose -f packages/app/docker-compose.yml logs

# Environment variables (redact API keys!)
env | grep DD_
```

### Check Documentation

- [Datadog APM Docs](https://docs.datadoghq.com/tracing/)
- [Datadog Agent Docs](https://docs.datadoghq.com/agent/)
- [AWS ECS Docs](https://docs.aws.amazon.com/ecs/)
- [AWS CDK Docs](https://docs.aws.amazon.com/cdk/)

### Still Stuck?

1. Review [Getting Started Guide](./getting-started.md)
2. Check [Local Development Guide](./local-development.md)
3. Consult [Deployment Guide](./deployment.md) for AWS issues
4. Review [Monitoring Guide](./monitoring.md) for Datadog issues
