/**
 * Microsoft Graph API Client
 * Handles all interactions with Azure AD
 */

const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
require('dotenv').config();

class GraphAPIClient {
  constructor() {
    this.tenantId = process.env.AZURE_TENANT_ID;
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      throw new Error('Azure AD credentials not configured. Check .env file.');
    }

    // Create credential using Azure Identity
    this.credential = new ClientSecretCredential(
      this.tenantId,
      this.clientId,
      this.clientSecret
    );

    // Initialize Graph client
    this.client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await this.credential.getToken('https://graph.microsoft.com/.default');
          return token.token;
        }
      }
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      const user = await this.client
        .api(`/users/${email}`)
        .select('id,displayName,mail,userPrincipalName,accountEnabled,mobilePhone')
        .get();
      return user;
    } catch (error) {
      console.error(`Error fetching user ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if user account is locked
   * Azure AD doesn't have a direct "locked" field, so we check sign-in logs
   */
  async isAccountLocked(userId) {
    try {
      // Query sign-in logs for lockout events (error code 50053)
      const signInLogs = await this.client
        .api('/auditLogs/signIns')
        .filter(`userId eq '${userId}' and status/errorCode eq 50053`)
        .top(1)
        .orderby('createdDateTime desc')
        .get();

      if (signInLogs.value && signInLogs.value.length > 0) {
        const lastLockout = signInLogs.value[0];
        const lockoutTime = new Date(lastLockout.createdDateTime);
        const now = new Date();
        const lockoutDuration = 30 * 60 * 1000; // 30 minutes in milliseconds

        // Check if lockout is still active
        const isStillLocked = (now - lockoutTime) < lockoutDuration;

        return {
          locked: isStillLocked,
          lockoutTime: lockoutTime.toISOString(),
          timeSinceLockout: Math.floor((now - lockoutTime) / 1000 / 60), // minutes
          location: lastLockout.location?.city || 'Unknown',
          ipAddress: lastLockout.ipAddress || 'Unknown'
        };
      }

      return { locked: false };
    } catch (error) {
      console.error(`Error checking lockout status for user ${userId}:`, error.message);
      // If we can't access audit logs, try alternative method
      return await this.checkAccountEnabledStatus(userId);
    }
  }

  /**
   * Alternative method: Check if account is enabled
   */
  async checkAccountEnabledStatus(userId) {
    try {
      const user = await this.client
        .api(`/users/${userId}`)
        .select('accountEnabled')
        .get();

      return {
        locked: !user.accountEnabled,
        reason: user.accountEnabled ? null : 'Account disabled'
      };
    } catch (error) {
      console.error('Error checking account status:', error.message);
      return { locked: false, error: error.message };
    }
  }

  /**
   * Get recent failed sign-in attempts
   */
  async getFailedSignInAttempts(userId, hours = 1) {
    try {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const signInLogs = await this.client
        .api('/auditLogs/signIns')
        .filter(`userId eq '${userId}' and createdDateTime ge ${hoursAgo} and status/errorCode ne 0`)
        .orderby('createdDateTime desc')
        .get();

      return {
        count: signInLogs.value.length,
        attempts: signInLogs.value.map(log => ({
          time: log.createdDateTime,
          errorCode: log.status.errorCode,
          failureReason: log.status.failureReason,
          location: log.location?.city || 'Unknown',
          ipAddress: log.ipAddress
        }))
      };
    } catch (error) {
      console.error('Error fetching failed sign-in attempts:', error.message);
      return { count: 0, attempts: [], error: error.message };
    }
  }

  /**
   * Unlock user account
   * In Azure AD, we enable the account if it's disabled
   * For lockouts due to failed attempts, we can't directly unlock,
   * but we can reset the accountEnabled flag or trigger password reset
   */
  async unlockAccount(userId) {
    try {
      // Method 1: Ensure account is enabled
      await this.client
        .api(`/users/${userId}`)
        .patch({
          accountEnabled: true
        });

      // Method 2: Force password change on next sign-in (optional)
      // This effectively "unlocks" by requiring new auth
      // await this.client
      //   .api(`/users/${userId}`)
      //   .patch({
      //     passwordProfile: {
      //       forceChangePasswordNextSignIn: true
      //     }
      //   });

      return {
        success: true,
        message: 'Account unlocked successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error unlocking account ${userId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset user password
   */
  async resetPassword(userId, newPassword) {
    try {
      await this.client
        .api(`/users/${userId}`)
        .patch({
          passwordProfile: {
            password: newPassword,
            forceChangePasswordNextSignIn: false
          }
        });

      return {
        success: true,
        message: 'Password reset successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error resetting password for ${userId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email using Microsoft Graph
   */
  async sendEmail(userId, subject, body) {
    try {
      const message = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: body
          },
          toRecipients: [
            {
              emailAddress: {
                address: userId // Can use userId or email
              }
            }
          ]
        },
        saveToSentItems: false
      };

      await this.client
        .api(`/users/${process.env.SMTP_USER}/sendMail`)
        .post(message);

      return { success: true };
    } catch (error) {
      console.error('Error sending email via Graph:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all locked accounts in the tenant
   */
  async getAllLockedAccounts() {
    try {
      // Get sign-in logs with lockout error code (50053) in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const signInLogs = await this.client
        .api('/auditLogs/signIns')
        .filter(`createdDateTime ge ${oneHourAgo} and status/errorCode eq 50053`)
        .orderby('createdDateTime desc')
        .get();

      // Group by user and get unique locked users
      const lockedUsers = new Map();

      for (const log of signInLogs.value) {
        if (!lockedUsers.has(log.userId)) {
          const user = await this.getUserByEmail(log.userPrincipalName);
          lockedUsers.set(log.userId, {
            userId: log.userId,
            email: log.userPrincipalName,
            displayName: user.displayName,
            lockoutTime: log.createdDateTime,
            location: log.location?.city || 'Unknown',
            ipAddress: log.ipAddress
          });
        }
      }

      return Array.from(lockedUsers.values());
    } catch (error) {
      console.error('Error fetching all locked accounts:', error.message);
      return [];
    }
  }

  /**
   * Revoke all refresh tokens for a user (force re-authentication)
   */
  async revokeUserSessions(userId) {
    try {
      await this.client
        .api(`/users/${userId}/revokeSignInSessions`)
        .post({});

      return {
        success: true,
        message: 'All sessions revoked successfully'
      };
    } catch (error) {
      console.error(`Error revoking sessions for ${userId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new GraphAPIClient();
