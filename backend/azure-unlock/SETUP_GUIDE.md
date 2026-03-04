# Azure Account Unlock - Complete Setup Guide

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Azure AD Premium P1 or P2 subscription
- [ ] Global Administrator access to Azure AD
- [ ] Node.js 18+ installed
- [ ] Redis installed (or access to Redis Cloud)
- [ ] Twilio account (for SMS) OR SMTP credentials (for email)
- [ ] ManageEngine ServiceDesk (optional, will use mock tickets if not available)

---

## Step 1: Azure AD App Registration (15 minutes)

### 1.1 Create App Registration

1. Login to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **"New registration"**

```
Name: L1-Account-Unlock-Service
Supported account types: Accounts in this organizational directory only (Single tenant)
Redirect URI: (Leave blank for now)
```

4. Click **"Register"**
5. **Copy and save**:
   - Application (client) ID → This is your `AZURE_CLIENT_ID`
   - Directory (tenant) ID → This is your `AZURE_TENANT_ID`

### 1.2 Create Client Secret

1. In your app registration, go to **"Certificates & secrets"**
2. Click **"New client secret"**
3. Description: `L1-Unlock-Service-Secret`
4. Expires: **24 months**
5. Click **"Add"**
6. **IMPORTANT**: Copy the **Value** immediately (you won't see it again!)
   - This is your `AZURE_CLIENT_SECRET`

### 1.3 Grant API Permissions

1. Go to **"API permissions"**
2. Click **"Add a permission"** → **"Microsoft Graph"** → **"Application permissions"**
3. Search and add these permissions:
   - ✅ `User.ReadWrite.All` (to unlock accounts and reset passwords)
   - ✅ `Directory.Read.All` (to read user information)
   - ✅ `AuditLog.Read.All` (to detect lockout events)
   - ✅ `Mail.Send` (to send OTP emails via Graph)

4. Click **"Add permissions"**
5. **CRITICAL**: Click **"Grant admin consent for [Your Organization]"**
   - You need Global Admin rights for this step
   - Wait for all permissions to show "Granted" status

### 1.4 Verify Permissions

Run this command to verify your app has the right permissions:

```bash
# Get access token
curl -X POST https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=https://graph.microsoft.com/.default" \
  -d "grant_type=client_credentials"

# If you get a token, permissions are working!
```

---

## Step 2: Configure Azure AD Lockout Policy (10 minutes)

### Option A: Via Azure Portal (GUI)

1. Go to **Azure Active Directory** → **Security** → **Authentication methods**
2. Click **"Password protection"**
3. Configure:
   - **Lockout threshold**: 5 attempts
   - **Lockout duration in seconds**: 1800 (30 minutes)
   - **Smart lockout**: Enabled
4. Click **"Save"**

### Option B: Via PowerShell (Recommended)

```powershell
# Install Azure AD module if not installed
Install-Module -Name AzureAD -Force

# Connect to Azure AD
Connect-AzureAD

# Set lockout policy
$policy = Get-AzureADPolicy | Where-Object {$_.Type -eq "HomeRealmDiscoveryPolicy"}

# If no policy exists, create one
if (!$policy) {
    $policy = @{
        Definition = @(
            @{
                HomeRealmDiscoveryPolicy = @{
                    SmartLockoutThreshold = 5
                    SmartLockoutDuration = 1800
                    SmartLockoutEnabled = $true
                }
            } | ConvertTo-Json
        )
        DisplayName = "Account Lockout Policy"
        IsOrganizationDefault = $true
    }

    New-AzureADPolicy @policy -Type "HomeRealmDiscoveryPolicy"
}

# Verify
Get-AzureADPolicy | Where-Object {$_.Type -eq "HomeRealmDiscoveryPolicy"} | Select-Object Definition
```

### Verify Lockout Policy is Active

1. Try logging in with wrong password 5 times to a test account
2. On the 5th attempt, you should see: **"Your account is locked"**
3. Check Azure AD sign-in logs to see error code **50053** (Account locked)

---

## Step 3: Set Up Dependencies (10 minutes)

### 3.1 Install Redis

**Option A: Local Redis (for development)**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Verify
redis-cli ping
# Should return: PONG
```

**Option B: Redis Cloud (for production)**
1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create a free database
3. Copy connection details:
   - Host: `redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com`
   - Port: `12345`
   - Password: `your-password`

### 3.2 Set Up Twilio (for SMS OTP)

1. Sign up at [Twilio](https://www.twilio.com/try-twilio)
2. Get a phone number (free trial gives you one)
3. Go to **Account** → **API Keys & Tokens**
4. Copy:
   - Account SID → `TWILIO_ACCOUNT_SID`
   - Auth Token → `TWILIO_AUTH_TOKEN`
   - Your Twilio Phone Number → `TWILIO_PHONE_NUMBER`

**Free Tier Limits**:
- $15 credit (enough for ~500 SMS in India)
- Can only send to verified numbers in trial mode

### 3.3 Set Up SMTP (for Email OTP)

**Option A: Gmail (easiest for testing)**
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Generate an app password
3. Use these settings:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - User: `your-email@gmail.com`
   - Password: `app-password-generated`

**Option B: SendGrid (production)**
1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create API key
3. Use these settings:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - User: `apikey`
   - Password: `your-sendgrid-api-key`

---

## Step 4: Install and Configure Application (5 minutes)

### 4.1 Clone/Download Code

```bash
cd backend/azure-unlock
```

### 4.2 Install Dependencies

```bash
npm install
```

### 4.3 Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env file
nano .env
```

Fill in your credentials:

```env
# Azure AD Configuration
AZURE_TENANT_ID=12345678-1234-1234-1234-123456789abc
AZURE_CLIENT_ID=87654321-4321-4321-4321-abcdef123456
AZURE_CLIENT_SECRET=your-secret-value-here

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# ManageEngine ServiceDesk (optional)
MANAGEENGINE_URL=https://servicedesk.exide.com
MANAGEENGINE_API_KEY=your-api-key

# Application Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 5: Test the Setup (10 minutes)

### 5.1 Start the Server

```bash
npm start
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║   Azure Account Unlock Service                            ║
║   🚀 Server running on http://localhost:3000              ║
╚════════════════════════════════════════════════════════════╝
```

### 5.2 Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "azure-unlock-service",
  "timestamp": "2026-02-09T15:30:00.000Z"
}
```

### 5.3 Test Account Check

```bash
curl -X POST http://localhost:3000/api/azure-unlock/check-account \
  -H "Content-Type: application/json" \
  -d '{"email": "test.user@yourdomain.com"}'
```

Expected response:
```json
{
  "userId": "abc123-def456",
  "email": "test.user@yourdomain.com",
  "displayName": "Test User",
  "accountEnabled": true,
  "locked": false,
  "failedAttempts": 0
}
```

If you get this response, your Azure AD integration is working! ✅

---

## Step 6: Test Complete Flow (20 minutes)

### 6.1 Create a Test User (if needed)

```bash
# Create a test user in Azure AD
az ad user create \
  --display-name "Test Account Unlock" \
  --user-principal-name test.unlock@yourdomain.com \
  --password "TempPassword123!" \
  --force-change-password-next-sign-in false
```

### 6.2 Trigger Account Lockout

```bash
# Run lockout test script
node test-lockout.js test.unlock@yourdomain.com
```

This will attempt 5 failed logins to trigger lockout.

### 6.3 Run Complete End-to-End Test

```bash
# Make test script executable
chmod +x test-api.sh

# Run test
./test-api.sh
```

This will:
1. ✅ Check account status (should show locked)
2. ✅ Unlock account
3. ✅ Send OTP
4. ✅ Verify OTP
5. ✅ Reset password
6. ✅ Create ITSM ticket

### 6.4 Verify in Azure AD

1. Go to Azure Portal → Azure AD → Sign-in logs
2. Filter by user: `test.unlock@yourdomain.com`
3. You should see:
   - Multiple failed sign-ins (error code 50126)
   - Final lockout event (error code 50053)

---

## Step 7: Production Deployment (30 minutes)

### Option A: Deploy to Azure Functions

1. Install Azure Functions Core Tools:
```bash
npm install -g azure-functions-core-tools@4
```

2. Create Function App:
```bash
func init azure-unlock-function --worker-runtime node --language javascript
cd azure-unlock-function
```

3. Create functions for each endpoint
4. Deploy:
```bash
func azure functionapp publish your-function-app-name
```

### Option B: Deploy to Docker + Azure Container Instances

1. Create Dockerfile:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

2. Build and push:
```bash
docker build -t azure-unlock-service .
docker tag azure-unlock-service your-registry.azurecr.io/azure-unlock-service
docker push your-registry.azurecr.io/azure-unlock-service
```

3. Deploy to Azure Container Instances:
```bash
az container create \
  --resource-group your-rg \
  --name azure-unlock-service \
  --image your-registry.azurecr.io/azure-unlock-service \
  --cpu 1 --memory 1 \
  --environment-variables \
    AZURE_TENANT_ID=$AZURE_TENANT_ID \
    AZURE_CLIENT_ID=$AZURE_CLIENT_ID \
  --secure-environment-variables \
    AZURE_CLIENT_SECRET=$AZURE_CLIENT_SECRET \
  --ports 3000
```

### Option C: Deploy to VM (EC2/Azure VM)

```bash
# SSH to your server
ssh ubuntu@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get install redis-server

# Clone/upload your code
git clone your-repo
cd azure-unlock

# Install dependencies
npm install --production

# Set up environment
cp .env.example .env
nano .env  # Fill in your credentials

# Install PM2 for process management
sudo npm install -g pm2

# Start service
pm2 start server.js --name azure-unlock-service
pm2 save
pm2 startup  # Enable auto-start on reboot
```

---

## Step 8: Set Up Monitoring (15 minutes)

### 8.1 Azure Application Insights

```javascript
// Add to server.js
const appInsights = require('applicationinsights');
appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .start();
```

### 8.2 Set Up Alerts

1. Go to Azure Portal → Monitor → Alerts
2. Create alert rules for:
   - High unlock request rate (>10/hour)
   - Failed unlock attempts
   - OTP verification failures
   - API errors (500 errors)

### 8.3 Create Dashboard

Use this Azure Monitor query:
```kusto
AzureDiagnostics
| where Category == "FunctionExecutionLogs"
| where FunctionName == "unlock-account"
| summarize UnlockCount=count() by bin(TimeGenerated, 1h)
| render timechart
```

---

## Troubleshooting

### Issue: "Insufficient privileges to complete the operation"

**Solution**:
1. Verify admin consent was granted for all API permissions
2. Check that you're using Application permissions, not Delegated
3. Wait 5-10 minutes after granting consent

### Issue: OTP not received

**SMS**:
- Check Twilio console logs
- Verify phone number format: `+[country code][number]`
- In trial mode, verify the recipient number is verified in Twilio

**Email**:
- Check spam folder
- Verify SMTP credentials
- Enable "Less secure app access" if using Gmail (or use app password)

### Issue: Account unlocked but user still can't login

**Solution**:
- Azure AD may cache lockout for 2-3 minutes
- Have user clear browser cache/cookies
- Try incognito/private browsing mode
- Wait 5 minutes and try again

### Issue: Redis connection failed

**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it
brew services start redis  # macOS
sudo systemctl start redis  # Linux
```

---

## Security Best Practices

1. **Never commit `.env` file** to git
2. **Use Azure Key Vault** for production secrets
3. **Enable IP whitelisting** on your API
4. **Implement rate limiting** (already built-in)
5. **Monitor for suspicious activity**:
   - Multiple unlock requests from same IP
   - Unlock requests outside business hours
   - High OTP failure rates
6. **Rotate credentials** every 90 days
7. **Use managed identity** when deploying to Azure
8. **Enable audit logging** for all actions

---

## Support

For issues or questions:
- Check logs: `pm2 logs azure-unlock-service`
- Review Azure AD sign-in logs
- Check Redis: `redis-cli monitor`
- Test Twilio: https://www.twilio.com/console/sms/logs

---

## Success Checklist

- [ ] Azure AD app created with correct permissions
- [ ] Lockout policy configured (5 attempts, 30 min)
- [ ] Redis running and accessible
- [ ] Twilio/SMTP configured and tested
- [ ] Environment variables set correctly
- [ ] Health endpoint returns 200 OK
- [ ] Can check account status via API
- [ ] Lockout test triggers account lock
- [ ] Unlock API successfully unlocks account
- [ ] OTP received via SMS/email
- [ ] OTP verification works
- [ ] Password reset successful
- [ ] ITSM ticket created
- [ ] Monitoring and alerts configured

**Congratulations! Your Azure Account Unlock automation is live! 🎉**
