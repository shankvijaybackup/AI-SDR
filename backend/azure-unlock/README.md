# Azure Account Unlock - Real Production Implementation

## Overview
This is a **production-ready** Azure AD account unlock automation system that:
1. Detects locked accounts via Microsoft Graph API
2. Unlocks the account automatically
3. Creates a ticket in your ITSM system
4. Sends OTP to user's registered mobile/email
5. Allows user to set a new password securely

## Architecture

```
User Locked Out (5 failed attempts)
         ↓
Azure AD Lockout Policy Triggered
         ↓
Webhook/Polling detects lockout
         ↓
AI Agent analyzes and decides
         ↓
Microsoft Graph API - Unlock Account
         ↓
Create ITSM Ticket (ManageEngine/ServiceNow)
         ↓
Generate & Send OTP (SMS/Email)
         ↓
User receives OTP & resets password
         ↓
Account fully restored
```

## Prerequisites

### 1. Azure AD Setup
You need:
- Azure AD Premium P1 or P2 (for lockout policies)
- Global Administrator or User Administrator role
- App Registration with Microsoft Graph API permissions

### 2. Required Microsoft Graph API Permissions
- `User.ReadWrite.All` (to unlock accounts and reset passwords)
- `Directory.Read.All` (to read user info)
- `AuditLog.Read.All` (to detect lockout events)
- `Mail.Send` (to send OTP emails)

### 3. Environment Variables
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-app-client-id
AZURE_CLIENT_SECRET=your-app-client-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-smtp-password
```

## Installation

```bash
cd backend/azure-unlock
npm install
```

## Configuration Steps

### Step 1: Create Azure AD App Registration
1. Go to Azure Portal → Azure Active Directory → App registrations
2. Click "New registration"
3. Name: "L1-Account-Unlock-Service"
4. Supported account types: "Accounts in this organizational directory only"
5. Click "Register"

### Step 2: Configure API Permissions
1. Go to "API permissions"
2. Click "Add a permission" → "Microsoft Graph" → "Application permissions"
3. Add these permissions:
   - `User.ReadWrite.All`
   - `Directory.Read.All`
   - `AuditLog.Read.All`
   - `Mail.Send`
4. Click "Grant admin consent" (requires Global Administrator)

### Step 3: Create Client Secret
1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Description: "L1-Unlock-Service"
4. Expires: 24 months
5. Copy the secret value (you won't see it again!)

### Step 4: Configure Azure AD Lockout Policy
1. Go to Azure Portal → Azure AD → Security → Authentication methods
2. Click "Password protection"
3. Configure:
   - **Lockout threshold**: 5 attempts
   - **Lockout duration**: 30 minutes (1800 seconds)
   - **Smart lockout**: Enabled

Alternative (PowerShell):
```powershell
# Connect to Azure AD
Connect-AzureAD

# Set lockout policy
Set-AzureADMSAuthenticationMethodPolicy -Id "LockoutPolicy" `
  -LockoutThreshold 5 `
  -LockoutDurationInSeconds 1800
```

## Usage

### Start the Service

```bash
npm run start:unlock-service
```

### API Endpoints

#### 1. Check Account Status
```bash
POST /api/azure-unlock/check-account
Content-Type: application/json

{
  "email": "user@exide.com"
}

Response:
{
  "locked": true,
  "userId": "abc123-def456-ghi789",
  "lastSignIn": "2026-02-09T10:30:00Z",
  "failedAttempts": 5,
  "lockoutTime": "2026-02-09T10:35:00Z"
}
```

#### 2. Unlock Account (Automatic)
```bash
POST /api/azure-unlock/unlock
Content-Type: application/json

{
  "email": "user@exide.com",
  "requestedBy": "AI Agent",
  "reason": "User locked out after 5 failed attempts"
}

Response:
{
  "success": true,
  "unlocked": true,
  "ticketId": "INC-2026-001234",
  "otpSent": true,
  "otpMethod": "sms",
  "expiresIn": 300
}
```

#### 3. Verify OTP
```bash
POST /api/azure-unlock/verify-otp
Content-Type: application/json

{
  "email": "user@exide.com",
  "otp": "847392"
}

