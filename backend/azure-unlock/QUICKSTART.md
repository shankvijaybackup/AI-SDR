# 🚀 Quick Start Guide - 15 Minutes to Running System

This guide gets you from zero to a working Azure account unlock system in 15 minutes.

## Prerequisites (5 minutes)

You need:
1. **Azure AD Premium P1/P2** (required for lockout policies)
2. **Global Admin** access to Azure AD
3. **Node.js 18+** installed
4. **Redis** (or use free Redis Cloud)
5. One of: **Twilio account** (free) OR **Gmail** (for SMTP)

---

## Quick Setup (10 minutes)

### 1. Create Azure App (3 minutes)

```bash
# Login to Azure
az login

# Create app registration
az ad app create \
  --display-name "L1-Account-Unlock" \
  --sign-in-audience AzureADMyOrg

# Copy the appId (this is your AZURE_CLIENT_ID)
# Copy the tenant (this is your AZURE_TENANT_ID)

# Create service principal
az ad sp create --id YOUR_APP_ID

# Create client secret
az ad app credential reset --id YOUR_APP_ID
# Copy the password (this is your AZURE_CLIENT_SECRET)

# Grant permissions
az ad app permission add --id YOUR_APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    df021288-bdef-4463-88db-98f22de89214=Role \
    7ab1d382-f21e-4acd-a863-ba3e13f7da61=Role \
    b0afded3-3588-46d8-8b3d-9842eff778da=Role \
    e383f46e-2787-4529-855e-0e479a3ffac0=Role

# Grant admin consent
az ad app permission admin-consent --id YOUR_APP_ID
```

### 2. Install & Configure (2 minutes)

```bash
# Navigate to directory
cd backend/azure-unlock

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
# Azure
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Redis (local for testing)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Gmail for OTP (use app password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# JWT Secret (generate random)
JWT_SECRET=$(openssl rand -hex 32)

# Config
PORT=3000
NODE_ENV=development
OTP_EXPIRY_SECONDS=300
EOF

# Edit with your actual values
nano .env
```

### 3. Start Services (2 minutes)

```bash
# Start Redis (if using local)
redis-server &

# Start the unlock service
npm start
```

You should see:
```
🚀 Server running on http://localhost:3000
```

### 4. Test It! (3 minutes)

**A. Check health:**
```bash
curl http://localhost:3000/health
```

**B. Check a user account:**
```bash
curl -X POST http://localhost:3000/api/azure-unlock/check-account \
  -H "Content-Type: application/json" \
  -d '{"email": "user@yourdomain.com"}'
```

If this works, you're ready! ✅

---

## Test Complete Flow

### Create a test lockout:

```bash
# 1. Trigger lockout (5 wrong password attempts)
node test-lockout.js test.user@yourdomain.com

# 2. Wait 30 seconds for Azure to process

# 3. Run unlock automation
curl -X POST http://localhost:3000/api/azure-unlock/unlock \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.user@yourdomain.com",
    "requestedBy": "Test Script"
  }'

# You'll get response with OTP and ticket ID
```

### Full automated test:

```bash
chmod +x test-api.sh
./test-api.sh
```

---

## What You Just Built

✅ **Real-time account unlock** via Microsoft Graph API
✅ **OTP delivery** via SMS (Twilio) or Email (SMTP)
✅ **Password reset** with MFA verification
✅ **ITSM ticketing** (ManageEngine or mock)
✅ **Rate limiting** and security controls
✅ **Audit logging** for compliance

---

## Architecture Overview

```
┌─────────────┐
│ Azure AD    │ ← Lockout Policy (5 attempts)
└──────┬──────┘
       │ Microsoft Graph API
       ↓
┌─────────────────────────────────────────┐
│  Azure Unlock Service (Node.js)         │
│  • Detects lockout (polling/webhook)    │
│  • Unlocks account                      │
│  • Generates OTP                        │
│  • Creates ticket                       │
│  • Verifies OTP                         │
│  • Resets password                      │
└─────────────────────────────────────────┘
       ↓             ↓             ↓
   [Redis]      [Twilio/SMTP]  [ManageEngine]
   OTP Store     Send OTP       Create Ticket
```

---

## API Endpoints You Have

```
POST /api/azure-unlock/check-account
  - Check if account is locked
  - Get failed login attempts

POST /api/azure-unlock/unlock
  - Unlock account
  - Send OTP
  - Create ticket

POST /api/azure-unlock/verify-otp
  - Verify OTP code
  - Get password reset token

POST /api/azure-unlock/reset-password
  - Reset user password
  - Complete flow

GET /api/azure-unlock/locked-accounts
  - List all locked accounts (admin)
```

