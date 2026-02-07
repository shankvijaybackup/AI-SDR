# Deployment Testing Guide

## Wait for Render Deployment
Check: https://dashboard.render.com (wait for build to complete)

## Test 1: Account Sync (Fix Existing Leads)
**Purpose:** Create accounts for all existing leads with companies

```javascript
// Run in browser console while logged into https://ai-sdr-app.onrender.com
fetch('/api/accounts/sync-from-leads', { method: 'POST' })
  .then(r => r.json())
  .then(result => {
    console.log('✅ Sync Result:', result)
    alert(`Created ${result.accountsCreated} accounts, linked ${result.leadsLinked} leads`)
  })
  .catch(err => console.error('❌ Sync failed:', err))
```

Expected: Should create accounts for leads like "Test Auth" → "TestCo"

## Test 2: Manual Enrichment
**Purpose:** Verify enrichment works with proper auth

1. Go to Leads page
2. Click on a lead with a LinkedIn URL (e.g., "Nik Adroja")
3. Click "Enrich" button
4. Should see success message (not "Invalid or expired token")
5. Refresh page - should see persona data populated

## Test 3: Script Generation
**Purpose:** Verify script generation works

1. On an enriched lead (with persona data)
2. Click "Generate Script" button
3. Should see script generated (not "Invalid or expired token")
4. Should see talking points, objection handling, etc.

## Test 4: Deep Research
**Purpose:** Verify account-level research works

1. Go to Accounts page (should now have accounts after sync)
2. Click on an account
3. Click "Deep Research" tab
4. Should see company intelligence data

## Test 5: Automatic Enrichment (New Leads Only)
**Purpose:** Verify automatic enrichment for new leads

1. Create a NEW lead with:
   - Name: Test Auto
   - Company: Google
   - LinkedIn: https://www.linkedin.com/in/sundar-pichai
2. Submit the form
3. Wait 30-60 seconds
4. Refresh the lead detail page
5. Should see:
   - Account automatically created ("Google")
   - Lead linked to Google account
   - Persona data populated
   - Script generated

## Backend Health Check
```bash
curl http://44.200.156.6:4000/health
```
Expected: `{"status":"healthy"}`

## Common Issues

### "Invalid or expired token"
- **Cause:** Authorization header not being sent
- **Fix:** This deploy should fix it
- **Verify:** Check browser Network tab, should see `Authorization: Bearer ...` header

### "Not authenticated"
- **Cause:** JWT token expired or wrong secret
- **Fix:** Log out and log back in
- **Verify:** Check cookie `auth-token` exists

### Enrichment takes forever
- **Expected:** LinkedIn scraping can take 30-60 seconds
- **Check:** Browser console for errors
- **Backend logs:** SSH to EC2 and run `pm2 logs`

### Accounts page still empty
- **Cause:** Haven't run account sync yet
- **Fix:** Run Test 1 above

## Success Criteria
✅ Account sync creates accounts for existing leads
✅ Manual enrichment works without auth errors
✅ Script generation works without auth errors
✅ Deep research shows data for accounts
✅ New leads automatically get enriched and linked to accounts
