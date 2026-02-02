#!/bin/bash
set -e

echo "=== Installing Go protoc plugins ==="
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest

echo "=== Installing Node.js dependencies for code generation ==="
npm install -g @bufbuild/protoc-gen-es @connectrpc/protoc-gen-connect-es

echo "=== Setting up InsightifyCore ==="
cd /workspaces/Insightify/InsightifyCore
go mod download

echo "=== Setting up InsightifyWeb ==="
cd /workspaces/Insightify/InsightifyWeb
npm install

echo "=== Generating code from schema (if exists) ==="
cd /workspaces/Insightify
if [ -f "buf.gen.yaml" ]; then
    buf generate
fi

echo "=== Setup complete! ==="
