.PHONY: run-core run-web run-trace-viewer generate install run-core-dev ensure-llm-env ensure-llm-env-strict build-web build-trace-viewer build

# Ensure at least one LLM provider key exists before running backend.
ensure-llm-env:
	@set -e; \
	if [ -f InsightifyCore/.env ]; then set -a; . InsightifyCore/.env; set +a; fi; \
	if [ -z "$$GEMINI_API_KEY" ] && [ -z "$$GROQ_API_KEY" ]; then \
		echo "No LLM API key found (GEMINI_API_KEY or GROQ_API_KEY)."; \
		echo "Launching interactive setup..."; \
		InsightifyCore/scripts/setup_llm_env.sh; \
	fi

# Run the Go backend server
run-core: ensure-llm-env
	cd InsightifyCore && exec env PORT=8081 go run ./cmd/gateway

# Run the Go backend with hot reload
run-core-dev: ensure-llm-env-strict
	cd InsightifyCore && exec env PORT=8081 air

# Strict check for dev mode: fail fast if no provider key is set.
ensure-llm-env-strict:
	@set -e; \
	if [ -z "$$GEMINI_API_KEY" ] && [ -z "$$GROQ_API_KEY" ]; then \
		echo "API key is required for run-core-dev (export GEMINI_API_KEY or GROQ_API_KEY in your shell)."; \
		exit 1; \
	fi

# Run the React frontend
run-web:
	cd InsightifyWeb && exec npm run dev

# Run the Trace Viewer frontend
run-trace-viewer:
	cd InsightifyTraceViewer && exec npm run dev

# Generate code from Protocol Buffers (assuming buf is used)
generate:
	buf generate

# Install dependencies for both backend and frontend
install:
	cd InsightifyCore && go mod download
	cd InsightifyWeb && npm install
	cd InsightifyTraceViewer && npm install

# Build the React frontend
build-web:
	cd InsightifyWeb && npm run build

# Build the Trace Viewer frontend
build-trace-viewer:
	cd InsightifyTraceViewer && npm run build

# Build all frontend applications
build: build-web build-trace-viewer
