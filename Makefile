.PHONY: run run-core run-web run-trace-viewer run-log-mcp generate install ensure-llm-env ensure-llm-env-strict ensure-db-env build-web build-trace-viewer build reset-dev-data ensure-postgres db-fingerprint list-state list-localstorage list-uiworkspace list-db list-uiworkspace-nodes list-tab-nodes list-tab-node-ids verify-cache-pipeline healthy

# Ensure at least one LLM provider key exists before running backend.
ensure-llm-env:
	@set -e; \
	if [ -f InsightifyCore/.env ]; then set -a; . InsightifyCore/.env; set +a; fi; \
	if [ -z "$$GEMINI_API_KEY" ] && [ -z "$$GROQ_API_KEY" ]; then \
		echo "No LLM API key found (GEMINI_API_KEY or GROQ_API_KEY)."; \
		echo "Launching interactive setup..."; \
		InsightifyCore/scripts/setup_llm_env.sh; \
	fi

# Run backend + frontend together (Ctrl+C stops both)
run: ensure-llm-env ensure-db-env
	@set -e; \
	cleanup() { \
		kill $$core_pid $$web_pid $$viewer_pid 2>/dev/null || true; \
		wait $$core_pid $$web_pid $$viewer_pid 2>/dev/null || true; \
	}; \
	trap cleanup INT TERM EXIT; \
	( $(MAKE) --no-print-directory run-core ) & core_pid=$$!; \
	( cd InsightifyWeb && npm run dev ) & web_pid=$$!; \
	( cd InsightifyTraceViewer && npm run dev ) & viewer_pid=$$!; \
	wait $$core_pid $$web_pid $$viewer_pid

# Enforce one DB source of truth for all local commands.
ensure-db-env:
	@set -e; \
	if [ -f InsightifyCore/.env ]; then set -a; . InsightifyCore/.env; set +a; fi; \
	if [ -z "$$DATABASE_URL" ]; then \
		echo "DATABASE_URL is required."; \
		echo "Example: export DATABASE_URL='postgres://insightify:insightify@localhost:5432/insightify?sslmode=disable'"; \
		exit 1; \
	fi

# Run the Go backend with hot reload.
run-core: ensure-llm-env-strict ensure-postgres ensure-db-env
	cd InsightifyCore && exec env PORT=8081 DATABASE_URL="$$DATABASE_URL" air

# Strict check for dev mode: fail fast if no provider key is set.
ensure-llm-env-strict:
	@set -e; \
	if [ -f InsightifyCore/.env ]; then set -a; . InsightifyCore/.env; set +a; fi; \
	if [ -z "$$GEMINI_API_KEY" ] && [ -z "$$GROQ_API_KEY" ]; then \
		echo "API key is required for run-core (export GEMINI_API_KEY or GROQ_API_KEY in your shell)."; \
		exit 1; \
	fi

# Run the React frontend
run-web:
	cd InsightifyWeb && exec npm run dev

# Run the Trace Viewer frontend
run-trace-viewer:
	cd InsightifyTraceViewer && exec npm run dev

# Run the local log MCP server (stdio transport).
run-log-mcp:
	cd InsightifyLogMCP && exec npm start

# Generate code from Protocol Buffers (assuming buf is used)
generate:
	buf generate

# Install dependencies for both backend and frontend
install:
	cd InsightifyCore && go mod download
	cd InsightifyWeb && npm install
	cd InsightifyTraceViewer && npm install
	cd InsightifyLogMCP && npm install

# Build the React frontend
build-web:
	cd InsightifyWeb && npm run build

# Build the Trace Viewer frontend
build-trace-viewer:
	cd InsightifyTraceViewer && npm run build

# Build all frontend applications
build: build-web build-trace-viewer

# Reset local development data (Core runtime data + docker volumes if available)
reset-dev-data:
	./scripts/reset-dev-data.sh

# Ensure local PostgreSQL container is running.
ensure-postgres:
	@docker compose up -d postgres >/dev/null
	@docker compose exec -T postgres sh -lc 'until pg_isready -U insightify -d insightify >/dev/null 2>&1; do sleep 1; done'

# Print DB fingerprint used by make-side inspection commands.
db-fingerprint: ensure-postgres
	@echo "== db_fingerprint =="
	@docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT current_database() AS database_name, inet_server_addr() AS server_addr, inet_server_port() AS server_port, current_user AS user_name;"

# One-command state inspection:
# - localStorage: prints a browser DevTools snippet
# - uiworkspace: lists workspace/tab rows in PostgreSQL
# - db: lists tables and row estimates
list-state: list-localstorage list-uiworkspace list-db

# Print a DevTools snippet to inspect app-related localStorage keys.
list-localstorage:
	@echo "Open browser DevTools Console and run:"
	@echo "Object.entries(localStorage).filter(([k]) => k.startsWith('insightify.')).map(([k, v]) => ({ key: k, value: v }))"

