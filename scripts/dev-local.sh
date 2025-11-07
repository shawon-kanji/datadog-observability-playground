#!/bin/bash

##############################################################################
# Local Development Script
# Builds and runs all microservices for local development
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES_DIR="$ROOT_DIR/packages"

# List of services to build and run
# Format: "package-name:port:docker-image-name"
SERVICES=(
  "app:3000:datadog-crud-api"
  "order-service:3001:order-service"
)

# Parse command line arguments
MODE="${1:-docker}"  # docker or direct
ACTION="${2:-build-and-run}"  # build, run, build-and-run, stop

##############################################################################
# Helper Functions
##############################################################################

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_usage() {
  cat << EOF
Usage: $0 [MODE] [ACTION]

MODES:
  docker      - Build Docker images and run containers (default)
  direct      - Run services directly with pnpm (no Docker)

ACTIONS:
  build           - Only build services
  run             - Only run services (assumes already built)
  build-and-run   - Build and run services (default)
  stop            - Stop running services

Examples:
  $0                        # Build and run with Docker
  $0 docker build           # Only build Docker images
  $0 direct build-and-run   # Build TypeScript and run with pnpm
  $0 docker stop            # Stop Docker containers

EOF
}

##############################################################################
# Docker Mode Functions
##############################################################################

build_docker_images() {
  log_info "Building Docker images..."

  for service_config in "${SERVICES[@]}"; do
    IFS=':' read -r package_name port image_name <<< "$service_config"

    log_info "Building $image_name from packages/$package_name..."

    if [ -f "$PACKAGES_DIR/$package_name/Dockerfile" ]; then
      cd "$PACKAGES_DIR/$package_name"
      docker build -t "$image_name:latest" .
      log_success "Built $image_name:latest"
    else
      log_error "Dockerfile not found for $package_name"
      exit 1
    fi
  done

  log_success "All Docker images built successfully"
}

run_docker_containers() {
  log_info "Starting Docker containers..."

  # Create a Docker network if it doesn't exist
  if ! docker network inspect datadog-playground-network &> /dev/null; then
    log_info "Creating Docker network: datadog-playground-network"
    docker network create datadog-playground-network
  fi

  for service_config in "${SERVICES[@]}"; do
    IFS=':' read -r package_name port image_name <<< "$service_config"

    # Stop existing container if running
    if docker ps -a --format '{{.Names}}' | grep -q "^${image_name}$"; then
      log_warning "Stopping existing container: $image_name"
      docker stop "$image_name" 2>/dev/null || true
      docker rm "$image_name" 2>/dev/null || true
    fi

    log_info "Starting $image_name on port $port..."

    # Load environment variables from .env file
    ENV_ARGS=""
    if [ -f "$PACKAGES_DIR/$package_name/.env" ]; then
      ENV_ARGS="--env-file $PACKAGES_DIR/$package_name/.env"
    fi

    # Run container
    docker run -d \
      --name "$image_name" \
      --network datadog-playground-network \
      -p "$port:$port" \
      $ENV_ARGS \
      "$image_name:latest"

    log_success "Started $image_name on http://localhost:$port"
  done

  log_success "All services are running"
  log_info "Service URLs:"
  for service_config in "${SERVICES[@]}"; do
    IFS=':' read -r package_name port image_name <<< "$service_config"
    echo -e "  ${GREEN}→${NC} $package_name: http://localhost:$port"
  done
}

stop_docker_containers() {
  log_info "Stopping Docker containers..."

  for service_config in "${SERVICES[@]}"; do
    IFS=':' read -r package_name port image_name <<< "$service_config"

    if docker ps --format '{{.Names}}' | grep -q "^${image_name}$"; then
      log_info "Stopping $image_name..."
      docker stop "$image_name"
      docker rm "$image_name"
      log_success "Stopped $image_name"
    else
      log_warning "$image_name is not running"
    fi
  done

  log_success "All containers stopped"
}

##############################################################################
# Direct Mode Functions
##############################################################################

build_typescript() {
  log_info "Building TypeScript projects..."

  cd "$ROOT_DIR"
  pnpm build:all

  log_success "All TypeScript projects built successfully"
}

run_direct() {
  log_info "Starting services with pnpm..."

  # Check if all services are built
  for service_config in "${SERVICES[@]}"; do
    IFS=':' read -r package_name port image_name <<< "$service_config"

    if [ ! -d "$PACKAGES_DIR/$package_name/dist" ]; then
      log_error "$package_name not built. Run with 'build' or 'build-and-run' action first."
      exit 1
    fi
  done

  cd "$ROOT_DIR"

  # Start all services in parallel using pnpm
  log_info "Starting all services in parallel..."
  pnpm dev:all
}

stop_direct() {
  log_warning "Direct mode: Please stop services manually with Ctrl+C"

  # Try to find and kill processes
  for service_config in "${SERVICES[@]}"; do
    IFS=':' read -r package_name port image_name <<< "$service_config"

    log_info "Looking for processes on port $port..."
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$PID" ]; then
      log_info "Killing process $PID on port $port"
      kill -9 $PID 2>/dev/null || true
    fi
  done
}

##############################################################################
# Main Script Logic
##############################################################################

# Show usage if help flag
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  print_usage
  exit 0
fi

# Validate mode
if [[ "$MODE" != "docker" ]] && [[ "$MODE" != "direct" ]]; then
  log_error "Invalid mode: $MODE"
  print_usage
  exit 1
fi

# Validate action
if [[ "$ACTION" != "build" ]] && [[ "$ACTION" != "run" ]] && [[ "$ACTION" != "build-and-run" ]] && [[ "$ACTION" != "stop" ]]; then
  log_error "Invalid action: $ACTION"
  print_usage
  exit 1
fi

log_info "Mode: $MODE | Action: $ACTION"
echo ""

##############################################################################
# Execute based on mode and action
##############################################################################

case "$MODE" in
  docker)
    case "$ACTION" in
      build)
        build_docker_images
        ;;
      run)
        run_docker_containers
        ;;
      build-and-run)
        build_docker_images
        echo ""
        run_docker_containers
        ;;
      stop)
        stop_docker_containers
        ;;
    esac
    ;;

  direct)
    case "$ACTION" in
      build)
        build_typescript
        ;;
      run)
        run_direct
        ;;
      build-and-run)
        build_typescript
        echo ""
        run_direct
        ;;
      stop)
        stop_direct
        ;;
    esac
    ;;
esac

echo ""
log_success "Script completed successfully"
