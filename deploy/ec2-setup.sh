#!/bin/bash
# EC2 Initial Setup Script
# Run this on your fresh EC2 instance after SSH

set -e  # Exit on error

echo "🚀 Starting EC2 setup for AI-SDR backend..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x
echo "📦 Installing Node.js 22.x..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node installation
echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install Nginx
echo "📦 Installing Nginx..."
sudo apt install -y nginx

# Install htop for monitoring
echo "📦 Installing htop..."
sudo apt install -y htop

# Clone repository
echo "📦 Cloning AI-SDR repository..."
cd ~
if [ -d "AI-SDR" ]; then
    echo "⚠️  AI-SDR directory already exists, pulling latest..."
    cd AI-SDR
    git pull origin main
else
    git clone https://github.com/shankvijaybackup/AI-SDR.git
    cd AI-SDR/backend
fi

# Install dependencies
echo "📦 Installing backend dependencies..."
cd ~/AI-SDR/backend
npm install

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ EC2 setup complete!"
echo ""
echo "Next steps:"
echo "1. Create .env file: nano ~/AI-SDR/backend/.env"
echo "2. Copy environment variables from your local .env or Render dashboard"
echo "3. Generate encryption key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo "4. Run deployment script: bash ~/AI-SDR/deploy/start-backend.sh"
echo ""
