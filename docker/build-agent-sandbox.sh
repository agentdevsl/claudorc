#!/bin/bash
# Build the agent sandbox Docker image
#
# Usage:
#   ./docker/build-agent-sandbox.sh [tag]
#
# Examples:
#   ./docker/build-agent-sandbox.sh              # builds :latest
#   ./docker/build-agent-sandbox.sh v1.0.0       # builds :v1.0.0

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TAG="${1:-latest}"
IMAGE_NAME="agentpane/agent-sandbox:${TAG}"

echo "Building agent runner..."
cd "$PROJECT_ROOT/agent-runner"
npm install
npm run build

echo "Building Docker image: ${IMAGE_NAME}"
cd "$PROJECT_ROOT"

docker build \
  -f docker/Dockerfile.agent-sandbox \
  -t "$IMAGE_NAME" \
  .

echo "Done! Image: ${IMAGE_NAME}"
echo ""
echo "To test the image:"
echo "  docker run -it --rm -v \$(pwd):/workspace ${IMAGE_NAME}"
