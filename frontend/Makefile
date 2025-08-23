.PHONY: help build run stop clean dev install

help:
	@echo "Available commands:"
	@echo "  make install    - Install npm dependencies"
	@echo "  make dev        - Run development server"
	@echo "  make build      - Build Docker image"
	@echo "  make run        - Run Docker container (with backend network)"
	@echo "  make run-standalone - Run Docker container (standalone)"
	@echo "  make stop       - Stop Docker container"
	@echo "  make clean      - Remove Docker image and container"

install:
	npm install

dev:
	npm run dev

build:
	docker build -t dj-event-frontend .

run:
	docker-compose up -d

run-standalone:
	docker-compose -f docker-compose.standalone.yml up -d

stop:
	docker-compose down

clean:
	docker-compose down --rmi all --volumes
	rm -rf dist node_modules