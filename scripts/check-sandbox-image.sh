#!/bin/bash
# Check and update the agent-sandbox Docker image
#
# Usage:
#   ./scripts/check-sandbox-image.sh          # Check and pull if needed
#   ./scripts/check-sandbox-image.sh --force  # Force pull latest
#   ./scripts/check-sandbox-image.sh --check  # Check only, don't pull
#
# Auto-recovery:
#   - If Docker is available but image is missing, pulls automatically
#   - If Docker is offline, skips gracefully
#   - If network is unavailable, uses local image

set -e

REMOTE_IMAGE="srlynch1/agentpane-sandbox:latest"
LOCAL_IMAGE="agent-sandbox:latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
FORCE_PULL=false
CHECK_ONLY=false
QUIET=false
for arg in "$@"; do
  case $arg in
    --force) FORCE_PULL=true ;;
    --check) CHECK_ONLY=true ;;
    --quiet) QUIET=true ;;
  esac
done

# Check if Docker daemon is running
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    return 1
  fi
  return 0
}

# Get local image digest
get_local_digest() {
  docker images --no-trunc --format "{{.ID}}" "$LOCAL_IMAGE" 2>/dev/null | head -1
}

# Check if we can reach Docker Hub
check_network() {
  # Try to ping Docker Hub registry
  if docker manifest inspect "$REMOTE_IMAGE" > /dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Pull the latest image and tag it
pull_and_tag() {
  log_info "Pulling latest image from Docker Hub..."
  if docker pull "$REMOTE_IMAGE"; then
    log_info "Tagging as $LOCAL_IMAGE..."
    docker tag "$REMOTE_IMAGE" "$LOCAL_IMAGE"
    log_success "Updated $LOCAL_IMAGE to latest version"
    return 0
  else
    log_error "Failed to pull image"
    return 1
  fi
}

# Main logic
main() {
  if [ "$QUIET" != true ]; then
    echo ""
    echo "=========================================="
    echo "  Agent Sandbox Image Check"
    echo "=========================================="
    echo ""
  fi

  # Step 1: Check if Docker is available
  if ! check_docker; then
    log_warn "Docker is not running or not installed"
    log_info "Skipping image check - start Docker to enable container agents"
    return 0  # Don't fail startup, just skip
  fi

  # Step 2: Force pull if requested
  if [ "$FORCE_PULL" = true ]; then
    log_info "Force pull requested"
    pull_and_tag
    return $?
  fi

  # Step 3: Check if local image exists
  LOCAL_DIGEST=$(get_local_digest)

  if [ -z "$LOCAL_DIGEST" ]; then
    log_warn "Local image $LOCAL_IMAGE not found"

    if [ "$CHECK_ONLY" = true ]; then
      log_info "Run without --check to pull the image"
      return 1
    fi

    # Auto-recovery: Try to pull the image
    log_info "Attempting auto-recovery..."

    if check_network; then
      pull_and_tag
      return $?
    else
      log_error "Cannot reach Docker Hub - no local image available"
      log_info "Container agents will not work until image is available"
      log_info "Try: docker pull $REMOTE_IMAGE && docker tag $REMOTE_IMAGE $LOCAL_IMAGE"
      return 1
    fi
  fi

  if [ "$QUIET" != true ]; then
    log_info "Local image:  ${LOCAL_DIGEST:7:12}"
  fi

  # Step 4: Check for updates (if network available)
  if ! check_network; then
    if [ "$QUIET" != true ]; then
      log_warn "Cannot reach Docker Hub (network issue or not logged in)"
      log_info "Using local image"
    fi
    return 0
  fi

  if [ "$QUIET" != true ]; then
    log_info "Checking Docker Hub for updates..."
  fi

  # Pull to compare (manifest digest != local ID)
  if ! docker pull "$REMOTE_IMAGE" > /dev/null 2>&1; then
    log_warn "Failed to pull remote image, using local"
    return 0
  fi

  PULLED_ID=$(docker images --no-trunc --format "{{.ID}}" "$REMOTE_IMAGE" 2>/dev/null | head -1)

  if [ "$LOCAL_DIGEST" = "$PULLED_ID" ]; then
    if [ "$QUIET" != true ]; then
      log_success "Local image is up to date!"
      echo ""
      echo "  Image ID: ${LOCAL_DIGEST:7:12}"
      echo "  Created:  $(docker inspect --format '{{.Created}}' $LOCAL_IMAGE 2>/dev/null | cut -d'T' -f1)"
      echo ""
    fi
    return 0
  fi

  # Images differ
  if [ "$QUIET" != true ]; then
    log_warn "Newer image available!"
    echo ""
    echo "  Local:  ${LOCAL_DIGEST:7:12}"
    echo "  Remote: ${PULLED_ID:7:12}"
    echo ""
  fi

  if [ "$CHECK_ONLY" = true ]; then
    log_info "Run without --check to update"
    return 1
  fi

  # Tag the pulled image as local
  log_info "Updating local image..."
  docker tag "$REMOTE_IMAGE" "$LOCAL_IMAGE"
  log_success "Updated $LOCAL_IMAGE to latest version"

  if [ "$QUIET" != true ]; then
    echo ""
    echo "  New Image ID: ${PULLED_ID:7:12}"
    echo "  Created:      $(docker inspect --format '{{.Created}}' $LOCAL_IMAGE 2>/dev/null | cut -d'T' -f1)"
    echo ""
  fi
}

main "$@"
