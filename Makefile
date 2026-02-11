.PHONY: run-core run-web generate install run-core-dev ensure-llm-env

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
# Note: If your main entry point is inside a cmd directory (e.g., cmd/server),
# please update the path below (e.g., 'go run ./cmd/server').
run-core: ensure-llm-env
	cd InsightifyCore && go run ./cmd/api

# Run the Go backend with hot reload
run-core-dev: ensure-llm-env
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
