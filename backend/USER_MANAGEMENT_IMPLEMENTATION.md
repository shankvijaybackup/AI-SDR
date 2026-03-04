# User Management System Implementation Complete ✅

## Overview
Complete user management system with Amazon SES email invitations, role-based access control, and activation workflow.

## Features Implemented

### 1. User Roles
- **Account Owner**: Full access including user management, settings, invitations
- **Agent**: Can import leads, enrich data, view/modify call scripts, upload knowledge, make calls (1-by-1 and bulk)

### 2. Default Account Owner
- **Email**: vj@atomicwork.com
- **Password**: atomiwork@123#
- **Role**: Account Owner
- **Company**: Atomicwork (auto-created)

### 3. User Invitation Flow
1. Account Owner invites user via UI
2. System sends invitation email via Amazon SES from vj@atomicwork.com
3. User receives beautifully formatted email with:
   - Activation link (valid for 7 days)
   - Role information (Account Owner or Agent)
   - Capabilities list
   - Atomicwork branding
4. User clicks link, sets up account (name + password)
5. Account activated, welcome email sent
6. User can login immediately

### 4. Email Templates
All emails sent from **vj@atomicwork.com** with:
- Professional HTML design with gradient headers
- Atomicwork branding
- Verified company information (founders, funding)
- Clear CTAs and security information

**Email Types**:
- **Invitation Email**: Sent when user is invited
- **Welcome Email**: Sent after successful activation
- **Password Reset Email**: For forgotten passwords

## Backend Implementation

### New Files Created

#### `/backend/services/emailService.js`
- AWS SES integration
- Three email functions:
  - `sendInvitationEmail()` - User invitations
  - `sendWelcomeEmail()` - Post-activation welcome
  - `sendPasswordResetEmail()` - Password recovery
- Configurable sender: vj@atomicwork.com
- HTML + plain text versions

#### `/backend/routes/users.js`
Complete user management API:
- `POST /api/users/invite` - Send invitation (Account Owner only)
- `POST /api/users/activate` - Activate account with token
- `GET /api/users/invite/:token` - Get invitation details
- `GET /api/users` - List all users + pending invites (Account Owner only)
- `PATCH /api/users/:userId` - Update user (role, isActive)
- `DELETE /api/users/:userId` - Delete user
- `DELETE /api/users/invite/:inviteId` - Cancel pending invitation
- `POST /api/users/request-password-reset` - Request password reset
- `POST /api/users/reset-password` - Reset password with token

#### `/backend/middleware/auth.js`
Authentication middleware:
- `authenticateToken()` - Verifies JWT from cookie or Authorization header
- `requireAccountOwner()` - Restricts to account owners
- `requireAgentOrOwner()` - Allows agents and owners
- Attaches user info to `req.user`

#### `/backend/setup-account-owner.js`
Setup script:
- Creates Atomicwork company if not exists
- Creates/updates vj@atomicwork.com user
- Sets role to `account_owner`
- Sets password to `atomiwork@123#`
- Activates account

### Modified Files

#### `/backend/server.js`
- Added `cookie-parser` middleware
- Registered `/api/users` routes
- Added PATCH and DELETE to CORS methods

#### `/backend/routes/users.js`
- Converted from CommonJS to ES modules
- Integrated with auth middleware

## Frontend Implementation

### New Files Created

#### `/app/app/api/users/invite/route.ts`
Proxies invitation requests to backend with authentication

#### `/app/app/api/users/route.ts`
Proxies user list and update requests to backend

#### `/app/app/api/users/activate/route.ts`
- `POST` - Activate user account
- `GET` - Fetch invitation details by token

#### `/app/app/(auth)/activate/page.tsx`
Beautiful activation page:
- Fetches invitation details
- Shows company name and role
- Form for first name, last name, password
- Password validation (min 8 chars, confirmation match)
- Redirects to login after activation
- Error handling for expired/invalid tokens

#### `/app/app/(protected)/users/page.tsx`
Team management dashboard:
- **Invite Users**: Dialog with email + role selection
- **Active Users List**: Shows all team members with:
  - Name, email, role badges
  - Last login date
  - Active/Inactive status
- **Pending Invitations**: Shows users who haven't activated:
  - Email, invited date, expiration date
  - Role badge
  - Yellow highlight for pending status
- Real-time updates after invitation sent

## Environment Variables

### Backend `.env`
```bash
# AWS SES Configuration (for user invitations)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
FRONTEND_URL=http://localhost:3000

# JWT Secret (already exists)
JWT_SECRET=your_jwt_secret_here
```

