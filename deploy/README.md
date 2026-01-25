# AWS EC2 Deployment Guide

Quick guide for deploying AI-SDR backend to AWS EC2.

## Prerequisites

1. AWS account with free tier eligibility
2. Upstash account (free Redis)
3. SSH client
4. Your Render frontend still running

## Quick Start

### 1. Set Up Upstash Redis (5 min)
1. Go to https://upstash.com and sign up
2. Create new Redis database
3. Choose region: `us-west-2` (closest to AWS Oregon)
4. Copy the connection URL (format: `rediss://default:password@host:port`)
5. Save for later

### 2. Launch EC2 Instance (10 min)
1. AWS Console → EC2 → Launch Instance
2. **Settings**:
   - Name: `ai-sdr-backend`
   - AMI: Ubuntu Server 24.04 LTS
   - Instance type: `t2.micro` (Free tier)
   - Create new key pair → Download `.pem` file
3. **Security Group** - Inbound rules:
   - SSH (22): Your IP only
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0
   - Custom TCP (4000): 0.0.0.0/0
4. Launch and note the public IP

### 3. Connect to EC2
```bash
# Make key file secure
chmod 400 your-key.pem

# Connect
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### 4. Run Setup Script
```bash
# Download and run setup
wget https://raw.githubusercontent.com/shankvijaybackup/AI-SDR/main/deploy/ec2-setup.sh
chmod +x ec2-setup.sh
./ec2-setup.sh
```

**Or clone and run locally**:
```bash
git clone https://github.com/shankvijaybackup/AI-SDR.git
cd AI-SDR/deploy
bash ec2-setup.sh
```

### 5. Configure Environment
```bash
# Copy template
cp ~/AI-SDR/deploy/env.template ~/AI-SDR/backend/.env

# Edit with your values
nano ~/AI-SDR/backend/.env
```

**Required values**:
- `PUBLIC_BASE_URL`: Your EC2 IP (http://YOUR_EC2_IP)
- `DATABASE_URL`: From Neon dashboard
- `REDIS_URL`: From Upstash (step 1)
- `TWILIO_*`: From Twilio console
- `OPENAI_API_KEY`: From OpenAI
- `ELEVEN_*`: From ElevenLabs
- `ENCRYPTION_KEY`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 6. Set Up Nginx
```bash
# Edit nginx config with your EC2 IP
nano ~/AI-SDR/deploy/nginx-config.conf
# Replace YOUR_EC2_PUBLIC_IP with actual IP

# Run setup script
bash ~/AI-SDR/deploy/setup-nginx.sh
```

### 7. Start Backend
```bash
bash ~/AI-SDR/deploy/start-backend.sh
```

### 8. Verify Deployment
```bash
# Check logs
pm2 logs

# Test health endpoint
curl http://<EC2_PUBLIC_IP>/health

# Should see JSON response with status: ok
```

### 9. Update Twilio Webhooks
1. Twilio Console → Phone Numbers → Your number
2. Update webhooks:
   - Voice: `http://<EC2_PUBLIC_IP>/twiml/voice`
   - Status: `http://<EC2_PUBLIC_IP>/twiml/status`
3. Save

### 10. Update Frontend
1. Render Dashboard → ai-sdr-app → Environment
2. Edit `NEXT_PUBLIC_BACKEND_URL`
3. Set to: `http://<EC2_PUBLIC_IP>`
4. Redeploy

## Useful Commands

### PM2 (Process Manager)
```bash
pm2 status              # Check app status
pm2 logs                # View logs
pm2 restart all         # Restart app
pm2 stop all           # Stop app
pm2 monit              # Monitor resources
```

### Nginx
```bash
sudo systemctl status nginx     # Check status
sudo systemctl restart nginx    # Restart
sudo nginx -t                   # Test config
sudo nano /etc/nginx/sites-available/ai-sdr-backend  # Edit config
```

### Deployments (Future Updates)
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Pull latest code
cd ~/AI-SDR/backend
git pull origin main
npm install

# Restart
pm2 restart ai-sdr-backend
pm2 logs
```

### Monitoring
```bash
# System resources
htop

# Disk space
df -h

# Memory
free -h

# Application logs
pm2 logs ai-sdr-backend --lines 100
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
pm2 logs ai-sdr-backend --lines 50

# Try manual start to see errors
cd ~/AI-SDR/backend
node server.js
```

### Can't connect from browser
- Check security group allows port 80 from 0.0.0.0/0
- Check Nginx is running: `sudo systemctl status nginx`
- Check backend is running: `pm2 status`
- Test locally: `curl http://localhost:4000/health`

### Redis connection failed
- Check REDIS_URL in .env is correct
- Test Redis: `redis-cli -u $REDIS_URL ping`
- Check Upstash dashboard for connection string

### Out of memory
```bash
# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Security (Recommended)

### Set up firewall
```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Install fail2ban
```bash
sudo apt install fail2ban
```

### Enable auto-updates
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## SSL Certificate (Optional - Requires Domain)

If you have a domain pointed to your EC2 IP:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

Then update:
- `PUBLIC_BASE_URL` in .env to `https://yourdomain.com`
- Twilio webhooks to use `https://`
- Frontend `NEXT_PUBLIC_BACKEND_URL` to `https://yourdomain.com`

## Cost Estimate

**Free Tier (12 months)**:
- EC2 t2.micro: 750 hours/month = Free
- Data transfer: 15GB/month = Free
- Upstash Redis: 10K commands/day = Free
- **Total: $0/month**

**After 12 Months**:
- EC2 t2.micro: ~$8.50/month
- Data transfer: ~$1-5/month
- **Total: ~$10-15/month**

## Support

If you run into issues:
1. Check logs: `pm2 logs`
2. Check system resources: `htop`
3. Check backend manually: `cd ~/AI-SDR/backend && node server.js`
4. Review full deployment plan: `~/AI-SDR/deploy/../.claude/plans/buzzing-juggling-rainbow.md`

## Next Steps

After successful deployment:
1. Test voice calls thoroughly
2. Monitor for 24 hours
3. Set up CloudWatch alarms (optional)
4. Stop Render backend service
5. Set up automated backups
