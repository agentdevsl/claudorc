#!/bin/bash
# AgentPane Kubernetes Setup Script (Minikube)
#
# Sets up a local Minikube cluster with the Agent Sandbox CRD controller
# and applies all AgentPane Kubernetes manifests.
#
# Usage:
#   ./scripts/k8s-setup-minikube.sh           # Full setup
#   ./scripts/k8s-setup-minikube.sh --help     # Show help
#
# This script is idempotent -- safe to re-run at any time.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFESTS_DIR="$PROJECT_ROOT/k8s/manifests"
NAMESPACE="agentpane-sandboxes"
CRD_INSTALL_URL="https://github.com/kubernetes-sigs/agent-sandbox/releases/latest/download/install.yaml"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_step()    { echo -e "\n${BOLD}${BLUE}[$1/7]${NC} ${BOLD}$2${NC}"; }
log_info()    { echo -e "  ${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "  ${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "  ${RED}[ERROR]${NC} $1"; }

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
AgentPane Kubernetes Setup (Minikube)

Usage: ./scripts/k8s-setup-minikube.sh [OPTIONS]

Steps performed:
  1. Check prerequisites (minikube, kubectl, helm)
  2. Start minikube (with gvisor addon if available)
  3. Install Agent Sandbox CRD controller
  4. Apply RuntimeClass manifest
  5. Create namespace
  6. Apply all manifests (template, warm-pool, limit-range)
  7. Wait for controller to be ready and print status

Options:
  --help, -h    Show this help message

This script is idempotent and safe to re-run.
EOF
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 1: Check prerequisites
# ---------------------------------------------------------------------------
log_step 1 "Checking prerequisites"

MISSING=()

if command -v minikube &>/dev/null; then
  log_success "minikube $(minikube version --short 2>/dev/null || echo 'found')"
else
  MISSING+=("minikube")
fi

if command -v kubectl &>/dev/null; then
  log_success "kubectl $(kubectl version --client --short 2>/dev/null || kubectl version --client -o json 2>/dev/null | grep gitVersion | head -1 | tr -d ' ",' | cut -d: -f2 || echo 'found')"
else
  MISSING+=("kubectl")
fi

if command -v helm &>/dev/null; then
  log_success "helm $(helm version --short 2>/dev/null || echo 'found')"
else
  log_warn "helm not found (optional, not required for CRD setup)"
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  log_error "Missing required tools: ${MISSING[*]}"
  echo ""
  echo "Install instructions:"
  for tool in "${MISSING[@]}"; do
    case "$tool" in
      minikube) echo "  minikube: https://minikube.sigs.k8s.io/docs/start/" ;;
      kubectl)  echo "  kubectl:  https://kubernetes.io/docs/tasks/tools/" ;;
    esac
  done
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: Start minikube
# ---------------------------------------------------------------------------
log_step 2 "Starting minikube"

if minikube status --format='{{.Host}}' 2>/dev/null | grep -q "Running"; then
  log_success "minikube is already running"
else
  log_info "Starting minikube cluster..."

  # Check if gvisor addon is available and enable it
  MINIKUBE_ARGS=("start" "--memory=4096" "--cpus=2")

  # Try to enable gvisor addon (available in minikube >= 1.11)
  if minikube addons list 2>/dev/null | grep -q "gvisor"; then
    log_info "gVisor addon available, will enable after start"
  fi

  minikube "${MINIKUBE_ARGS[@]}"
  log_success "minikube started"

  # Enable gvisor addon if available
  if minikube addons list 2>/dev/null | grep -q "gvisor"; then
    log_info "Enabling gVisor addon..."
    if minikube addons enable gvisor 2>/dev/null; then
      log_success "gVisor addon enabled"
    else
      log_warn "gVisor addon could not be enabled (sandbox will use default runtime)"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Step 3: Install Agent Sandbox CRD controller
# ---------------------------------------------------------------------------
log_step 3 "Installing Agent Sandbox CRD controller"

# Check if CRDs are already installed
if kubectl get crd sandboxes.agents.x-k8s.io &>/dev/null 2>&1; then
  log_success "Agent Sandbox CRDs already installed"
else
  log_info "Installing CRD controller from: $CRD_INSTALL_URL"
  if kubectl apply -f "$CRD_INSTALL_URL"; then
    log_success "CRD controller installed"
  else
    log_warn "Could not install from release URL. The CRD controller may need manual installation."
    log_warn "See: https://github.com/kubernetes-sigs/agent-sandbox"
    log_info "Continuing with remaining setup steps..."
  fi
fi

