FROM mcr.microsoft.com/devcontainers/universal:2

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Buf CLI used by code generation.
RUN ARCH="$(uname -m)" && \
    curl -fsSL "https://github.com/bufbuild/buf/releases/download/v1.47.2/buf-Linux-${ARCH}" -o /usr/local/bin/buf && \
    chmod +x /usr/local/bin/buf

# Install Go and Node based codegen/dev tools used in this repository.
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && \
    go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest && \
    go install github.com/air-verse/air@latest && \
    npm install -g @bufbuild/protoc-gen-es @connectrpc/protoc-gen-connect-es

ENV PATH="/go/bin:${PATH}"

WORKDIR /workspaces/Insightify

COPY scripts/compose-workspace-init.sh /usr/local/bin/compose-workspace-init.sh
RUN chmod +x /usr/local/bin/compose-workspace-init.sh

CMD ["/usr/local/bin/compose-workspace-init.sh"]
