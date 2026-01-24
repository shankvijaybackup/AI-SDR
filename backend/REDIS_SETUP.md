# Redis Setup Guide for AI-SDR

## Quick Start: Use Upstash (Recommended)

Upstash provides a free Redis instance perfect for development and production.

### Steps

1. **Sign up at Upstash**
   - Go to: <https://upstash.com>
   - Click "Sign Up" (free tier available)
   - Sign in with GitHub or email

2. **Create a Redis Database**
   - Click "Create Database"
   - Name: `ai-sdr-dev`
   - Region: Choose closest to you (e.g., `us-east-1`)
   - Type: Regional (free tier)
   - Click "Create"

3. **Get Connection String**
   - Click on your database
   - Scroll to "REST API" section
   - Copy the "UPSTASH_REDIS_REST_URL"
   - It looks like: `redis://default:password@region.upstash.io:port`

4. **Update .env**

   ```bash
   # Replace this line in backend/.env:
   REDIS_URL=redis://localhost:6379
   
   # With your Upstash URL:
   REDIS_URL=redis://default:your-password@region.upstash.io:port
   ```

5. **Test Connection**

   ```bash
   cd backend
   npm run dev
   
   # Look for in logs:
   # ✅ [Redis] Connected successfully
   # ✅ [Redis] Ready to accept commands
   ```

---

## Alternative: Local Redis (Windows)

If you prefer running Redis locally:

### Option 1: Memurai (Redis for Windows)

```powershell
# Install via winget
winget install Memurai.Memurai.Developer

# Start Memurai
# It runs as a Windows service automatically
```

### Option 2: WSL + Redis

```bash
# In WSL terminal
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo service redis-server start

# Test
redis-cli ping
# Should return: PONG
```

### Option 3: Docker

```bash
# Pull Redis image
docker pull redis:latest

# Run Redis container
docker run -d -p 6379:6379 --name ai-sdr-redis redis:latest

# Test
docker exec -it ai-sdr-redis redis-cli ping
# Should return: PONG
```

---

## Verify Redis is Working

```bash
# Start the backend
cd backend
npm run dev

# In another terminal, test health endpoint
curl http://localhost:4000/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "redis": true,    # ← Should be true
    "database": true,
    "twilio": true,
    "openai": true
  }
}
```

---

## Troubleshooting

### Error: ECONNREFUSED

**Problem:** Can't connect to Redis

**Solution:**

- **Upstash:** Check your REDIS_URL is correct
- **Local:** Ensure Redis/Memurai is running
- **Docker:** Check container is running: `docker ps`

### Error: Authentication failed

**Problem:** Wrong password in REDIS_URL

**Solution:**

- **Upstash:** Copy the full URL from Upstash dashboard
- **Local:** Remove password from URL: `redis://localhost:6379`

### Fallback Mode

If Redis is unavailable, the app automatically falls back to in-memory storage:

```
⚠️  [CallState] Using in-memory fallback for call <callSid>
```

This works for development but won't scale horizontally.

---

## Production Recommendations

1. **Use Upstash** - Managed, reliable, auto-scaling
2. **Enable TLS** - Use `rediss://` (with double 's') for encrypted connections
3. **Set up monitoring** - Upstash provides built-in metrics
4. **Configure backups** - Upstash Pro includes automatic backups

---

## Free Tier Limits

**Upstash Free Tier:**

- 10,000 commands per day
- 256 MB storage
- 1 database
- Perfect for development and small production workloads

**Upgrade when:**

- You exceed 10K commands/day
- You need more storage
- You need multiple databases

**Upstash Pro:** $10/month

- 100K commands/day
- 1 GB storage
- Automatic backups
