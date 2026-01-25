#!/bin/bash
# Setup Nginx Reverse Proxy
# Run this after editing nginx-config.conf with your EC2 IP

set -e

echo "🔧 Setting up Nginx reverse proxy..."

# Check if nginx-config.conf exists
if [ ! -f ~/AI-SDR/deploy/nginx-config.conf ]; then
    echo "❌ Error: nginx-config.conf not found!"
    echo "Make sure you're in the AI-SDR/deploy directory"
    exit 1
fi

# Check if YOUR_EC2_PUBLIC_IP is still in the config
if grep -q "YOUR_EC2_PUBLIC_IP" ~/AI-SDR/deploy/nginx-config.conf; then
    echo "⚠️  Warning: Please edit nginx-config.conf and replace YOUR_EC2_PUBLIC_IP with your actual EC2 IP or domain"
    echo "Edit with: nano ~/AI-SDR/deploy/nginx-config.conf"
    exit 1
fi

# Copy config to nginx sites-available
echo "📝 Copying Nginx configuration..."
sudo cp ~/AI-SDR/deploy/nginx-config.conf /etc/nginx/sites-available/ai-sdr-backend

# Remove default site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "🗑️  Removing default Nginx site..."
    sudo rm /etc/nginx/sites-enabled/default
fi

# Create symlink to sites-enabled
echo "🔗 Enabling site..."
sudo ln -sf /etc/nginx/sites-available/ai-sdr-backend /etc/nginx/sites-enabled/

# Test configuration
echo "✅ Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "🔄 Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "✅ Nginx setup complete!"
echo ""
echo "Test the backend:"
echo "  curl http://$(curl -s ifconfig.me)/health"
echo ""
