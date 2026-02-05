.PHONY: dev dev-db dev-app stop clean logs db-shell

# Start everything (database + app)
dev: dev-db dev-app

# Start PostgreSQL in Docker
dev-db:
	@if [ ! "$$(docker ps -q -f name=obws-postgres)" ]; then \
		if [ "$$(docker ps -aq -f name=obws-postgres)" ]; then \
			echo "Starting existing obws-postgres container..."; \
			docker start obws-postgres; \
		else \
			echo "Creating new obws-postgres container..."; \
			docker run -d --name obws-postgres \
				-e POSTGRES_PASSWORD=postgres \
				-e POSTGRES_DB=obws \
				-p 5432:5432 \
				postgres:16; \
		fi; \
		echo "Waiting for PostgreSQL to be ready..."; \
		sleep 2; \
	else \
		echo "obws-postgres is already running"; \
	fi

# Start Next.js dev server
dev-app:
	pnpm dev

# Stop the database container
stop:
	@docker stop obws-postgres 2>/dev/null || true
	@echo "Database stopped"

# Remove the database container and data
clean:
	@docker rm -f obws-postgres 2>/dev/null || true
	@echo "Database container removed"

# View database logs
logs:
	docker logs -f obws-postgres

# Open psql shell
db-shell:
	docker exec -it obws-postgres psql -U postgres -d obws

# Generate Payload types
types:
	pnpm payload generate:types

# Build for production
build:
	pnpm build
