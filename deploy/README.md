# AI-SDR Deployment Scripts

Production-ready deployment scripts and configurations for AWS EC2.

## Quick Start

### First Time Setup (Fresh EC2 Instance)

```bash
# On your EC2 instance
sudo ./setup-server.sh
```

### Regular Deployment (Local Machine)

```bash
# From project root
./deploy_full.sh
```

## Files Overview

### Scripts

| Script | Purpose | Run From |
|--------|---------|----------|
| `setup-server.sh` | Initial server setup (Node.js, PM2, Nginx) | EC2 (once) |
| `setup-ssl.sh` | SSL certificate setup with Let's Encrypt | EC2 (once) |
| `setup-monitoring.sh` | CloudWatch monitoring setup | EC2 (optional) |
| `../deploy_full.sh` | Full stack deployment | Local |
| `rollback.sh` | Rollback to previous version | Local or EC2 |

### Configuration Files

| File | Purpose |
|------|---------|
| `nginx_full.conf` | Production Nginx configuration with SSL |
| `config/pm2/production.json` | PM2 process manager configuration |

### Documentation

| File | Purpose |
|------|---------|
| `../DEPLOYMENT.md` | Complete deployment guide |
| `PRE_DEPLOYMENT_CHECKLIST.md` | Pre-deployment checklist |
| `QUICK_REFERENCE.md` | Quick command reference |

## Deployment Workflow

### Initial Setup (One Time)

1. **Setup Server**
   ```bash
   sudo ./setup-server.sh
   ```
   Installs: Node.js, PM2, Nginx, Git, system packages

2. **Configure Environment**
   ```bash
   cp ../backend/.env.production.template ../backend/.env
   cp ../app/.env.production.template ../app/.env.production
   nano ../backend/.env  # Fill in values
   nano ../app/.env.production  # Fill in values
   ```

3. **Deploy Application**
   ```bash
   cd .. && ./deploy_full.sh
   ```

4. **Setup SSL**
   ```bash
   sudo ./setup-ssl.sh
   ```

5. **Setup Monitoring** (Optional)
   ```bash
   sudo ./setup-monitoring.sh
   ```

### Regular Updates

```bash
# From local machine
./deploy_full.sh
```

This will:
- Package and upload code
- Install dependencies
- Run database migrations
- Build frontend
- Restart services
- Run health checks
- Create backup

### Rollback

If deployment fails:
```bash
./deploy/rollback.sh
```

## Environment Variables

### Required Backend Variables

```bash
# Server
PUBLIC_BASE_URL=https://yourdomain.com
FRONTEND_ORIGIN=https://yourdomain.com
NODE_ENV=production

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=rediss://...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# OpenAI
OPENAI_API_KEY=...

# ElevenLabs
ELEVEN_API_KEY=...

# Security
ENCRYPTION_KEY=...  # Generate new 64-char hex
SENTRY_DSN=...
```

### Required Frontend Variables

```bash
# API
NEXT_PUBLIC_API_URL=https://yourdomain.com
BACKEND_API_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...  # Generate new 64-char hex
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://yourdomain.com
```

## Health Checks

```bash
# Backend
curl http://localhost:4000/health
curl https://yourdomain.com/health

# Frontend
curl http://localhost:3000

# PM2 Status
pm2 list

# Nginx Status
sudo systemctl status nginx
```

## Common Issues

### Deployment Fails
```bash
pm2 logs --lines 100
./deploy/rollback.sh
```

### SSL Issues
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Service Won't Start
```bash
pm2 list
pm2 logs ai-sdr-backend --lines 50
pm2 restart all
```

## Cost Estimate

**AWS Costs** (~$40/month):
- EC2 t3.medium: $30/month
- Data transfer: ~$5/month
- CloudWatch: ~$5/month

**External Services** ($50-200/month):
- Neon PostgreSQL: $0-20/month
- Upstash Redis: $0/month (free tier)
- Twilio, OpenAI, ElevenLabs: Pay per use

**Total**: ~$100-150/month

## Support

- **Full Documentation**: See [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **Quick Reference**: See [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Checklist**: See [PRE_DEPLOYMENT_CHECKLIST.md](PRE_DEPLOYMENT_CHECKLIST.md)

---

Ready to deploy? Start with [DEPLOYMENT.md](../DEPLOYMENT.md)