---

## Real-World Usage Example

**Scenario**: Sarah's account locked after 5 failed login attempts

```bash
# 1. Sarah calls IT helpdesk
# 2. Agent or AI bot triggers unlock:

curl -X POST https://your-domain.com/api/azure-unlock/unlock \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah@exide.com",
    "requestedBy": "IT Agent - John"
  }'

# 3. System responds in 2-3 seconds:
{
  "success": true,
  "unlocked": true,
  "ticket": {
    "ticketId": "INC-2026-123456",
    "status": "Open"
  },
  "otp": {
    "sent": true,
    "method": "sms",
    "expiresIn": 300
  }
}

# 4. Sarah receives SMS:
"Your account was unlocked. OTP: 847392. Valid for 5 minutes."

# 5. Sarah enters OTP in self-service portal:
curl -X POST https://your-domain.com/api/azure-unlock/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah@exide.com", "otp": "847392"}'

# 6. Sarah sets new password:
curl -X POST https://your-domain.com/api/azure-unlock/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "resetToken": "...",
    "newPassword": "NewSecureP@ssw0rd!"
  }'

# 7. Done! Total time: 2 minutes (vs 30 minutes manual)
```

---

## Production Checklist

Before going live:

- [ ] Move secrets to Azure Key Vault
- [ ] Set up production Redis (Azure Cache for Redis)
- [ ] Configure Twilio with production number
- [ ] Set up ManageEngine API integration
- [ ] Enable Application Insights monitoring
- [ ] Configure Azure Front Door / API Gateway
- [ ] Set up auto-scaling
- [ ] Create runbooks for common issues
- [ ] Train L1 agents on new process
- [ ] Set up Slack/Teams notifications

---

## Next Steps

1. **Build Self-Service Portal** - Let users unlock themselves
2. **Add Chatbot Integration** - Integrate with Slack/Teams/Web chat
3. **Implement Webhooks** - Real-time lockout detection (vs polling)
4. **Add Analytics** - Track unlock rates, success rates, time saved
5. **Extend to Other Use Cases** - Apply same pattern to password resets, group access, etc.

---

## Common Issues & Fixes

**"Insufficient privileges"**
```bash
# Re-grant admin consent
az ad app permission admin-consent --id YOUR_APP_ID
```

**"Redis connection refused"**
```bash
# Start Redis
redis-server &
redis-cli ping  # Should return PONG
```

**"OTP not received"**
```bash
# Check Twilio logs
# Or use email fallback in .env
```

**"Account still locked after unlock"**
```bash
# Wait 2-3 minutes for Azure cache to clear
# Or have user try incognito mode
```

---

## Monitoring Commands

```bash
# Watch logs
pm2 logs azure-unlock-service

# Monitor Redis
redis-cli monitor

# Check API health
watch -n 5 'curl -s http://localhost:3000/health | jq .'

# View locked accounts
curl http://localhost:3000/api/azure-unlock/locked-accounts | jq .
```

---

## Cost Breakdown (for 4,000 users)

| Service | Monthly Cost |
|---------|--------------|
| Azure AD Premium P1 | $6/user = $24,000 |
| Twilio SMS (400 OTPs) | $3 |
| Azure Redis Cache (Basic) | $17 |
| Azure Container Instance | $35 |
| **Total** | **~$24,055/month** |

**ROI Calculation:**
- Manual unlock: 30 min × $25/hour = $12.50 per incident
- Automated: $3 per incident
- Savings: $9.50 per incident
- Break-even: ~2,530 incidents/month
- Actual: ~400 incidents/month (10% lockout rate)
- **Annual savings**: ~$45,600

---

## Support

**Issues?** Check these files:
- `README.md` - Full documentation
- `SETUP_GUIDE.md` - Detailed setup steps
- `backend/azure-unlock/*.js` - Source code with comments

**Still stuck?** Common causes:
1. Admin consent not granted → Run `az ad app permission admin-consent`
2. Wrong API permissions → Must be Application permissions, not Delegated
3. Lockout policy not configured → Check Azure AD settings
4. Redis not running → `brew services start redis`

---

🎉 **You're all set! Your L1 automation is ready to save your team hundreds of hours!**

**Next**: Run `./test-api.sh` to see the complete flow in action.
