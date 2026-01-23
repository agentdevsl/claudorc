# Use x86_64 Ubuntu 24.04 for consistent development environment
FROM --platform=linux/amd64 ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies and tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    unzip \
    zsh \
    sudo \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    gnupg2 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install pre-commit
RUN pip3 install --break-system-packages pre-commit

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Create node user with home directory and sudo access
RUN useradd -m -s /bin/zsh node && \
    echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/node && \
    chmod 0440 /etc/sudoers.d/node

# Install Claude Code, ccstatusline, and global TypeScript tools
RUN npm install -g @anthropic-ai/claude-code ccstatusline typescript eslint prettier && \
    npm cache clean --force

# Switch to node user for all user-specific configuration
USER node
WORKDIR /home/node

# Create Claude configuration directory with proper permissions
RUN mkdir -p /home/node/.claude && \
    echo '{"statusLine": "ccstatusline"}' > /home/node/.claude/settings.json && \
    echo '{}' > /home/node/.claude/.claude.json && \
    chmod 700 /home/node/.claude && \
    chmod 600 /home/node/.claude/.claude.json /home/node/.claude/settings.json

# Configure ccstatusline with Powerline enabled
RUN mkdir -p /home/node/.config/ccstatusline && \
    echo '{\
  "version": 3,\
  "lines": [\
    [\
      {\
        "id": "1",\
        "type": "model",\
        "color": "cyan"\
      },\
      {\
        "id": "2",\
        "type": "separator"\
      },\
      {\
        "id": "3",\
        "type": "context-length",\
        "color": "brightBlack"\
      },\
      {\
        "id": "4",\
        "type": "separator"\
      },\
      {\
        "id": "5",\
        "type": "git-branch",\
        "color": "magenta"\
      },\
      {\
        "id": "6",\
        "type": "separator"\
      },\
      {\
        "id": "7",\
        "type": "git-changes",\
        "color": "yellow"\
      }\
    ],\
    [],\
    []\
  ],\
  "flexMode": "full-minus-40",\
  "compactThreshold": 60,\
  "colorLevel": 2,\
  "inheritSeparatorColors": false,\
  "globalBold": false,\
  "powerline": {\
    "enabled": true,\
    "separators": [\
      ""\
    ],\
    "separatorInvertBackground": [\
      false\
    ],\
    "startCaps": [""],\
    "endCaps": [""],\
    "autoAlign": true,\
    "theme": "gruvbox"\
  },\
  "defaultPadding": "     "\
}' > /home/node/.config/ccstatusline/settings.json && \
    chmod 700 /home/node/.config/ccstatusline && \
    chmod 600 /home/node/.config/ccstatusline/settings.json

# Install oh-my-zsh with proper prompt theme and git plugin
# Using zsh-in-docker for consistent setup with base-image
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.2.0/zsh-in-docker.sh)" -- \
        -p git \
        -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
        -x && \
    echo 'alias clauded="claude --dangerously-skip-permissions"' >> /home/node/.zshrc
