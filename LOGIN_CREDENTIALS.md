# AI-SDR Login Credentials

## 🔐 Admin Access

### Login URL
```
http://44.200.156.6:3000/login
```

### Admin Credentials
```
Email: admin@atomicwork.com
Password: admin123
```

**Status:** ✅ Verified Working

---

## 🧪 Test Results

### Login API Test
```bash
curl -X POST http://44.200.156.6:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@atomicwork.com","password":"admin123"}'
```

**Response:**
```json
{
  "user": {
    "id": "7ccc4455-cda2-4c34-8a1d-742de921b030",
    "email": "admin@atomicwork.com",
    "firstName": "Admin",
    "lastName": "User",
    "companyId": "ae1c1329-57d0-4d6e-8b60-7dc57f707102",
    "role": "admin"
  }
}
```

---

## 👥 All Users in Database

### Active Users (Can Login)
1. **admin@atomicwork.com** ✅
   - Password: `admin123`
   - Role: admin
   - Email Verified: Yes
   - Active: Yes

2. **vj@atomicwork.com** ⚠️
   - Role: account_owner
   - Email Verified: Yes
   - Active: Yes
   - Password: Unknown (needs reset)

3. **vijay@atomicwork.com** ⚠️
   - Role: user
   - Email Verified: No
   - Active: Yes
   - Password: Unknown (needs reset)

### Inactive Users
4. **test-user@example.com** ❌
   - Role: sales_rep
   - Active: No

5. **shankvijay@gmail.com** ❌
   - Role: SDR
   - Active: No

---

## 🔄 Reset Password for Other Users

If you need to login with other users, run this script on the server:

```bash
ssh -i ~/Downloads/Atomicwork/ai-sdr-key.pem ubuntu@44.200.156.6

cd /home/ubuntu/AI-SDR/backend

node -e "
import('bcryptjs').then(async (bcrypt) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const hashedPassword = await bcrypt.default.hash('newpassword123', 10);

    await prisma.user.update({
      where: { email: 'vj@atomicwork.com' }, // Change email here
      data: {
        password: hashedPassword,
        isActive: true,
        isEmailVerified: true
      }
    });

    console.log('✅ Password updated for user');
  } finally {
    await prisma.\$disconnect();
    process.exit(0);
  }
});
"
```

---

## 📱 Features Available After Login

Once logged in as admin, you have access to:

### Dashboard
- **Leads Management** - View, import, and manage leads
- **Call History** - See all voice calls made
- **Analytics** - Performance metrics and insights
- **Scripts** - Manage call scripts
- **Settings** - Configure system settings

### Admin Features
- **User Management** - Invite and manage users
- **Company Settings** - Configure organization details
- **API Keys** - Manage integrations (Twilio, OpenAI, etc.)
- **Phone Numbers** - Configure Twilio phone numbers

### Voice Calling
- **Initiate Calls** - Start AI-powered voice calls
- **Real-time Voice** - WebSocket-based real-time conversations
- **Call Transcripts** - View conversation transcripts
- **Call Analysis** - AI-powered call analysis and insights

---

## 🌐 Navigation

### Main Routes
- **Login:** http://44.200.156.6:3000/login
- **Dashboard:** http://44.200.156.6:3000/leads
- **Accounts:** http://44.200.156.6:3000/accounts
- **Analytics:** http://44.200.156.6:3000/analytics
- **Scripts:** http://44.200.156.6:3000/scripts
- **Settings:** http://44.200.156.6:3000/settings
- **Users:** http://44.200.156.6:3000/users

### API Endpoints
- **Backend Health:** http://44.200.156.6:4000/health
- **API Base:** http://44.200.156.6:4000/api

---

## 🔧 Password Reset Script

For convenience, here's a quick script to reset any user's password:

```bash
# On your local machine
ssh -i ~/Downloads/Atomicwork/ai-sdr-key.pem ubuntu@44.200.156.6 \
  "cd /home/ubuntu/AI-SDR/backend && node create-admin-user.js"
```

This will ensure admin@atomicwork.com has password: `admin123`

---

## 🛡️ Security Notes

1. **Change Password After First Login**
   - The current password (`admin123`) is simple for testing
   - Update to a stronger password once logged in
   - Go to Settings → Profile → Change Password

2. **Environment**
   - Currently running without HTTPS
   - No domain configured yet
   - Direct IP access only

3. **Recommended Next Steps**
   - Get a domain name
   - Setup SSL/HTTPS
   - Enable stronger password requirements
   - Setup 2FA (if available)

---

## 📞 Support

If you can't login:

1. **Check Backend Health**
   ```bash
   curl http://44.200.156.6:4000/health
   ```

2. **Check Frontend Status**
   ```bash
   ssh -i ~/Downloads/Atomicwork/ai-sdr-key.pem ubuntu@44.200.156.6
   pm2 list
   pm2 logs ai-sdr-frontend --lines 50
   ```

3. **Reset Password Again**
   ```bash
   ssh -i ~/Downloads/Atomicwork/ai-sdr-key.pem ubuntu@44.200.156.6
   cd /home/ubuntu/AI-SDR/backend
   npm install bcryptjs  # if needed
   node create-admin-user.js
   ```

---

## ✅ Verified Working

- [x] Frontend accessible at http://44.200.156.6:3000
- [x] Backend healthy at http://44.200.156.6:4000
- [x] Login API responding correctly
- [x] Admin user credentials verified
- [x] Database connection working
- [x] JWT authentication configured

**Login now at:** http://44.200.156.6:3000/login

**Email:** admin@atomicwork.com
**Password:** admin123