Response:
{
  "valid": true,
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 4. Reset Password
```bash
POST /api/azure-unlock/reset-password
Content-Type: application/json

{
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewSecureP@ssw0rd123!"
}

Response:
{
  "success": true,
  "passwordChanged": true,
  "message": "Password updated successfully"
}
```

## Testing the Complete Flow

### Scenario: User Gets Locked Out

**Step 1: Trigger Account Lockout**
```bash
# Attempt to login 5 times with wrong password
node backend/azure-unlock/test-lockout.js --email user@exide.com
```

**Step 2: AI Agent Detects Lockout**
The service polls Azure AD every 30 seconds for locked accounts:
```bash
# Manual trigger
curl -X POST http://localhost:3000/api/azure-unlock/check-all-locked
```

**Step 3: Automatic Unlock**
AI Agent analyzes and unlocks:
```bash
curl -X POST http://localhost:3000/api/azure-unlock/unlock \
  -H "Content-Type: application/json" \
  -d '{"email": "user@exide.com", "requestedBy": "AI Agent"}'
```

**Step 4: User Receives OTP**
```
SMS to +91-XXXXX-XX234:
"Your account was locked and has been unlocked by IT Support.
Your OTP is: 847392
Valid for 5 minutes.
Ticket: INC-2026-001234"
```

**Step 5: User Verifies OTP**
```bash
curl -X POST http://localhost:3000/api/azure-unlock/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@exide.com", "otp": "847392"}'
```

**Step 6: User Sets New Password**
```bash
curl -X POST http://localhost:3000/api/azure-unlock/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "resetToken": "eyJhbGc...",
    "newPassword": "NewSecureP@ssw0rd123!"
  }'
```

## Security Considerations

### 1. OTP Security
- OTP expires after 5 minutes
- 3 failed OTP attempts = account re-locked
- OTP is cryptographically random (6 digits)

### 2. Password Requirements
Azure AD enforces:
- Minimum 8 characters
- Must contain: uppercase, lowercase, number, special character
- Cannot be same as previous 24 passwords

### 3. Audit Logging
All actions are logged:
- Account lockout detection
- Unlock actions
- OTP generation and verification
- Password reset attempts

### 4. Rate Limiting
- Max 3 unlock requests per user per hour
- Max 5 OTP requests per user per hour

## Monitoring & Alerts

### Metrics to Track
- Account lockouts per hour
- Successful unlocks
- Failed OTP verifications
- Password reset success rate

### Dashboard Query (Azure Log Analytics)
```kusto
SigninLogs
| where ResultType == "50053" // Account locked
| summarize LockoutCount=count() by UserPrincipalName, bin(TimeGenerated, 1h)
| order by LockoutCount desc
```

## Troubleshooting

### Issue: "Insufficient privileges to complete the operation"
**Solution**: Ensure admin consent is granted for all Graph API permissions

### Issue: OTP not received
**Solution**:
1. Check Twilio logs: https://console.twilio.com/logs
2. Verify phone number format: +[country code][number]
3. Check SMTP settings if using email

### Issue: Account unlock succeeds but user still can't login
**Solution**: Azure AD may have cached lockout. Wait 2-3 minutes or clear browser cache

## Integration with ITSM

### ManageEngine ServiceDesk Plus
```javascript
const createTicket = async (userEmail, lockoutInfo) => {
  const response = await fetch('https://servicedesk.exide.com/api/v3/requests', {
    method: 'POST',
    headers: {
      'authtoken': process.env.MANAGEENGINE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input_data: {
        request: {
          subject: `Account Unlock: ${userEmail}`,
          description: `User account locked after ${lockoutInfo.attempts} failed attempts. Automatically unlocked by AI agent.`,
          requester: { email_id: userEmail },
          status: { name: 'Open' },
          priority: { name: 'High' },
          category: { name: 'Account Management' }
        }
      }
    })
  });
  return response.json();
};
```

## Cost Estimate

For 4,000 users with 10% lockout rate per month:
- Azure AD Premium P1: $6/user/month = $24,000/month
- Twilio SMS (400 OTPs): $0.0075 × 400 = $3/month
- Azure Functions hosting: ~$10/month
- **Total**: ~$24,013/month

## Next Steps

1. Deploy to Azure Functions or Container
2. Set up Azure Monitor alerts
3. Configure webhook for real-time lockout detection
4. Add Slack/Teams notifications
5. Build self-service portal for users