# List uiworkspace data stored by Core (PostgreSQL-backed).
list-uiworkspace: ensure-postgres db-fingerprint
	@echo "== workspaces =="
	@if docker compose exec -T postgres psql -U insightify -d insightify -Atqc "SELECT to_regclass('public.workspaces') IS NOT NULL" | grep -q t; then \
		docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT workspace_id, project_id, name, active_tab_id, updated_at FROM workspaces ORDER BY updated_at DESC;"; \
	else \
		echo "workspaces table is not found (run core once to migrate schema)."; \
	fi
	@echo ""
	@echo "== workspace_tabs =="
	@if docker compose exec -T postgres psql -U insightify -d insightify -Atqc "SELECT to_regclass('public.workspace_tabs') IS NOT NULL" | grep -q t; then \
		docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT tab_id, workspace_id, title, run_id, order_index, is_pinned, updated_at FROM workspace_tabs ORDER BY workspace_id, order_index;"; \
	else \
		echo "workspace_tabs table is not found (run core once to migrate schema)."; \
	fi

# List uiworkspace tabs with node counts from user_interactions (joined by run_id).
list-uiworkspace-nodes: ensure-postgres db-fingerprint
	@echo "== workspace_tabs with node counts =="
	@if docker compose exec -T postgres psql -U insightify -d insightify -Atqc "SELECT to_regclass('public.workspace_tabs') IS NOT NULL" | grep -q t && \
		docker compose exec -T postgres psql -U insightify -d insightify -Atqc "SELECT to_regclass('public.user_interactions') IS NOT NULL" | grep -q t; then \
		docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT wt.tab_id, wt.workspace_id, wt.title, wt.run_id, COALESCE((SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(ui.nodes::jsonb, '{}'::jsonb))), 0) AS node_count, wt.updated_at FROM workspace_tabs wt LEFT JOIN user_interactions ui ON ui.run_id = wt.run_id ORDER BY wt.workspace_id, wt.order_index;"; \
	else \
		echo "workspace_tabs or user_interactions table is not found (run core once to migrate schema)."; \
	fi

# Show stored nodes JSON for one tab_id.
# Usage: make list-tab-nodes TAB_ID=tab-xxxx
list-tab-nodes: ensure-postgres db-fingerprint
	@if [ -z "$$TAB_ID" ]; then \
		echo "TAB_ID is required. Usage: make list-tab-nodes TAB_ID=tab-xxxx"; \
		exit 1; \
	fi
	@echo "== tab summary =="
	@docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT wt.tab_id, wt.workspace_id, wt.title, wt.run_id, ui.version, COALESCE((SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(ui.nodes::jsonb, '{}'::jsonb))), 0) AS node_count, wt.updated_at FROM workspace_tabs wt LEFT JOIN user_interactions ui ON ui.run_id = wt.run_id WHERE wt.tab_id = '$$TAB_ID';"
	@echo ""
	@echo "== nodes (json) =="
	@docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT COALESCE(jsonb_pretty(ui.nodes::jsonb), '{}'::text) AS nodes_json FROM workspace_tabs wt LEFT JOIN user_interactions ui ON ui.run_id = wt.run_id WHERE wt.tab_id = '$$TAB_ID';"

# Show stored node IDs for one tab_id.
# Usage: make list-tab-node-ids TAB_ID=tab-xxxx
list-tab-node-ids: ensure-postgres db-fingerprint
	@if [ -z "$$TAB_ID" ]; then \
		echo "TAB_ID is required. Usage: make list-tab-node-ids TAB_ID=tab-xxxx"; \
		exit 1; \
	fi
	@echo "== node ids =="
	@docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT keys.node_id FROM workspace_tabs wt LEFT JOIN user_interactions ui ON ui.run_id = wt.run_id LEFT JOIN LATERAL jsonb_object_keys(COALESCE(ui.nodes::jsonb, '{}'::jsonb)) AS keys(node_id) ON TRUE WHERE wt.tab_id = '$$TAB_ID' ORDER BY keys.node_id;"

# List PostgreSQL tables and approximate row counts.
list-db: ensure-postgres db-fingerprint
	@echo "== tables =="
	@docker compose exec -T postgres psql -U insightify -d insightify -c '\dt'
	@echo ""
	@echo "== row_estimates =="
	@docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"

# End-to-end verification for cache/db consistency path.
verify-cache-pipeline: ensure-postgres
	@cd InsightifyCore && RUN_DB_E2E=1 TEST_DATABASE_URL="$${TEST_DATABASE_URL:-postgres://insightify:insightify@localhost:5432/insightify?sslmode=disable}" go test ./internal/gateway/integration -v

# One-shot health check for local cache/db pipeline.
healthy: ensure-db-env ensure-postgres db-fingerprint
	@echo "== config =="
	@echo "DATABASE_URL=$$DATABASE_URL"
	@echo ""
	@echo "== schema_check =="
	@docker compose exec -T postgres psql -U insightify -d insightify -c "SELECT to_regclass('public.workspaces') AS workspaces, to_regclass('public.workspace_tabs') AS workspace_tabs, to_regclass('public.user_interactions') AS user_interactions;"
	@echo ""
	@echo "== pipeline_test =="
	@$(MAKE) --no-print-directory verify-cache-pipeline
	@echo ""
	@echo "== workspace_node_counts =="
	@$(MAKE) --no-print-directory list-uiworkspace-nodes
	@echo ""
	@echo "healthy: OK"
