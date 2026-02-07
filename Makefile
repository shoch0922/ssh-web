.PHONY: help install build start stop restart reload logs logs-next logs-ws status delete clean dev

# Variables
NPM := npm
PM2 := pm2
ECOSYSTEM := ecosystem.config.js

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

# Default target
.DEFAULT_GOAL := help
