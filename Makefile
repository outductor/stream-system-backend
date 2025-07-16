.PHONY: all build run test clean generate-api db-migrate docker-build docker-up

# Variables
BINARY_NAME=stream-server
DOCKER_COMPOSE=docker-compose

# Build the application
all: generate-api build

build:
	go build -o bin/$(BINARY_NAME) ./cmd/server

# Generate API code from OpenAPI spec
generate-api:
	oapi-codegen -package api -generate types,server,spec api/openapi.yaml > internal/api/generated.go

# Run the application
run: build
	./bin/$(BINARY_NAME)

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f internal/api/generated.go

# Database migrations
db-migrate:
	psql -h localhost -U postgres -d stream_system -f db/schema.sql

# Docker commands
docker-build:
	$(DOCKER_COMPOSE) build

docker-up:
	$(DOCKER_COMPOSE) up -d

docker-down:
	$(DOCKER_COMPOSE) down

# Development with hot reload
dev:
	air

# Install dependencies
deps:
	go mod download
	go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest
	go install github.com/cosmtrek/air@latest