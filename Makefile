.PHONY: help dev dev-down

ENV_FILE := $(wildcard .env)
COMPOSE := docker compose $(if $(ENV_FILE),--env-file .env,) -f .docker/docker-compose.dev.yml

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start dev environment in detached mode (frontend + backend + postgres)
	$(COMPOSE) up --build -d

dev-down: ## Stop dev environment
	$(COMPOSE) down
