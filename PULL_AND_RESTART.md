# Pull Latest Code and Restart Backend

## Problem Solved ✅

The backend was failing because `server.js` and route files were importing files that were never committed to git:
- `backend/routes/signals.js` ✅ Fixed
- `backend/routes/generators.js` ✅ Fixed
- `backend/services/linkedinEnrichment.js` ✅ Fixed
- `backend/services/emailService.js` ✅ Fixed
- `backend/services/scriptGeneration.js` ✅ Fixed
- `backend/middleware/auth.js` ✅ Fixed

All missing files have now been committed (commits `91b39e7` and `5943e54`) and pushed to the repository.

## Quick Fix - Run These Commands on AWS EC2

```bash
# SSH into AWS EC2
ssh -i ~/.ssh/your-key.pem ubuntu@44.200.156.6

# Navigate to project directory
cd ~/AI-SDR/backend

# Pull the latest changes (includes ALL missing files)
git pull origin main

# You should see:
# Updating 35d70c8..5943e54
# Fast-forward
#  backend/routes/generators.js          | 49 +++++++++
#  backend/routes/signals.js             | 18 +++++++++
#  backend/middleware/auth.js            | 156 +++++++++++++++++++
#  backend/services/linkedinEnrichment.js | 876 ++++++++++++++++++++
#  backend/services/emailService.js      | 245 +++++++++++++
#  backend/services/scriptGeneration.js  | 369 +++++++++++++++
#  6 files changed, 1714 insertions(+)

# Restart the backend with PM2
pm2 restart all

# Check PM2 status
pm2 list

# View logs to confirm it's running
pm2 logs ai-sdr-backend --lines 20
```

## Expected Success Output

After `pm2 restart all`, you should see:

```
✅ Backend listening on http://localhost:4000
✅ Created new PrismaClient instance
[Prisma] ✅ Created new PrismaClient instance
```

## Verify Backend is Running

### Test 1: Check from EC2 instance (local)
```bash
curl http://localhost:4000/health
# Should return: {"status":"ok",...}
```

### Test 2: Check from your local machine (external)
```bash
curl http://44.200.156.6:4000/health
# Should return: {"status":"ok",...}
```

## Test Script Generation

Once backend is running, test the lead script generation:

```bash
curl -X POST http://44.200.156.6:4000/api/leads/4633570f-da72-48ee-b7f7-9e32bfa3ce63/script/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## What Was Fixed

1. **Commit a59b68c**: Created shared Prisma client singleton (`lib/prisma.js`)
2. **Commit 35d70c8**: Created lead scripts route with enhanced error logging
3. **Commit 91b39e7**: Added missing `signals.js` and `generators.js` route files
4. **Commit 5943e54**: Added missing service files and middleware ← **THIS FIX**
   - `middleware/auth.js` - Authentication middleware for route protection
   - `services/linkedinEnrichment.js` - LinkedIn profile enrichment
   - `services/emailService.js` - Email sending (invites, password resets)
   - `services/scriptGeneration.js` - AI-powered script generation

## Why This Happened

Multiple files were created locally during development but never committed to git:
- Route files (`signals.js`, `generators.js`)
- Service files (`linkedinEnrichment.js`, `emailService.js`, `scriptGeneration.js`)
- Middleware (`auth.js`)

When you ran `git pull` on the EC2 instance, these files were missing, causing the backend to crash with import errors like:

```
ERR_MODULE_NOT_FOUND: Cannot find module '.../routes/signals.js'
ERR_MODULE_NOT_FOUND: Cannot find module '.../services/linkedinEnrichment.js'
```

## Next Steps

1. SSH into AWS EC2
2. Run `git pull origin main`
3. Run `pm2 restart all`
4. Verify backend is accessible at `http://44.200.156.6:4000/health`
5. Test script generation from frontend

---

**Status**: Ready to pull and restart on AWS EC2
**Latest Commit**: 5943e54 (includes ALL missing files - routes, services, and middleware)
