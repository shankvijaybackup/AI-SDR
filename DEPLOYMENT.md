# AI-SDR Production Deployment Guide

Complete guide for deploying AI-SDR to AWS EC2 in production.

## Prerequisites

- AWS Account with EC2 access
- Domain name pointed to EC2 Elastic IP
- SSH key for EC2 access
- Environment variables configured

## Architecture Overview

```
Internet → Domain (SSL) → Nginx → [Frontend (Next.js :3000) | Backend (Express :4000)]
                                   ↓                          ↓
                                   Neon PostgreSQL      Upstash Redis
                                   External APIs (Twilio, OpenAI, etc.)
```

## Quick Start (2-3 Days)

### Day 1: Initial Deployment

#### 1. Prepare Environment Variables

**Backend** (`backend/.env.production`):
```bash
# Copy template
cp backend/.env.production.template backend/.env.production

# Edit and fill in values
nano backend/.env.production
```

Required variables:
- `PUBLIC_BASE_URL=https://yourdomain.com`
- `FRONTEND_ORIGIN=https://yourdomain.com`
- `DATABASE_URL` (from Neon)
- `REDIS_URL` (from Upstash)
- `TWILIO_*` credentials
- `OPENAI_API_KEY`
- `ELEVEN_API_KEY`
- `ENCRYPTION_KEY` (generate new)

**Frontend** (`app/.env.production`):
```bash
# Copy template
cp app/.env.production.template app/.env.production

# Edit and fill in values
nano app/.env.production
```

Required variables:
- `NEXT_PUBLIC_API_URL=https://yourdomain.com`
- `DATABASE_URL` (same as backend)
- `JWT_SECRET` (generate new)

#### 2. Deploy Application

From your local machine:

```bash
# Set environment variables
export EC2_IP="100.53.57.27"
export EC2_USER="ubuntu"
export KEY_PATH="$HOME/Downloads/ai-sdr-key.pem"

# Run deployment
./deploy_full.sh
```

What this does:
- Packages backend and frontend
- Uploads to EC2
- Installs dependencies
- Builds Next.js
- Starts services with PM2
- Creates backup of previous version
- Runs health checks

**Expected time:** 5-10 minutes

#### 3. Verify Deployment

```bash
# Check services are running
ssh -i $KEY_PATH $EC2_USER@$EC2_IP "pm2 list"

# Check backend health
curl http://$EC2_IP:4000/health

# Check frontend
curl http://$EC2_IP:3000
```

### Day 2: SSL & Production Hardening

#### 1. Setup Elastic IP (Optional but Recommended)

```bash
# Allocate Elastic IP
aws ec2 allocate-address --domain vpc

# Note the AllocationId, then associate
aws ec2 associate-address \
  --instance-id i-your-instance-id \
  --allocation-id eipalloc-xxxxx
```

Update `EC2_IP` in your deployment scripts to use the Elastic IP.

#### 2. Configure DNS

Point your domain to the Elastic IP:

```
A Record: yourdomain.com → Elastic IP
A Record: www.yourdomain.com → Elastic IP
```

Wait 5-10 minutes for DNS propagation.

#### 3. Setup SSL

SSH to server and run SSL setup:

```bash
ssh -i $KEY_PATH $EC2_USER@$EC2_IP

# Run SSL setup script
sudo /home/ubuntu/AI-SDR/deploy/setup-ssl.sh
```

Follow the prompts:
- Enter domain name
- Enter email for Let's Encrypt notifications
- Confirm setup

The script will:
- Install Certbot
- Obtain SSL certificate
- Configure Nginx with SSL
- Setup auto-renewal

**Expected time:** 5 minutes

#### 4. Update Environment Variables for HTTPS

Edit environment files on server:

```bash
# Backend
nano /home/ubuntu/AI-SDR/backend/.env
# Update: PUBLIC_BASE_URL=https://yourdomain.com

# Frontend
nano /home/ubuntu/AI-SDR/frontend/.env.production
# Update: NEXT_PUBLIC_API_URL=https://yourdomain.com

# Restart services
pm2 restart all
```

#### 5. Update Twilio Webhooks

In Twilio Console, update webhook URLs:
- Voice URL: `https://yourdomain.com/api/twilio/voice`
- Status Callback: `https://yourdomain.com/api/twilio/status`

#### 6. Setup Monitoring (Optional)

```bash
sudo /home/ubuntu/AI-SDR/deploy/setup-monitoring.sh
```

This installs CloudWatch agent for:
- CPU, Memory, Disk metrics
- Application logs
- Nginx logs
- Automated alarms

**Expected time:** 10 minutes

### Day 3: Testing & Go-Live

#### 1. Integration Testing

Test all critical flows:

```bash
# Test HTTPS
curl https://yourdomain.com/health

# Test WebSocket (from browser console)
const ws = new WebSocket('wss://yourdomain.com/twilio-realtime-voice');
```

Manual testing checklist:
- [ ] User registration/login
- [ ] Lead import
- [ ] Voice call initiation
- [ ] Call transcription
- [ ] Email notifications
- [ ] WebSocket connection stability

#### 2. Load Testing (Optional)

```bash
# Install hey if needed
go install github.com/rakyll/hey@latest

# Test API endpoints
hey -n 1000 -c 10 https://yourdomain.com/health

# Monitor during test
pm2 monit
```

#### 3. Production Cutover

If using staging:
```bash
# Update DNS to production IP
# Monitor for issues
# Keep staging available for rollback
```

## Ongoing Operations

### Deploying Updates

```bash
# From local machine
./deploy_full.sh
```

The script automatically:
- Creates backup before deployment
- Runs health checks after deployment
- Keeps last 5 backups

### Rollback

If deployment fails:

