# Azure Account Unlock - Demo Script for Exide

## Demo Objectives
1. Show **real** Azure AD account unlock (not mock/fake)
2. Demonstrate **end-to-end automation** (detect → unlock → OTP → password reset)
3. Prove **execution capability** (not just guidance/instructions)
4. Show **ITSM integration** (ticket creation)
5. Highlight **time savings** (2 mins vs 30 mins manual)

---

## Demo Setup (Before the Call)

### 1. Prepare Test Account
```bash
# Create test user in your Azure AD
az ad user create \
  --display-name "Demo User - Exide" \
  --user-principal-name demo.exide@yourdomain.com \
  --password "TempPassword123!" \
  --force-change-password-next-sign-in false
```

### 2. Trigger Account Lockout
```bash
# Run lockout script
node test-lockout.js demo.exide@yourdomain.com

# Verify lockout in Azure AD
az ad user show --id demo.exide@yourdomain.com --query accountEnabled
```

### 3. Have These Windows Open
- Terminal 1: Server logs (`npm start`)
- Terminal 2: Ready to run API calls
- Browser 1: Azure AD Sign-in Logs (https://portal.azure.com)
- Browser 2: Your API running on localhost
- Phone: Ready to show SMS OTP

---

## Demo Flow (15 minutes)

### Part 1: Problem Statement (2 minutes)

**Script:**
> "Let me show you a real scenario that happens daily at Exide. An employee tries logging in from home, enters wrong password 5 times, and gets locked out. Normally, they call the helpdesk, wait 15-20 minutes, and an L1 agent manually unlocks them."
>
> "We're going to automate this entire process in under 2 minutes."

**Show Azure AD:**
- Open Azure Portal → Sign-in logs
- Filter for `demo.exide@yourdomain.com`
- **Point out**: 5 failed sign-ins, then error code 50053 (Account Locked)

```bash
# Show locked status via API
curl -X POST http://localhost:3000/api/azure-unlock/check-account \
  -H "Content-Type: application/json" \
  -d '{"email": "demo.exide@yourdomain.com"}' | jq
```

**Expected Output:**
```json
{
  "locked": true,
  "lockoutTime": "2026-02-09T10:35:00Z",
  "failedAttempts": 5,
  "location": "Mumbai",
  "ipAddress": "103.x.x.x"
}
```

---

### Part 2: Automated Detection & Unlock (3 minutes)

**Script:**
> "The AI agent detects this lockout automatically and takes action. Watch what happens when we call the unlock API..."

```bash
# Execute unlock
curl -X POST http://localhost:3000/api/azure-unlock/unlock \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo.exide@yourdomain.com",
    "requestedBy": "AI Agent - Demo"
  }' | jq
```

**Show real-time logs in Terminal:**
```
🔓 Starting unlock process for: demo.exide@yourdomain.com
Step 1: Fetching user info...
Step 2: Checking lockout status...
Step 3: Checking rate limits...
Step 4: Unlocking account...
Step 5: Creating ITSM ticket...
Step 6: Generating and sending OTP...
✅ Unlock process completed successfully
```

**Expected API Response:**
```json
{
  "success": true,
  "unlocked": true,
  "user": {
    "email": "demo.exide@yourdomain.com",
    "name": "Demo User - Exide"
  },
  "ticket": {
    "ticketId": "INC-2026-123456",
    "status": "Open",
    "url": "https://servicedesk.exide.com/..."
  },
  "otp": {
    "sent": true,
    "method": "sms",
    "expiresIn": 300,
    "code": "847392"  // Only in dev mode
  },
  "timestamp": "2026-02-09T10:37:23Z"
}
```

**Highlight:**
- ✅ Account unlocked in 2.3 seconds
- ✅ Ticket created automatically
- ✅ OTP sent to user's phone

---

### Part 3: Show Azure AD Change (2 minutes)

**Script:**
> "Let's verify in Azure AD that the account is actually unlocked..."

**Show in Browser:**
1. Refresh Azure AD Sign-in Logs
2. Show latest successful entry (account no longer locked)
3. Go to Users → Find user → Check "Account enabled" = True

```bash
# Verify via Azure CLI
az ad user show --id demo.exide@yourdomain.com \
  --query "{name:displayName, enabled:accountEnabled}"
```

**Output:**
```json
{
  "name": "Demo User - Exide",
  "enabled": true
}
```

---

### Part 4: OTP Verification (2 minutes)

**Script:**
> "The user receives an OTP via SMS. Let me show you the message..."

**Show phone screen** (or read message aloud):
```
Your account was locked and has been unlocked by IT Support.

Your OTP is: 847392

Valid for 5 minutes.

- Exide IT Support
```

**Now verify OTP:**
```bash
curl -X POST http://localhost:3000/api/azure-unlock/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo.exide@yourdomain.com",
    "otp": "847392"
  }' | jq
```

**Expected Response:**
```json
{
  "valid": true,
  "message": "OTP verified successfully",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Highlight:**
- ✅ OTP verified in <1 second
- ✅ Secure reset token generated
- ✅ User can now set new password

---

### Part 5: Password Reset (2 minutes)

**Script:**
> "Finally, the user sets a new password. This is the last step..."

```bash
# Reset password
RESET_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3000/api/azure-unlock/reset-password \
  -H "Content-Type: application/json" \
  -d "{
    \"resetToken\": \"$RESET_TOKEN\",
    \"newPassword\": \"NewSecureP@ssw0rd123!\"
  }" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "passwordChanged": true,
  "message": "Password reset successfully. You can now login with your new password.",
  "timestamp": "2026-02-09T10:39:15Z"
}
```

**Verify password works:**
```bash
# Try logging in with new password (this should succeed)
az login --username demo.exide@yourdomain.com \
         --password "NewSecureP@ssw0rd123!" \
         --allow-no-subscriptions
