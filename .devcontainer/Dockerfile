FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install Buf CLI
RUN curl -sSL "https://github.com/bufbuild/buf/releases/download/v1.47.2/buf-Linux-$(uname -m)" -o /usr/local/bin/buf && \
    chmod +x /usr/local/bin/buf

# Install protoc-gen-go and connect-go plugins (will be installed via go install in post-create)
