#!/usr/bin/env bash

# Standalone environment validation script
#
# This script validates that required environment variables are set before
# proceeding with Terraform operations.
#
# Usage: ./validate-env.sh [OPTIONS]
#
# OPTIONS:
#   --json              Output in JSON format
#   --quiet             Suppress output (exit code only)
#   --help, -h          Show help message
#
# EXIT CODES:
#   0: All required environment variables are set
#   1: One or more required environment variables are missing

set -euo pipefail

# Parse command line arguments
JSON_MODE=false
QUIET_MODE=false

for arg in "$@"; do
    case "$arg" in
        --json)
            JSON_MODE=true
            ;;
        --quiet)
            QUIET_MODE=true
            ;;
        --help|-h)
            cat << 'EOF'
Usage: validate-env.sh [OPTIONS]

Validate that required environment variables are set for Terraform operations.

REQUIRED ENVIRONMENT VARIABLES:
  TFE_TOKEN          Terraform Cloud/Enterprise API token
  GITHUB_TOKEN       GitHub Personal Access Token

OPTIONS:
  --json              Output in JSON format
  --quiet             Suppress output (exit code only)
  --help, -h          Show this help message

EXAMPLES:
  # Check required environment variables
  ./validate-env.sh

  # Check with JSON output
  ./validate-env.sh --json

  # Silent check (use exit code)
  ./validate-env.sh --quiet && echo "OK" || echo "FAILED"

EXIT CODES:
  0: All required environment variables are set
  1: One or more required environment variables are missing

EOF
            exit 0
            ;;
        *)
            echo "ERROR: Unknown option '$arg'. Use --help for usage information." >&2
            exit 1
            ;;
    esac
done

# Check required environment variables
missing=()
present=()

if [[ -z "${TFE_TOKEN:-}" ]]; then
    missing+=("TFE_TOKEN")
else
    present+=("TFE_TOKEN")
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    missing+=("GITHUB_TOKEN")
else
    present+=("GITHUB_TOKEN")
fi

# Determine validation result
if [[ ${#missing[@]} -eq 0 ]]; then
    VALIDATION_RESULT=0  # Success
else
    VALIDATION_RESULT=1  # Failure
fi

# Output results
if $QUIET_MODE; then
    # Quiet mode: no output, just exit code
    exit $VALIDATION_RESULT
elif $JSON_MODE; then
    # JSON output
    valid="true"
    [[ $VALIDATION_RESULT -eq 1 ]] && valid="false"

    # Build missing array
    missing_json="[]"
    if [[ ${#missing[@]} -gt 0 ]]; then
        missing_json=$(printf '"%s",' "${missing[@]}")
        missing_json="[${missing_json%,}]"
    fi

    # Build present array
    present_json="[]"
    if [[ ${#present[@]} -gt 0 ]]; then
        present_json=$(printf '"%s",' "${present[@]}")
        present_json="[${present_json%,}]"
    fi

    printf '{"valid":%s,"missing":%s,"present":%s}\n' \
        "$valid" "$missing_json" "$present_json"
else
    # Text output
    echo "Environment Validation"
    echo "======================"
    echo ""

    # Show TFE_TOKEN status
    if [[ -z "${TFE_TOKEN:-}" ]]; then
        echo "TFE_TOKEN - Failed - NOT SET"
    else
        echo "TFE_TOKEN - Passed - SET"
    fi

    # Show GITHUB_TOKEN status
    if [[ -z "${GITHUB_TOKEN:-}" ]]; then
        echo "GITHUB_TOKEN - Failed - NOT SET"
    else
        echo "GITHUB_TOKEN - Passed - SET"
    fi
    echo ""

    # Summary
    echo "Summary"
    echo "-------"
    if [[ $VALIDATION_RESULT -eq 0 ]]; then
        echo "✓ All required environment variables are set"
        echo ""
        echo "You're ready to proceed with Terraform operations!"
    else
        echo "✗ Missing ${#missing[@]} required environment variable(s)"
        echo ""
        echo "Quick Setup:"
        step=1
        for var in "${missing[@]}"; do
            case "$var" in
                TFE_TOKEN)
                    echo "  $step. TFE_TOKEN (Terraform Cloud/Enterprise API token)"
                    echo "     Get token: https://app.terraform.io/app/settings/tokens"
                    echo "     export TFE_TOKEN=\"<your-terraform-token>\""
                    ;;
                GITHUB_TOKEN)
                    echo "  $step. GITHUB_TOKEN (GitHub Personal Access Token)"
                    echo "     Get token: https://github.com/settings/tokens"
                    echo "     export GITHUB_TOKEN=\"<your-github-token>\""
                    ;;
            esac
            ((step++))
            echo ""
        done
        echo ""
        echo "For permanent setup, add these exports to your ~/.bashrc or ~/.zshrc"
    fi
fi

# Initialize TFLint and pre-commit (always required)
if ! $QUIET_MODE && ! $JSON_MODE; then
    echo ""
    echo "Tool Initialization"
    echo "==================="
    echo ""

    # Initialize TFLint
    echo "Initializing TFLint..."
    if ! tflint --init; then
        echo "WARNING: TFLint initialization failed, but continuing..."
    fi
    echo ""

    # Enable pre-commit hooks if available (optional step)
    if command -v pre-commit &> /dev/null; then
        echo "Installing pre-commit hooks..."
        pre-commit install
    else
        echo "Pre-commit not available - skipping (this is optional)"
    fi
    echo ""
fi

exit $VALIDATION_RESULT
