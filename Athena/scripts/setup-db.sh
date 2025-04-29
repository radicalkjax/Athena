#!/bin/bash

# Setup script for PostgreSQL database for Athena

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Athena PostgreSQL Database Setup ===${NC}"
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker and Docker Compose before running this script.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose before running this script.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env file from .env.example${NC}"
    else
        echo -e "${RED}No .env.example file found. Please create a .env file manually.${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}Starting PostgreSQL and pgAdmin containers...${NC}"
npm run db:start

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
sleep 5

# Create the database
echo -e "${YELLOW}Creating database...${NC}"
npm run db:create

# Initialize the database
echo -e "${YELLOW}Initializing database...${NC}"
npm run init-db

# Run the database test
echo -e "${YELLOW}Testing database...${NC}"
npm run db:test

echo
echo -e "${GREEN}=== Database setup completed successfully ===${NC}"
echo
echo -e "You can access pgAdmin at http://localhost:5050"
echo -e "Email: $(grep PGADMIN_EMAIL .env | cut -d '=' -f2)"
echo -e "Password: $(grep PGADMIN_PASSWORD .env | cut -d '=' -f2)"
echo
echo -e "PostgreSQL connection details:"
echo -e "Host: $(grep DB_HOST .env | cut -d '=' -f2)"
echo -e "Port: $(grep DB_PORT .env | cut -d '=' -f2)"
echo -e "Database: $(grep DB_NAME .env | cut -d '=' -f2)"
echo -e "Username: $(grep DB_USER .env | cut -d '=' -f2)"
echo -e "Password: $(grep DB_PASSWORD .env | cut -d '=' -f2)"
echo
echo -e "${YELLOW}To stop the database:${NC} npm run db:stop"
