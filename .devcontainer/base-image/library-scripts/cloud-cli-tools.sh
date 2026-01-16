#!/usr/bin/env bash
set -e

# This script installs AWS CLI, Azure CLI, and Google Cloud SDK

# Helper function to retry commands
retry_command() {
    local max_attempts=3
    local attempt=1
    local delay=5
    
    while [ $attempt -le $max_attempts ]; do
        if "$@"; then
            return 0
        else
            if [ $attempt -lt $max_attempts ]; then
                echo "Command failed. Attempt $attempt/$max_attempts. Retrying in ${delay}s..."
                sleep $delay
                delay=$((delay * 2))
            fi
            attempt=$((attempt + 1))
        fi
    done
    
    echo "Command failed after $max_attempts attempts."
    return 1
}

# Install AWS CLI v2
echo "Installing AWS CLI v2..."
# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        AWS_ARCH="x86_64"
        ;;
    aarch64|arm64)
        AWS_ARCH="aarch64"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "Detected architecture: $ARCH, using AWS CLI for: $AWS_ARCH"
curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o /tmp/awscliv2.zip
unzip -qq /tmp/awscliv2.zip -d /tmp
sudo /tmp/aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli --update
rm -rf /tmp/aws /tmp/awscliv2.zip

# Install Azure CLI
echo "Installing Azure CLI..."
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
sudo apt-get clean && sudo rm -rf /var/lib/apt/lists/*

# Install Google Cloud SDK
echo "Installing Google Cloud SDK..."
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
retry_command sudo apt-get update
sudo apt-get install -y --no-install-recommends google-cloud-cli
sudo apt-get clean && sudo rm -rf /var/lib/apt/lists/*

# # Create directories for credentials
mkdir -p $HOME/.aws
mkdir -p $HOME/.azure
mkdir -p $HOME/.config/gcloud

# Set proper ownership
chown -R $USER:$USER $HOME/.aws
chown -R $USER:$USER $HOME/.azure
chown -R $USER:$USER $HOME/.config/gcloud

echo "Cloud CLI tools installation complete!"