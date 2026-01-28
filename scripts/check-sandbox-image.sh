#!/bin/bash
# Check and update the agent-sandbox Docker image
#
# Usage:
#   ./scripts/check-sandbox-image.sh          # Check and pull if needed
#   ./scripts/check-sandbox-image.sh --force  # Force pull latest
#   ./scripts/check-sandbox-image.sh --check  # Check only, don't pull

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
for arg in "$@"; do
  case $arg in
    --force) FORCE_PULL=true ;;
    --check) CHECK_ONLY=true ;;
  esac
done

# Get local image digest
get_local_digest() {
  docker images --no-trunc --format "{{.ID}}" "$LOCAL_IMAGE" 2>/dev/null | head -1
}

# Get remote image digest from Docker Hub
get_remote_digest() {
  # Use docker manifest inspect to get the remote digest
  # This doesn't pull the image, just checks the manifest
  docker manifest inspect "$REMOTE_IMAGE" 2>/dev/null | \
    grep -A1 '"digest"' | grep 'sha256' | head -1 | \
    sed 's/.*"\(sha256:[^"]*\)".*/\1/' || echo ""
}

# Pull the latest image and tag it
pull_and_tag() {
  log_info "Pulling latest image from Docker Hub..."
  docker pull "$REMOTE_IMAGE"

  log_info "Tagging as $LOCAL_IMAGE..."
  docker tag "$REMOTE_IMAGE" "$LOCAL_IMAGE"

  log_success "Updated $LOCAL_IMAGE to latest version"
}

# Main logic
main() {
  echo ""
  echo "=========================================="
  echo "  Agent Sandbox Image Check"
  echo "=========================================="
  echo ""

  # Force pull if requested
  if [ "$FORCE_PULL" = true ]; then
    log_info "Force pull requested"
    pull_and_tag
    return 0
  fi

  # Check if local image exists
  LOCAL_DIGEST=$(get_local_digest)
  if [ -z "$LOCAL_DIGEST" ]; then
    log_warn "Local image $LOCAL_IMAGE not found"
    if [ "$CHECK_ONLY" = true ]; then
      log_info "Run without --check to pull the image"
      return 1
    fi
    pull_and_tag
    return 0
  fi

  log_info "Local image:  $LOCAL_DIGEST"

  # Check remote digest
  log_info "Checking Docker Hub for updates..."
  REMOTE_DIGEST=$(get_remote_digest)

  if [ -z "$REMOTE_DIGEST" ]; then
    log_warn "Could not fetch remote digest (network issue or not logged in)"
    log_info "Local image will be used"
    return 0
  fi

  log_info "Remote image: $REMOTE_DIGEST"

  # Compare digests by pulling and checking
  # Docker Hub manifest digest != local image ID, so we need to pull to compare
  log_info "Pulling to check for updates..."
  docker pull "$REMOTE_IMAGE" > /dev/null 2>&1

  PULLED_ID=$(docker images --no-trunc --format "{{.ID}}" "$REMOTE_IMAGE" 2>/dev/null | head -1)

  if [ "$LOCAL_DIGEST" = "$PULLED_ID" ]; then
    log_success "Local image is up to date!"
    echo ""
    echo "  Image ID: $LOCAL_DIGEST"
    echo "  Created:  $(docker inspect --format '{{.Created}}' $LOCAL_IMAGE 2>/dev/null | cut -d'T' -f1)"
    echo ""
    return 0
  fi

  # Images differ
  log_warn "Newer image available!"
  echo ""
  echo "  Local:  $LOCAL_DIGEST"
  echo "  Remote: $PULLED_ID"
  echo ""

  if [ "$CHECK_ONLY" = true ]; then
    log_info "Run without --check to update"
    return 1
  fi

  # Tag the pulled image as local
  log_info "Updating local image..."
  docker tag "$REMOTE_IMAGE" "$LOCAL_IMAGE"
  log_success "Updated $LOCAL_IMAGE to latest version"

  # Show new image info
  echo ""
  echo "  New Image ID: $PULLED_ID"
  echo "  Created:      $(docker inspect --format '{{.Created}}' $LOCAL_IMAGE 2>/dev/null | cut -d'T' -f1)"
  echo ""
}

main "$@"
