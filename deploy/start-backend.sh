#!/bin/bash
# Start AI-SDR Backend with PM2
# Run this after setting up .env file

set -e

echo "🚀 Starting AI-SDR backend with PM2..."

# Navigate to backend directory
cd ~/AI-SDR/backend

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Create it with: nano ~/AI-SDR/backend/.env"
    exit 1
fi

# Stop existing PM2 process if running
pm2 stop ai-sdr-backend 2>/dev/null || true
pm2 delete ai-sdr-backend 2>/dev/null || true

# Start with PM2
pm2 start server.js --name ai-sdr-backend

# Save PM2 process list
pm2 save

# Configure PM2 to start on boot (run the command it outputs)
echo "⚠️  Run the following command to enable PM2 on system boot:"
pm2 startup

echo ""
echo "✅ Backend started successfully!"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check status"
echo "  pm2 logs                - View logs"
echo "  pm2 restart all         - Restart app"
echo "  pm2 monit              - Monitor resources"
echo ""
echo "Check logs now:"
pm2 logs ai-sdr-backend --lines 20
