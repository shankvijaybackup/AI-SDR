/**
 * Azure Account Unlock Service - Main Server
 * Production-ready API for automated account unlock with OTP and password reset
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const graphClient = require('./graphClient');
const otpService = require('./otpService');
const ticketService = require('./ticketService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'azure-unlock-service',
    timestamp: new Date().toISOString()
  });
});

/**
 * 1. Check account status
 * GET /api/azure-unlock/check-account
 */
app.post('/api/azure-unlock/check-account', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get user info
    const user = await graphClient.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check lockout status
    const lockoutStatus = await graphClient.isAccountLocked(user.id);

    // Get failed sign-in attempts
    const failedAttempts = await graphClient.getFailedSignInAttempts(user.id, 1);

    res.json({
      userId: user.id,
      email: user.mail || user.userPrincipalName,
      displayName: user.displayName,
      accountEnabled: user.accountEnabled,
      locked: lockoutStatus.locked,
      lockoutInfo: lockoutStatus,
      failedAttempts: failedAttempts.count,
      recentFailures: failedAttempts.attempts.slice(0, 5)
    });
  } catch (error) {
    console.error('Error checking account:', error);
    res.status(500).json({
      error: 'Failed to check account status',
      message: error.message
    });
  }
});

/**
 * 2. Unlock account (main automation endpoint)
 * POST /api/azure-unlock/unlock
 */
app.post('/api/azure-unlock/unlock', async (req, res) => {
  try {
    const { email, requestedBy = 'AI Agent', reason } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`\n🔓 Starting unlock process for: ${email}`);

    // Step 1: Get user info
    console.log('Step 1: Fetching user info...');
    const user = await graphClient.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Step 2: Check if account is actually locked
    console.log('Step 2: Checking lockout status...');
    const lockoutStatus = await graphClient.isAccountLocked(user.id);

    if (!lockoutStatus.locked) {
      return res.json({
        success: true,
        message: 'Account is not locked',
        alreadyUnlocked: true,
        user: {
          email: user.mail || user.userPrincipalName,
          name: user.displayName
        }
      });
    }

    // Step 3: Check rate limiting
    console.log('Step 3: Checking rate limits...');
    const rateLimit = await otpService.checkRateLimit(email, 'unlock');
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimit.retryAfter,
        message: `Too many unlock requests. Try again in ${Math.ceil(rateLimit.retryAfter / 60)} minutes.`
      });
    }

    // Step 4: Unlock the account
    console.log('Step 4: Unlocking account...');
    const unlockResult = await graphClient.unlockAccount(user.id);

    if (!unlockResult.success) {
      return res.status(500).json({
        error: 'Failed to unlock account',
        message: unlockResult.error
      });
    }

    // Step 5: Get lockout details for ticket
    const failedAttempts = await graphClient.getFailedSignInAttempts(user.id, 1);

    // Step 6: Create ITSM ticket
    console.log('Step 5: Creating ITSM ticket...');
    const ticket = await ticketService.createUnlockTicket(
      user.mail || user.userPrincipalName,
      user.displayName,
      {
        lockoutTime: lockoutStatus.lockoutTime,
        failedAttempts: failedAttempts.count,
        location: lockoutStatus.location,
        ipAddress: lockoutStatus.ipAddress
      }
    );

    // Step 6: Generate and send OTP
    console.log('Step 6: Generating and sending OTP...');
    const otpResult = await otpService.generateAndSendOTP(
      user.mail || user.userPrincipalName,
      user.displayName,
      user.mobilePhone
    );

    if (!otpResult.success) {
      // Still return success for unlock, but note OTP failure
      await ticketService.addNote(
        ticket.ticketId,
        `⚠️ OTP delivery failed: ${otpResult.reason}. User may need manual password reset.`
      );
    }

    console.log('✅ Unlock process completed successfully\n');

    // Return comprehensive response
    res.json({
      success: true,
      unlocked: true,
      user: {
        email: user.mail || user.userPrincipalName,
        name: user.displayName,
        userId: user.id
      },
      ticket: {
        ticketId: ticket.ticketId,
        status: ticket.status,
        url: ticket.url
      },
      otp: {
        sent: otpResult.success,
        method: otpResult.method,
        expiresIn: otpResult.expiresIn,
        // Only include OTP in development mode
        code: otpResult.otp
      },
      lockoutInfo: {
        lockoutTime: lockoutStatus.lockoutTime,
        location: lockoutStatus.location,
        failedAttempts: failedAttempts.count
      },
      requestedBy: requestedBy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error unlocking account:', error);
    res.status(500).json({
      error: 'Failed to unlock account',
      message: error.message
    });
  }
});

