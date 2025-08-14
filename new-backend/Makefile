.PHONY: build run run-detached stop logs

# Build the image
build:
	docker-compose -f docker-compose.tunnel.yml build

# Run the container
run: build
	docker-compose -f docker-compose.tunnel.yml up

# Run in detached mode
run-detached: build
	docker-compose -f docker-compose.tunnel.yml up -d

# Stop the container
stop:
	docker-compose -f docker-compose.tunnel.yml down

# View logs
logs:
	docker-compose -f docker-compose.tunnel.yml logs -f
