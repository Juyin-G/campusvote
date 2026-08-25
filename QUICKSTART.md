# Quick Start Guide

This guide will help you get the CampusVote application running locally in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- Git installed

## Step-by-Step Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd campusvote
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

**Edit `.env` and set these required passwords:**

```env
# Change these passwords!
POSTGRES_SUPERUSER_PASSWORD=your_strong_superuser_password_here
POSTGRES_APP_PASSWORD=your_strong_app_password_here

# Update the DATABASE_URL with your POSTGRES_APP_PASSWORD
DATABASE_URL="postgresql://campusvote_app:your_strong_app_password_here@localhost:5433/campusvote_db?schema=public"

# Update MIGRATION_DATABASE_URL with your POSTGRES_SUPERUSER_PASSWORD
MIGRATION_DATABASE_URL="postgresql://postgres:your_strong_superuser_password_here@localhost:5433/campusvote_db?schema=public"

# Also set a strong JWT secret
JWT_SECRET=your_strong_jwt_secret_here
```

**Quick password generation:**

```bash
# Linux/Mac - Generate 3 strong passwords
for i in {1..3}; do openssl rand -base64 32; done

# Windows PowerShell
1..3 | ForEach-Object { [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 })) }
```

### 3. Start Database

```bash
npm run db:up
```

Wait a few seconds for PostgreSQL to initialize. You can check the status with:

```bash
docker ps
```

You should see `campusvote_db` with status "Up" and "healthy".

### 4. Run Migrations

```bash
npm run db:setup
```

This will create all the database tables, functions, and triggers.

### 5. Start the Application

```bash
npm run dev
```

The application will start on http://localhost:3000

### 6. Access the API Documentation

Open your browser and go to:
```
http://localhost:3000/api/docs
```

## Verify Everything Works

### Check Database Connection

```bash
# Connect to the database as the application user
docker exec -it campusvote_db psql -U campusvote_app -d campusvote_db

# Inside psql, list tables:
\dt

# Exit psql:
\q
```

### Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Common Issues

### "POSTGRES_SUPERUSER_PASSWORD must be set"

You forgot to set the passwords in your `.env` file. Edit `.env` and add:
```env
POSTGRES_SUPERUSER_PASSWORD=your_password_here
POSTGRES_APP_PASSWORD=your_other_password_here
```

### "Connection refused" or "ECONNREFUSED"

The database isn't running or isn't ready yet. Try:
```bash
# Check if the container is running
docker ps

# Check the logs
docker logs campusvote_db

# Restart the database
docker compose down
npm run db:up
```

Wait 10-15 seconds for PostgreSQL to fully initialize, then try again.

### "password authentication failed"

The password in your `DATABASE_URL` doesn't match what you set in `POSTGRES_APP_PASSWORD`. Make sure they match exactly.

If you changed the password after starting the database, you need to recreate it:
```bash
docker compose down -v  # WARNING: This deletes all data!
npm run db:up
npm run db:setup
```

### Port 5433 already in use

Another service is using port 5433. Either:
1. Stop the other service
2. Change the port in `docker-compose.yml` (e.g., to `127.0.0.1:5434:5432`)
3. Update your `.env` file to use the new port in `DATABASE_URL`

## Next Steps

- Read [SECURITY-DATABASE.md](SECURITY-DATABASE.md) for security best practices
- Explore the API documentation at http://localhost:3000/api/docs
- Check out the architecture documentation in the repository
- Run tests with `npm test`

## Development Workflow

```bash
# Start development server with auto-reload
npm run dev

# Run linting
npm run lint

# Run tests
npm test

# Stop the database
docker compose down

# Stop and remove all data (fresh start)
docker compose down -v
```

## Getting Help

If you encounter issues:
1. Check the application logs in your terminal
2. Check database logs: `docker logs campusvote_db`
3. Verify your `.env` file has all required variables
4. Make sure Docker is running
5. Try a fresh start: `docker compose down -v && npm run db:up && npm run db:setup`

## Security Reminder

- Never commit your `.env` file
- Use strong, unique passwords
- The database is only accessible from localhost (127.0.0.1)
- For production, see [SECURITY-DATABASE.md](SECURITY-DATABASE.md)