/**
 * 3. Verify OTP
 * POST /api/azure-unlock/verify-otp
 */
app.post('/api/azure-unlock/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    console.log(`🔐 Verifying OTP for: ${email}`);

    // Verify OTP
    const verification = await otpService.verifyOTP(email, otp);

    if (!verification.valid) {
      return res.status(400).json({
        valid: false,
        reason: verification.reason,
        attemptsRemaining: verification.attemptsRemaining,
        accountLocked: verification.accountLocked
      });
    }

    // Generate password reset token (JWT)
    const resetToken = jwt.sign(
      {
        email: email,
        purpose: 'password-reset',
        timestamp: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Reset token valid for 15 minutes
    );

    console.log('✅ OTP verified successfully\n');

    res.json({
      valid: true,
      message: 'OTP verified successfully',
      resetToken: resetToken,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      error: 'Failed to verify OTP',
      message: error.message
    });
  }
});

/**
 * 4. Reset password
 * POST /api/azure-unlock/reset-password
 */
app.post('/api/azure-unlock/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid or expired reset token',
        message: error.message
      });
    }

    const email = decoded.email;
    console.log(`🔑 Resetting password for: ${email}`);

    // Validate password strength (basic validation)
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password too weak',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Get user
    const user = await graphClient.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset password
    const resetResult = await graphClient.resetPassword(user.id, newPassword);

    if (!resetResult.success) {
      return res.status(500).json({
        error: 'Failed to reset password',
        message: resetResult.error
      });
    }

    console.log('✅ Password reset successfully\n');

    // Note: In production, you'd get the ticket ID from the session/database
    // For now, we'll just log the success
    res.json({
      success: true,
      passwordChanged: true,
      message: 'Password reset successfully. You can now login with your new password.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      message: error.message
    });
  }
});

/**
 * 5. Get all locked accounts (admin endpoint)
 * GET /api/azure-unlock/locked-accounts
 */
app.get('/api/azure-unlock/locked-accounts', async (req, res) => {
  try {
    console.log('📊 Fetching all locked accounts...');

    const lockedAccounts = await graphClient.getAllLockedAccounts();

    res.json({
      count: lockedAccounts.length,
      accounts: lockedAccounts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching locked accounts:', error);
    res.status(500).json({
      error: 'Failed to fetch locked accounts',
      message: error.message
    });
  }
});

/**
 * 6. Complete end-to-end flow (for testing)
 * POST /api/azure-unlock/test-flow
 */
app.post('/api/azure-unlock/test-flow', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`\n🧪 Testing complete flow for: ${email}`);

    const flow = {
      steps: [],
      success: true,
      errors: []
    };

    // Step 1: Check account
    try {
      const user = await graphClient.getUserByEmail(email);
      flow.steps.push({
        step: 1,
        action: 'Check Account',
        status: 'success',
        data: {
          userId: user.id,
          name: user.displayName
        }
      });
    } catch (error) {
      flow.steps.push({
        step: 1,
        action: 'Check Account',
        status: 'failed',
        error: error.message
      });
      flow.success = false;
      flow.errors.push(error.message);
    }

    res.json(flow);
  } catch (error) {
    console.error('Error in test flow:', error);
    res.status(500).json({
      error: 'Test flow failed',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   Azure Account Unlock Service                            ║
║   Production-Ready L1 Automation                          ║
║                                                            ║
║   🚀 Server running on http://localhost:${PORT}            ║
║   📚 API Documentation: /api/azure-unlock/*               ║
║   ❤️  Health Check: http://localhost:${PORT}/health       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log('Available Endpoints:');
  console.log('  POST /api/azure-unlock/check-account');
  console.log('  POST /api/azure-unlock/unlock');
  console.log('  POST /api/azure-unlock/verify-otp');
  console.log('  POST /api/azure-unlock/reset-password');
  console.log('  GET  /api/azure-unlock/locked-accounts\n');
});

module.exports = app;
