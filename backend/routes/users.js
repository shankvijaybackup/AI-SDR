import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendInvitationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService.js';
import prisma from '../lib/prisma.js';
import { authenticateToken, requireAccountOwner } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/users/invite
 * Invite a new user (Account Owner only)
 */
router.post('/invite', authenticateToken, requireAccountOwner, async (req, res) => {
  try {
    const { email, role, firstName, lastName } = req.body;

    // Validate input
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    // Validate role
    if (!['account_owner', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "account_owner" or "agent"' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if there's already a pending invite
    const existingInvite = await prisma.companyInvite.findUnique({
      where: {
        companyId_email: {
          companyId: req.user.companyId,
          email,
        },
      },
    });

    if (existingInvite) {
      // Update existing invite with new token and expiry
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const updatedInvite = await prisma.companyInvite.update({
        where: { id: existingInvite.id },
        data: {
          token,
          role,
          expiresAt,
        },
      });

      // Send invitation email
      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
      });

      await sendInvitationEmail({
        email,
        token,
        inviterName: `${req.user.firstName} ${req.user.lastName}`,
        role,
        companyName: company?.name || 'Atomicwork',
      });

      return res.json({
        message: 'Invitation resent successfully',
        invite: {
          id: updatedInvite.id,
          email: updatedInvite.email,
          role: updatedInvite.role,
          expiresAt: updatedInvite.expiresAt,
        },
      });
    }

    // Create new invitation
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.companyInvite.create({
      data: {
        companyId: req.user.companyId,
        email,
        role,
        token,
        expiresAt,
      },
    });

    // Send invitation email
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
    });

    await sendInvitationEmail({
      email,
      token,
      inviterName: `${req.user.firstName} ${req.user.lastName}`,
      role,
      companyName: company?.name || 'Atomicwork',
    });

    res.json({
      message: 'Invitation sent successfully',
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to send invitation', details: error.message });
  }
});

/**
 * POST /api/users/activate
 * Activate user account with invitation token
 */
router.post('/activate', async (req, res) => {
  try {
    const { token, password, firstName, lastName } = req.body;

    if (!token || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Token, password, first name, and last name are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Find invitation
    const invite = await prisma.companyInvite.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invite) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        firstName,
        lastName,
        role: invite.role,
        companyId: invite.companyId,
        isActive: true,
        isEmailVerified: true,
      },
    });

    // Delete invitation
    await prisma.companyInvite.delete({
      where: { id: invite.id },
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail({
      email: user.email,
      firstName: user.firstName,
      role: user.role,
      companyName: invite.company?.name || 'Atomicwork',
    }).catch(err => console.error('Failed to send welcome email:', err));

    res.json({
      message: 'Account activated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: 'Failed to activate account', details: error.message });
  }
});

/**
 * GET /api/users/invite/:token
 * Get invitation details by token (for activation page)
 */
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await prisma.companyInvite.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    res.json({
      email: invite.email,
      role: invite.role,
      companyName: invite.company?.name || 'Atomicwork',
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: 'Failed to get invitation details' });
  }
});

/**
 * GET /api/users
 * List all users in the company (Account Owner only)
 */
router.get('/', authenticateToken, requireAccountOwner, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        companyId: req.user.companyId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            leads: true,
            calls: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get pending invites (from companyInvite table)
    const companyInvites = await prisma.companyInvite.findMany({
      where: {
        companyId: req.user.companyId,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get pending user activations (users created but not activated yet)
    const pendingUsers = await prisma.user.findMany({
      where: {
        companyId: req.user.companyId,
        isActive: false,
        isEmailVerified: false,
        emailVerificationToken: {
          not: null,
        },
        emailVerificationExpiry: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        emailVerificationToken: true,
        emailVerificationExpiry: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Combine and format pending invites
    const pendingInvites = [
      ...companyInvites,
      ...pendingUsers.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        expiresAt: user.emailVerificationExpiry,
        verificationToken: user.emailVerificationToken,
        firstName: user.firstName,
        lastName: user.lastName,
      })),
    ];

    res.json({
      users,
      pendingInvites,
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * PATCH /api/users/:userId
 * Update user (Account Owner only)
 */
router.patch('/:userId', authenticateToken, requireAccountOwner, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, isActive } = req.body;

    // Validate that user belongs to same company
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Cannot modify users from other companies' });
    }

    // Prevent self-demotion
    if (userId === req.user.userId && role && role !== 'account_owner') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role && { role }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:userId
 * Delete user (Account Owner only)
 */
router.delete('/:userId', authenticateToken, requireAccountOwner, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate that user belongs to same company
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Cannot delete users from other companies' });
    }

    // Prevent self-deletion
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * DELETE /api/users/invite/:inviteId
 * Cancel pending invitation (Account Owner only)
 */
router.delete('/invite/:inviteId', authenticateToken, requireAccountOwner, async (req, res) => {
  try {
    const { inviteId } = req.params;

    // Validate that invite belongs to same company
    const invite = await prisma.companyInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invite.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Cannot cancel invitations from other companies' });
    }

    // Delete invitation
    await prisma.companyInvite.delete({
      where: { id: inviteId },
    });

    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

/**
 * POST /api/users/request-password-reset
 * Request password reset
 */
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if user exists
    if (!user) {
      return res.json({ message: 'If an account exists with that email, a password reset link has been sent' });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry,
      },
    });

    // Send password reset email
    await sendPasswordResetEmail({
      email: user.email,
      token,
      firstName: user.firstName,
    });

    res.json({ message: 'If an account exists with that email, a password reset link has been sent' });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

/**
 * POST /api/users/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Find user by token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
