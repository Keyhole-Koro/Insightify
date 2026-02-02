.PHONY: run-core run-web generate install

# Run the Go backend server
# Note: If your main entry point is inside a cmd directory (e.g., cmd/server),
# please update the path below (e.g., 'go run ./cmd/server').
run-core:
	cd InsightifyCore && go run ./cmd/api

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