### Frontend `.env.local`
```bash
BACKEND_API_URL=http://localhost:4000
```

## Database Schema

### User Model (Updated)
```prisma
model User {
  role: String @default("member")  // "account_owner" | "agent" | "admin" | "member"
  // ... existing fields
}
```

### CompanyInvite Model (Already Exists)
```prisma
model CompanyInvite {
  id        String   @id @default(uuid())
  companyId String
  email     String
  role      String   @default("member")  // "account_owner" | "agent"
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  // ... relations
}
```

## How to Use

### 1. Setup (First Time)
```bash
cd backend
npm install @aws-sdk/client-ses cookie-parser bcrypt
node setup-account-owner.js
```

### 2. Configure AWS SES
1. Go to AWS Console → SES
2. Verify sender email: vj@atomicwork.com
3. Get AWS Access Key ID and Secret Access Key
4. Add to backend/.env:
   ```
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

### 3. Login as Account Owner
1. Go to http://localhost:3000/login
2. Email: vj@atomicwork.com
3. Password: atomiwork@123#

### 4. Invite Users
1. Navigate to `/users` page
2. Click "Invite User"
3. Enter email and select role (Agent or Account Owner)
4. Click "Send Invitation"
5. User receives email with activation link

### 5. User Activation
1. User clicks link in email
2. Redirected to `/activate?token=xxx`
3. Fills in name and password
4. Clicks "Activate Account"
5. Redirected to login
6. Can login immediately

## Testing

### Test User Invitation
```bash
curl -X POST http://localhost:4000/api/users/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_JWT_TOKEN" \
  -d '{
    "email": "test@example.com",
    "role": "agent"
  }'
```

### Test Activation
```bash
curl -X POST http://localhost:4000/api/users/activate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "INVITATION_TOKEN",
    "firstName": "Test",
    "lastName": "User",
    "password": "SecurePass123"
  }'
```

## Role-Based Access Control

### Account Owner Can:
- ✅ Invite users
- ✅ View all users
- ✅ Update user roles
- ✅ Deactivate/delete users
- ✅ Cancel pending invitations
- ✅ Import leads
- ✅ Enrich leads
- ✅ Generate/modify call scripts
- ✅ Upload knowledge
- ✅ Make calls (1-by-1 and bulk)
- ✅ Configure company settings

### Agent Can:
- ✅ Import leads
- ✅ Enrich leads
- ✅ View/modify call scripts
- ✅ Upload knowledge
- ✅ Make calls (1-by-1 and bulk)
- ❌ Cannot invite users
- ❌ Cannot view/manage team
- ❌ Cannot access company settings

## Security Features

1. **JWT Authentication**: All protected routes require valid JWT token
2. **Role-Based Authorization**: Middleware checks user roles before allowing actions
3. **Password Hashing**: bcrypt with 10 rounds
4. **Token Expiry**:
   - Invitation tokens: 7 days
   - JWT tokens: 7 days
   - Password reset tokens: 1 hour
5. **HTTPS Only Cookies** (in production)
6. **HttpOnly Cookies**: Prevents XSS attacks
7. **CORS Protection**: Only allows configured origins

## Next Steps

### To Deploy to Production:
1. **AWS SES Setup**:
   - Move from SES Sandbox to Production
   - Verify domain (atomicwork.com)
   - Request sending limit increase

2. **Environment Variables**:
   - Set real AWS credentials
   - Update FRONTEND_URL to production URL
   - Use secure JWT_SECRET (32+ chars random string)

3. **HTTPS**:
   - All cookies set with `secure: true`
   - Frontend served over HTTPS
   - Backend API over HTTPS

4. **Email Monitoring**:
   - Monitor SES sending statistics
   - Set up bounce/complaint handling
   - Track email delivery rates

## Troubleshooting

### Emails Not Sending
1. Check AWS SES credentials in .env
2. Verify sender email (vj@atomicwork.com) in SES console
3. Check if in SES Sandbox (can only send to verified emails)
4. Check backend logs for SES errors

### Activation Link Not Working
1. Check token hasn't expired (7 days)
2. Check FRONTEND_URL in backend .env matches actual frontend URL
3. Check backend logs for errors

### User Can't Login After Activation
1. Verify account was activated (check `isActive` in database)
2. Check password was set correctly
3. Verify JWT_SECRET is same in frontend and backend

## API Reference

See backend/routes/users.js for complete API documentation with request/response examples.
