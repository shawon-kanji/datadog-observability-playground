#!/bin/bash

# Local Setup Script for Datadog CRUD API
# This script helps set up the local development environment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Datadog CRUD API - Local Setup${NC}"
echo -e "${GREEN}================================${NC}\n"

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi

echo -e "${YELLOW}Detected OS: $OS${NC}\n"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js
echo -e "${YELLOW}Checking prerequisites...${NC}"
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org${NC}"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm installed: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

echo ""

# Ask user which setup they want
echo -e "${YELLOW}Choose your setup option:${NC}"
echo "1) Docker Compose (App + Datadog Agent) - RECOMMENDED"
echo "2) Local Node.js + Dockerized Datadog Agent"
echo "3) Just install dependencies (manual setup)"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo -e "\n${GREEN}Setting up Docker Compose environment...${NC}\n"

        # Check if Docker is installed
        if ! command_exists docker; then
            echo -e "${RED}✗ Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ Docker is installed${NC}"

        # Check if docker-compose is available
        if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
            echo -e "${RED}✗ docker-compose not found${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ docker-compose is available${NC}\n"

        # Ask for Datadog API key
        read -p "Enter your Datadog API Key: " dd_api_key

        if [ -z "$dd_api_key" ]; then
            echo -e "${RED}API key cannot be empty${NC}"
            exit 1
        fi

        # Export API key
        export DD_API_KEY=$dd_api_key

        echo -e "\n${GREEN}Starting services with Docker Compose...${NC}\n"
        docker-compose up -d

        echo -e "\n${GREEN}Services started!${NC}"
        echo -e "${YELLOW}Application:${NC} http://localhost:3000"
        echo -e "${YELLOW}Health Check:${NC} http://localhost:3000/health"
        echo -e "\n${YELLOW}View logs:${NC}"
        echo -e "  docker-compose logs -f app"
        echo -e "  docker-compose logs -f datadog-agent"
        echo -e "\n${YELLOW}Stop services:${NC}"
        echo -e "  docker-compose down"
        ;;

    2)
        echo -e "\n${GREEN}Setting up Dockerized Datadog Agent + Local Node.js...${NC}\n"

        # Check Docker
        if ! command_exists docker; then
            echo -e "${RED}✗ Docker not found. Please install Docker from https://www.docker.com/products/docker-desktop${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ Docker is installed${NC}\n"

        # Install dependencies
        echo -e "${YELLOW}Installing npm dependencies...${NC}"
        npm install
        echo -e "${GREEN}✓ Dependencies installed${NC}\n"

        # Ask for Datadog API key
        read -p "Enter your Datadog API Key: " dd_api_key

        if [ -z "$dd_api_key" ]; then
            echo -e "${RED}API key cannot be empty${NC}"
            exit 1
        fi

        # Check if agent is already running
        if docker ps | grep -q datadog-agent; then
            echo -e "${YELLOW}Datadog agent container already running. Stopping it...${NC}"
            docker stop datadog-agent
            docker rm datadog-agent
        fi

        # Start Datadog agent
        echo -e "${YELLOW}Starting Datadog agent container...${NC}"
        docker run -d \
          --name datadog-agent \
          -e DD_API_KEY=$dd_api_key \
          -e DD_SITE=datadoghq.com \
          -e DD_APM_ENABLED=true \
          -e DD_APM_NON_LOCAL_TRAFFIC=true \
          -e DD_LOGS_ENABLED=true \
          -e DD_PROCESS_AGENT_ENABLED=true \
          -p 8126:8126 \
          -p 8125:8125/udp \
          -v /var/run/docker.sock:/var/run/docker.sock:ro \
          -v /proc/:/host/proc/:ro \
          -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
          gcr.io/datadoghq/agent:latest

        echo -e "${GREEN}✓ Datadog agent started${NC}\n"

        # Wait a bit for agent to start
        echo -e "${YELLOW}Waiting for agent to initialize...${NC}"
        sleep 5

        # Create/update .env file
        echo -e "${YELLOW}Checking .env file...${NC}"
        if [ -f .env ]; then
            echo -e "${GREEN}✓ .env file already exists${NC}"
        else
            echo -e "${YELLOW}Creating .env file...${NC}"
            cp .env.example .env 2>/dev/null || cat > .env << 'EOF'
PORT=3000
NODE_ENV=development
DD_SERVICE=test-datadog-crud-api
DD_ENV=local
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_LOGS_INJECTION=true
DD_RUNTIME_METRICS_ENABLED=true
DD_PROFILING_ENABLED=true
EOF
            echo -e "${GREEN}✓ .env file created${NC}"
        fi

        echo -e "\n${GREEN}Setup complete!${NC}"
        echo -e "\n${YELLOW}To start your application:${NC}"
        echo -e "  npm run dev"
        echo -e "\n${YELLOW}To check agent status:${NC}"
        echo -e "  docker exec datadog-agent agent status"
        echo -e "\n${YELLOW}To stop the agent:${NC}"
        echo -e "  docker stop datadog-agent"
        echo -e "  docker rm datadog-agent"
        ;;

    3)
        echo -e "\n${GREEN}Installing dependencies only...${NC}\n"
        npm install
        echo -e "${GREEN}✓ Dependencies installed${NC}\n"

        echo -e "${YELLOW}Next steps:${NC}"
        echo -e "1. Install Datadog agent on your machine (see LOCAL_SETUP.md)"
        echo -e "2. Configure .env file with your settings"
        echo -e "3. Run: npm run dev"
        echo -e "\nFor detailed instructions, see: LOCAL_SETUP.md"
        ;;

    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}\n"
