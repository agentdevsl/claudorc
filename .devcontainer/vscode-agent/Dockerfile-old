# syntax=docker/dockerfile:1.4

FROM mcr.microsoft.com/devcontainers/base:noble

# Configure apt for better reliability
RUN echo 'Acquire::Retries "3";' > /etc/apt/apt.conf.d/80-retries \
    && echo 'Acquire::http::Timeout "30";' >> /etc/apt/apt.conf.d/80-retries \
    && echo 'Acquire::https::Timeout "30";' >> /etc/apt/apt.conf.d/80-retries

# Install terraform CLI, tflint, terraform-docs, trivy

# Set architecture variable
# Set versions as arguments
ARG TARGETARCH=arm64
ARG TERRAFORM_VERSION="1.13.4"
ARG TERRAFORM_DOCS_VERSION="0.20.0"
ARG TFSEC_VERSION="1.28.14"
ARG TERRASCAN_VERSION="1.19.9"
ARG TFLINT_VERSION="0.59.1"
ARG TFLINT_AWS_RULESET_VERSION="0.23.1"
ARG TFLINT_AZURE_RULESET_VERSION="0.23.0"
ARG TFLINT_GCP_RULESET_VERSION="0.23.1"
ARG INFRACOST_VERSION="0.10.42"
ARG CHECKOV_VERSION="3.2.489"
ARG VAULT_RADAR_VERSION="0.36.0"
ARG INSTALL_VAULT_RADAR="true"

# Install required packages and clean up in same layer
RUN apt-get update || (sleep 5 && apt-get update) || (sleep 10 && apt-get update) \
    && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    curl \
    gnupg \
    git \
    gh \
    jq \
    software-properties-common \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Node.js and GitHub Copilot CLI in one layer
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @github/copilot \
    && npm cache clean --force \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Terraform CLI
# RUN wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null \
#     && echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/hashicorp.list \
#     && apt-get update \
#     && apt-get install -y terraform \
#     && rm -rf /var/lib/apt/lists/*

# Install terraform-docs
# RUN TERRAFORM_DOCS_VERSION=$(curl -s https://api.github.com/repos/terraform-docs/terraform-docs/releases/latest | grep tag_name | cut -d '"' -f 4) \
#     && wget https://github.com/terraform-docs/terraform-docs/releases/download/${TERRAFORM_DOCS_VERSION}/terraform-docs-${TERRAFORM_DOCS_VERSION}-linux-${TARGETARCH}.tar.gz \
#     && tar -xzf terraform-docs-${TERRAFORM_DOCS_VERSION}-linux-${TARGETARCH}.tar.gz \
#     && chmod +x terraform-docs \
#     && mv terraform-docs /usr/local/bin/ \
#     && rm terraform-docs-${TERRAFORM_DOCS_VERSION}-linux-${TARGETARCH}.tar.gz

# Install tflint
# RUN curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash


# Copy library scripts
COPY library-scripts/*.sh /tmp/library-scripts/
# COPY ALPHA library files
#COPY library-scripts/alpha/* /tmp/library-scripts/alpha/
RUN chmod +x /tmp/library-scripts/*.sh

# Install go
# RUN GO_VERSION=1.21.3 \
#     && wget https://go.dev/dl/go${GO_VERSION}.linux-${TARGETARCH}.tar.gz \
#     && tar -xzf go${GO_VERSION}.linux-${TARGETARCH}.tar.gz \
#     && mv go /usr/local/ \
#     && rm go${GO_VERSION}.linux-${TARGETARCH}.tar.gz

# Set Go environment variables
# ENV PATH="/usr/local/go/bin:${PATH}"
# ENV GOPATH="/go"
# ENV PATH="${GOPATH}/bin:${PATH}"

# Install terraform-mcp-server from source
# RUN go install github.com/hashicorp/terraform-mcp-server/cmd/terraform-mcp-server@latest \
#     && mv ${GOPATH}/bin/terraform-mcp-server /usr/local/bin/terraform-mcp-server

USER vscode

# Install all user tools in a single layer to reduce image size
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc \
    && $HOME/.local/bin/uv tool install pre-commit \
    && $HOME/.local/bin/uv tool install specify-cli --from git+https://github.com/github/spec-kit.git \
    && sudo mkdir -p /workspace \
    && sudo chown -R $USER:$USER /workspace \
    && /tmp/library-scripts/cloud-cli-tools.sh \
    && /tmp/library-scripts/terraform-tools.sh \
        "${TERRAFORM_VERSION}" \
        "${TERRAFORM_DOCS_VERSION}" \
        "${TFSEC_VERSION}" \
        "${TERRASCAN_VERSION}" \
        "${TFLINT_VERSION}" \
        "${TFLINT_AWS_RULESET_VERSION}" \
        "${TFLINT_AZURE_RULESET_VERSION}" \
        "${TFLINT_GCP_RULESET_VERSION}" \
        "${INFRACOST_VERSION}" \
        "${CHECKOV_VERSION}" \
        "${VAULT_RADAR_VERSION}" \
        "${INSTALL_VAULT_RADAR}" \
    && sudo rm -rf /tmp/library-scripts

