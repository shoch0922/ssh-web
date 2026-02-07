.PHONY: help install build start stop restart reload logs logs-next logs-ws status delete clean dev \
       cs-start cs-stop cs-restart cs-logs cs-status

# Variables
NPM := npm
PM2 := npx pm2
ECOSYSTEM := ecosystem.config.js
CODE_SERVER := code-server
CODE_SERVER_PORT := 8080
CODE_SERVER_DIR := /home/shoch0922
CODE_SERVER_LOG := logs/code-server.log
CODE_SERVER_PID := logs/code-server.pid

# Colors for terminal output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)SSH Web Terminal - PM2 Management$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Ports:$(NC)"
	@echo "  Next.js:       http://localhost:50001"
	@echo "  WebSocket:     ws://localhost:50002"
	@echo "  code-server:   http://localhost:$(CODE_SERVER_PORT)"

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	$(NPM) install
	@echo "$(GREEN)Dependencies installed successfully!$(NC)"

build: install ## Build Next.js application
	@echo "$(BLUE)Building Next.js application...$(NC)"
	$(NPM) run build
	@echo "$(GREEN)Build completed successfully!$(NC)"

start: build ## Build and start application with PM2
	@echo "$(BLUE)Starting application with PM2...$(NC)"
	@mkdir -p logs
	$(PM2) start $(ECOSYSTEM)
	@echo "$(GREEN)Application started successfully!$(NC)"
	@echo ""
	@echo "$(GREEN)Access your application at:$(NC)"
	@echo "  http://localhost:50001"
	@echo ""
	@echo "Run 'make logs' to view logs or 'make status' to check status"

stop: ## Stop PM2 processes
	@echo "$(BLUE)Stopping PM2 processes...$(NC)"
	$(PM2) stop $(ECOSYSTEM)
	@echo "$(GREEN)Processes stopped successfully!$(NC)"

restart: ## Restart PM2 processes
	@echo "$(BLUE)Restarting PM2 processes...$(NC)"
	$(PM2) restart $(ECOSYSTEM)
	@echo "$(GREEN)Processes restarted successfully!$(NC)"

reload: ## Reload PM2 processes (zero-downtime)
	@echo "$(BLUE)Reloading PM2 processes...$(NC)"
	$(PM2) reload $(ECOSYSTEM)
	@echo "$(GREEN)Processes reloaded successfully!$(NC)"

logs: ## Show PM2 logs (all processes)
	$(PM2) logs

logs-next: ## Show Next.js logs only
	$(PM2) logs ssh-web-next

logs-ws: ## Show WebSocket server logs only
	$(PM2) logs ssh-web-websocket

status: ## Show PM2 process status
	@echo "$(BLUE)PM2 Process Status:$(NC)"
	@$(PM2) list

delete: stop ## Delete PM2 processes
	@echo "$(BLUE)Deleting PM2 processes...$(NC)"
	$(PM2) delete $(ECOSYSTEM)
	@echo "$(GREEN)Processes deleted successfully!$(NC)"

clean: ## Clean build files and logs
	@echo "$(BLUE)Cleaning build files and logs...$(NC)"
	rm -rf .next
	rm -rf logs/*.log
	@echo "$(GREEN)Clean completed!$(NC)"

dev: ## Start development server (not PM2)
	@echo "$(BLUE)Starting development server...$(NC)"
	@echo "$(YELLOW)Note: This uses the default dev ports (3000, 3002)$(NC)"
	WEBSOCKET_PORT=3002 NEXT_PUBLIC_WEBSOCKET_PORT=3002 $(NPM) run dev

# ─── code-server (nohup daemon) ──────────────────────────────
cs-start: ## Start code-server daemon
	@echo "$(BLUE)Starting code-server as daemon...$(NC)"
	@mkdir -p logs
	@if [ -f $(CODE_SERVER_PID) ] && kill -0 $$(cat $(CODE_SERVER_PID)) 2>/dev/null; then \
		echo "$(YELLOW)code-server is already running (PID: $$(cat $(CODE_SERVER_PID)))$(NC)"; \
	else \
		env -u VSCODE_IPC_HOOK_CLI nohup $(CODE_SERVER) --bind-addr 0.0.0.0:$(CODE_SERVER_PORT) $(CODE_SERVER_DIR) > $(CODE_SERVER_LOG) 2>&1 & \
		echo $$! > $(CODE_SERVER_PID); \
		echo "$(GREEN)code-server started! (PID: $$(cat $(CODE_SERVER_PID)))$(NC)"; \
		echo "  http://localhost:$(CODE_SERVER_PORT)"; \
	fi

cs-stop: ## Stop code-server daemon
	@echo "$(BLUE)Stopping code-server...$(NC)"
	@if [ -f $(CODE_SERVER_PID) ]; then \
		kill $$(cat $(CODE_SERVER_PID)) 2>/dev/null && rm -f $(CODE_SERVER_PID) && \
		echo "$(GREEN)code-server stopped!$(NC)"; \
	else \
		echo "$(YELLOW)No PID file found. code-server may not be running.$(NC)"; \
	fi

cs-restart: cs-stop cs-start ## Restart code-server daemon

cs-logs: ## Show code-server logs
	@tail -f $(CODE_SERVER_LOG)

cs-status: ## Show code-server status
	@if [ -f $(CODE_SERVER_PID) ] && kill -0 $$(cat $(CODE_SERVER_PID)) 2>/dev/null; then \
		echo "$(GREEN)code-server is running (PID: $$(cat $(CODE_SERVER_PID)))$(NC)"; \
	else \
		echo "$(RED)code-server is not running$(NC)"; \
		rm -f $(CODE_SERVER_PID); \
	fi

# Default target
.DEFAULT_GOAL := help
