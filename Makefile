.PHONY: dev dev-db dev-app stop clean logs db-shell

# Start everything (database + app)
dev:
	pnpm dev

# Start PostgreSQL and Mailpit in Docker
dev-db:
	docker compose up -d

# Start Next.js dev server
dev-app:
	pnpm dev

# Stop the database container and mailpit
stop:
	docker compose stop
	@echo "Services stopped"

# Remove the containers and data volumes
clean:
	docker compose down -v
	@echo "Services and data volumes removed"

# View logs
logs:
	docker compose logs -f

# Open psql shell
db-shell:
	docker exec -it obws-postgres psql -U postgres -d obws

# Generate Payload types
types:
	pnpm payload generate:types

# Build for production
build:
	pnpm build