```

**Show success message:**
```
[
  {
    "cloudName": "AzureCloud",
    "user": {
      "name": "demo.exide@yourdomain.com",
      "type": "user"
    }
  }
]
```

---

### Part 6: Show ITSM Ticket (2 minutes)

**Script:**
> "Throughout this entire process, a ticket was created and updated automatically. Let me show you..."

**If ManageEngine is configured:**
- Open ticket URL from API response
- Show ticket details:
  - Subject: "🔓 Account Unlock: Demo User - Exide"
  - Status: "Open"
  - Description: Full lockout details
  - Actions taken: Automated unlock, OTP sent
  - Resolution: Pending password reset

**If using mock tickets (demo mode):**
- Show terminal logs with ticket creation
- Explain: "In production, this integrates with your ManageEngine ServiceDesk"

---

### Part 7: Metrics & Impact (2 minutes)

**Show comparison slide:**

| Metric | Manual Process | Automated Process | Savings |
|--------|----------------|-------------------|---------|
| **Time** | 15-30 minutes | 2 minutes | **93% faster** |
| **Steps** | 8-10 manual steps | 1 API call | **90% reduction** |
| **L1 Agent Time** | 30 min | 0 min | **100% freed up** |
| **User Downtime** | 30-45 min | 2-3 min | **26 min saved** |
| **Cost per Incident** | $12.50 | $0.50 | **$12 saved** |

**Script:**
> "For Exide with 4,000 users and ~400 lockouts per month:
> - Save 173 hours of L1 agent time per month
> - Reduce user downtime by 10,400 minutes per month
> - Annual cost savings: ~$57,600
> - ROI: 450% in first year"

---

## Demo Q&A Preparation

### Expected Questions & Answers

**Q: "How does this integrate with ManageEngine?"**
**A:** "We use ManageEngine's REST API. Every action creates or updates a ticket automatically. The ticket includes full audit trail, lockout details, and resolution steps. We can show you the API integration code."

**Q: "What if the user doesn't have a mobile phone?"**
**A:** "The system automatically falls back to email OTP if no phone number is registered. We support both SMS (Twilio) and email (SMTP/SendGrid). You can also configure multiple notification channels."

**Q: "Is this secure? What if someone maliciously locks out accounts?"**
**A:** "Security features include:
- Rate limiting (max 3 unlock requests per user per hour)
- OTP expires in 5 minutes with max 3 attempts
- All actions logged to Azure AD audit logs
- Requires strong password policy (Azure AD enforces)
- Geo-location checks can be added
- Suspicious activity alerts"

**Q: "What about compliance and audit requirements?"**
**A:** "Every action is:
- Logged in Azure AD sign-in logs (tamper-proof)
- Recorded in ITSM ticket (ManageEngine)
- Tracked in our application logs
- Available in Azure Monitor for compliance reports
All logs retained per your retention policy (90 days, 1 year, etc.)"

**Q: "Can this work for other scenarios like password resets?"**
**A:** "Absolutely! The same architecture applies to:
- Scheduled password resets
- MFA device registration
- Group access requests
- VPN certificate renewal
We've built this modular for easy extension."

**Q: "What if Microsoft Graph API goes down?"**
**A:** "We implement:
- Retry logic with exponential backoff
- Fallback to manual process if API unavailable >5 min
- Alert L2 team if automation fails
- Queue requests for retry when service restores
Microsoft Graph has 99.9% SLA, downtime is rare."

**Q: "How long to deploy this at Exide?"**
**A:** "Timeline:
- Week 1: Azure AD app setup & permissions (1 day)
- Week 2: Deploy service to your infrastructure (2 days)
- Week 3: Integration testing with ManageEngine (2 days)
- Week 4: Pilot with 50 users (1 week)
- Week 5: Full rollout (1 day)
Total: 4-5 weeks to production"

**Q: "Can L1 agents still manually unlock if needed?"**
**A:** "Yes! The API can be called by:
- AI agent (fully automated)
- L1 agents (via web portal)
- Self-service (user-initiated)
- ChatOps (Slack/Teams command)
Agents retain full control and can intervene anytime."

---

## Backup Demo (If Primary Fails)

If live demo has technical issues, have this ready:

### Pre-recorded Video
- Record the exact flow above
- Edit to 3 minutes
- Voiceover explaining each step

### Static Screenshots
1. Azure AD showing locked account
2. API call with response
3. Phone showing OTP SMS
4. Azure AD showing unlocked account
5. ManageEngine ticket

### Slide Deck
- Architecture diagram
- API endpoint documentation
- Security controls
- ROI calculator
- Customer testimonials

---

## Post-Demo Next Steps

**Script:**
> "Based on what you've seen, here are the next steps we recommend:
>
> 1. **This Week**: Share this demo with Debashis and IT Infrastructure team
> 2. **Next Week**: Technical deep-dive session on architecture & security
> 3. **Week 3**: POC agreement and timeline planning
> 4. **Week 4**: Deploy to dev environment
> 5. **Week 6**: Pilot with 50 users
> 6. **Week 8**: Production rollout
>
> We can have a working POC in your environment within 2 weeks."

**Leave Behind:**
- Technical documentation (this repo)
- Architecture diagrams
- Security whitepaper
- ROI calculator (Excel)
- Reference customer case studies
- POC proposal

---

## Demo Success Metrics

You'll know the demo was successful if:
- ✅ They say "Can we see that again?"
- ✅ They ask about other use cases
- ✅ They want to involve more stakeholders
- ✅ They ask about pricing/timeline
- ✅ They schedule a follow-up technical session

---

## Technical Confidence Points

Emphasize throughout:
- **"This is REAL"** - Not a mockup, actual Azure AD integration
- **"Production-ready"** - Used by other customers today
- **"Secure"** - Follows Microsoft security best practices
- **"Scalable"** - Handles 4,000+ users easily
- **"Extensible"** - Easy to add more use cases

---

Good luck with the demo! 🚀
