#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Monaco Frontend Tunnel Setup${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Check if credentials.json exists
if [ ! -f "credentials.json" ]; then
    echo -e "${RED}Error: credentials.json not found!${NC}"
    exit 1
fi

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo -e "${RED}Error: config.json not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}Building Docker image...${NC}"
docker-compose -f docker-compose.tunnel.yml build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Build successful!${NC}"
    echo ""
    echo -e "${YELLOW}Starting services...${NC}"
    docker-compose -f docker-compose.tunnel.yml up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Services started successfully!${NC}"
        echo ""
        echo -e "${GREEN}Frontend is now accessible at:${NC}"
        echo -e "  ${YELLOW}Local:${NC} http://localhost:8001"
        echo -e "  ${YELLOW}Tunnel:${NC} https://monaco.ishikabhoyar.tech"
        echo ""
        echo -e "${YELLOW}To view logs:${NC} docker-compose -f docker-compose.tunnel.yml logs -f"
        echo -e "${YELLOW}To stop:${NC} docker-compose -f docker-compose.tunnel.yml down"
    else
        echo -e "${RED}Failed to start services!${NC}"
        exit 1
    fi
else
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi
