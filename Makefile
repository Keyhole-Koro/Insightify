.PHONY: run-core run-web generate install run-core-dev

# Run the Go backend server
# Note: If your main entry point is inside a cmd directory (e.g., cmd/server),
# please update the path below (e.g., 'go run ./cmd/server').
run-core:
	cd InsightifyCore && go run ./cmd/api

# Run the Go backend with hot reload
run-core-dev:
	cd InsightifyCore && air

# Run the React frontend
run-web:
	cd InsightifyWeb && npm run dev

# Generate code from Protocol Buffers (assuming buf is used)
generate:
	buf generate

# Install dependencies for both backend and frontend
install:
	cd InsightifyCore && go mod download
	cd InsightifyWeb && npm install