# ---------------------------------------------------------------------------
# Step 4: Apply RuntimeClass manifest
# ---------------------------------------------------------------------------
log_step 4 "Applying RuntimeClass for gVisor"

if [[ -f "$MANIFESTS_DIR/runtime-class-gvisor.yaml" ]]; then
  kubectl apply -f "$MANIFESTS_DIR/runtime-class-gvisor.yaml"
  log_success "RuntimeClass 'gvisor' applied"
else
  log_warn "runtime-class-gvisor.yaml not found at $MANIFESTS_DIR"
fi

# ---------------------------------------------------------------------------
# Step 5: Create namespace
# ---------------------------------------------------------------------------
log_step 5 "Creating namespace"

if [[ -f "$MANIFESTS_DIR/namespace.yaml" ]]; then
  kubectl apply -f "$MANIFESTS_DIR/namespace.yaml"
  log_success "Namespace '$NAMESPACE' applied"
else
  log_warn "namespace.yaml not found, creating namespace directly"
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  log_success "Namespace '$NAMESPACE' created"
fi

# ---------------------------------------------------------------------------
# Step 6: Apply all manifests
# ---------------------------------------------------------------------------
log_step 6 "Applying manifests"

apply_manifest() {
  local file="$1"
  local desc="$2"
  if [[ -f "$file" ]]; then
    if kubectl apply -f "$file" 2>/dev/null; then
      log_success "$desc applied"
    else
      log_warn "$desc failed to apply (CRD may not be registered yet)"
    fi
  else
    log_warn "$desc not found at $file"
  fi
}

apply_manifest "$MANIFESTS_DIR/limit-range.yaml" "LimitRange"
apply_manifest "$MANIFESTS_DIR/agentpane-sandbox-template.yaml" "SandboxTemplate"
apply_manifest "$MANIFESTS_DIR/agentpane-warm-pool.yaml" "SandboxWarmPool"

# Also apply network-policy and rbac if they exist
apply_manifest "$MANIFESTS_DIR/network-policy.yaml" "NetworkPolicy"
apply_manifest "$MANIFESTS_DIR/rbac.yaml" "RBAC"

# ---------------------------------------------------------------------------
# Step 7: Wait for controller and print status
# ---------------------------------------------------------------------------
log_step 7 "Verifying setup"

# Check if the CRD controller deployment exists and is ready
CONTROLLER_NS="agent-sandbox-system"
CONTROLLER_DEPLOY="agent-sandbox-controller-manager"

if kubectl get deployment "$CONTROLLER_DEPLOY" -n "$CONTROLLER_NS" &>/dev/null 2>&1; then
  log_info "Waiting for CRD controller to be ready (timeout: 120s)..."
  if kubectl rollout status deployment/"$CONTROLLER_DEPLOY" -n "$CONTROLLER_NS" --timeout=120s 2>/dev/null; then
    log_success "CRD controller is ready"
  else
    log_warn "CRD controller did not become ready within 120s"
  fi
else
  log_warn "CRD controller deployment not found in namespace '$CONTROLLER_NS'"
  log_info "The controller may use a different namespace or may not be installed yet"
fi

# Print summary
echo ""
echo -e "${BOLD}${GREEN}Setup complete!${NC}"
echo ""
echo -e "${BOLD}Cluster Status:${NC}"
echo -e "  Minikube:   $(minikube status --format='{{.Host}}' 2>/dev/null || echo 'unknown')"
echo -e "  Kubernetes: $(kubectl version --short 2>/dev/null | grep Server || kubectl version -o json 2>/dev/null | grep gitVersion | tail -1 | tr -d ' ",' | cut -d: -f2 || echo 'unknown')"
echo ""
echo -e "${BOLD}Namespace Resources:${NC}"
kubectl get all -n "$NAMESPACE" 2>/dev/null || echo "  (no resources yet)"
echo ""

# Check for CRD resources
if kubectl get crd sandboxes.agents.x-k8s.io &>/dev/null 2>&1; then
  echo -e "${BOLD}CRD Resources:${NC}"
  echo "  SandboxTemplates:"
  kubectl get sandboxtemplates -n "$NAMESPACE" 2>/dev/null || echo "    (none)"
  echo "  SandboxWarmPools:"
  kubectl get sandboxwarmpools -n "$NAMESPACE" 2>/dev/null || echo "    (none)"
  echo "  Sandboxes:"
  kubectl get sandboxes -n "$NAMESPACE" 2>/dev/null || echo "    (none)"
fi

echo ""
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Configure AgentPane sandbox settings to use 'kubernetes' provider"
echo "  2. Set the namespace to '$NAMESPACE'"
echo "  3. Start the AgentPane server: bun run dev"