```bash
# From local machine
ssh -i $KEY_PATH $EC2_USER@$EC2_IP "sudo /home/ubuntu/AI-SDR/deploy/rollback.sh"
```

Or manually on server:

```bash
cd /home/ubuntu/AI-SDR/backups
ls -lt  # Find backup to restore
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz -C /home/ubuntu/AI-SDR
cd /home/ubuntu/AI-SDR/backend && npm ci && npx prisma generate
cd /home/ubuntu/AI-SDR/frontend && npm ci && npm run build
pm2 restart all
```

### Monitoring

#### Check Application Status

```bash
# PM2 status
ssh -i $KEY_PATH $EC2_USER@$EC2_IP "pm2 list"

# View logs
ssh -i $KEY_PATH $EC2_USER@$EC2_IP "pm2 logs ai-sdr-backend --lines 50"
ssh -i $KEY_PATH $EC2_USER@$EC2_IP "pm2 logs ai-sdr-frontend --lines 50"

# Nginx logs
ssh -i $KEY_PATH $EC2_USER@$EC2_IP "sudo tail -f /var/log/nginx/ai-sdr-error.log"
```

#### CloudWatch (if configured)

- View metrics: AWS Console → CloudWatch → Metrics
- View logs: AWS Console → CloudWatch → Log Groups
- Check alarms: AWS Console → CloudWatch → Alarms

### SSL Certificate Renewal

Automatic renewal is configured. To test:

```bash
ssh -i $KEY_PATH $EC2_USER@$EC2_IP
sudo certbot renew --dry-run
```

Certificates auto-renew 30 days before expiration.

### Database Migrations

When schema changes:

```bash
ssh -i $KEY_PATH $EC2_USER@$EC2_IP
cd /home/ubuntu/AI-SDR/backend
npx prisma migrate deploy
pm2 restart ai-sdr-backend
```

### Backup Database

```bash
# Create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore backup
psql $DATABASE_URL < backup-YYYYMMDD.sql
```

## Troubleshooting

### Services Won't Start

```bash
# Check PM2 logs
pm2 logs --lines 100

# Common issues:
# - Missing environment variables
# - Database connection issues
# - Port already in use
# - Node version mismatch

# Restart services
pm2 restart all

# If still failing, check system resources
df -h  # Disk space
free -m  # Memory
top  # CPU usage
```

### SSL Issues

```bash
# Test SSL configuration
sudo nginx -t

# Check certificate
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --force-renewal

# Reload Nginx
sudo systemctl reload nginx
```

### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection string format
echo $DATABASE_URL

# Verify Neon database is active
# Login to Neon console and check status
```

### High Memory Usage

```bash
# Check memory
free -m

# Restart services
pm2 restart all

# If persistent, reduce PM2 instances
pm2 scale ai-sdr-backend 1

# Or increase EC2 instance size
# Current: t3.medium (4GB RAM)
# Upgrade to: t3.large (8GB RAM)
```

### WebSocket Connection Issues

```bash
# Check Nginx WebSocket configuration
sudo nginx -t

# Test WebSocket endpoint
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://yourdomain.com/twilio-realtime-voice

# Check backend logs for WebSocket errors
pm2 logs ai-sdr-backend | grep -i websocket
```

## Security Checklist

- [ ] SSL certificate installed and auto-renewing
- [ ] Environment variables secured (chmod 600)
- [ ] Firewall configured (allow 80, 443, 22 only)
- [ ] Rate limiting enabled in backend
- [ ] Sentry configured for error tracking
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] Database backups automated
- [ ] SSH key-based authentication only (no passwords)

## Performance Optimization

### Enable PM2 Cluster Mode

Edit `deploy/config/pm2/production.json`:
```json
{
  "apps": [{
    "name": "ai-sdr-backend",
    "instances": "max",  // Use all CPU cores
    "exec_mode": "cluster"
  }]
}
```

### Add CDN (Future)

For static assets:
- Setup CloudFront distribution
- Point to EC2 origin
- Cache static files

### Database Optimization

- Add indexes for frequently queried fields
- Use connection pooling (already configured in Prisma)
- Consider read replicas for high load

## Cost Optimization

Current monthly costs (~$100-150):
- EC2 t3.medium: $30/month
- Data transfer: ~$5/month
- CloudWatch: ~$5/month
- External services: $50-100/month (usage-based)

Ways to reduce costs:
1. Use Reserved Instances (save 30-40%)
2. Optimize CloudWatch log retention
3. Use S3 for static file storage instead of EC2
4. Monitor and optimize API usage

## Scaling Guide

When to scale:
- CPU > 70% sustained
- Memory > 80% sustained
- Response times > 1 second
- Concurrent calls > 10

### Vertical Scaling (Easiest)

Upgrade EC2 instance:
```bash
# Stop instance
aws ec2 stop-instances --instance-ids i-xxxxx

# Change instance type
aws ec2 modify-instance-attribute \
  --instance-id i-xxxxx \
  --instance-type t3.large

# Start instance
aws ec2 start-instances --instance-ids i-xxxxx
```

### Horizontal Scaling (Better)

1. Setup Application Load Balancer
2. Create Auto Scaling Group (2-5 instances)
3. Use shared session store (already using Redis)
4. Migrate to RDS for better database performance

See `SCALING.md` for detailed guide (create if needed).

## Support

- Documentation: This file
- Logs: `pm2 logs` or CloudWatch
- Errors: Sentry dashboard
- Infrastructure: AWS Console

## Next Steps

After successful deployment:
1. Week 2-3: Add load balancer and auto-scaling
2. Week 4: Enhanced monitoring and alerting
3. Month 2: Infrastructure as Code (Terraform)
4. Month 3: CI/CD pipeline (GitHub Actions)

---

**Last Updated:** 2026-02-04
**Version:** 1.0
