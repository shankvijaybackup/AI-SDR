/**
 * ITSM Ticket Service
 * Creates and manages tickets in ManageEngine ServiceDesk Plus
 */

const axios = require('axios');
require('dotenv').config();

class TicketService {
  constructor() {
    this.baseURL = process.env.MANAGEENGINE_URL;
    this.apiKey = process.env.MANAGEENGINE_API_KEY;

    if (!this.baseURL || !this.apiKey) {
      console.warn('ManageEngine credentials not configured. Tickets will be logged only.');
    }
  }

  /**
   * Generate ticket ID (fallback if ManageEngine not configured)
   */
  generateTicketId() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `INC-${year}-${random}`;
  }

  /**
   * Create ticket in ManageEngine ServiceDesk Plus
   */
  async createTicket(ticketData) {
    const {
      userEmail,
      userName,
      subject,
      description,
      priority = 'High',
      category = 'Account Management',
      subcategory = 'Account Unlock'
    } = ticketData;

    // If ManageEngine not configured, return mock ticket
    if (!this.baseURL || !this.apiKey) {
      const ticketId = this.generateTicketId();
      console.log(`[MOCK TICKET] Created: ${ticketId}`);
      console.log('Subject:', subject);
      console.log('Description:', description);

      return {
        success: true,
        ticketId: ticketId,
        status: 'Open',
        mock: true
      };
    }

    try {
      const requestData = {
        input_data: {
          request: {
            subject: subject,
            description: description,
            requester: {
              email_id: userEmail,
              name: userName
            },
            status: {
              name: 'Open'
            },
            priority: {
              name: priority
            },
            category: {
              name: category
            },
            subcategory: {
              name: subcategory
            },
            technician: {
              name: 'AI Agent'
            },
            mode: {
              name: 'Automated'
            }
          }
        }
      };

      const response = await axios.post(
        `${this.baseURL}/api/v3/requests`,
        requestData,
        {
          headers: {
            'authtoken': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const ticketId = response.data.request?.id || this.generateTicketId();

      return {
        success: true,
        ticketId: ticketId,
        status: 'Open',
        url: `${this.baseURL}/WorkOrder.do?woMode=viewWO&woID=${ticketId}`
      };
    } catch (error) {
      console.error('Error creating ticket in ManageEngine:', error.message);

      // Fallback to mock ticket
      const ticketId = this.generateTicketId();
      return {
        success: true,
        ticketId: ticketId,
        status: 'Open',
        error: error.message,
        mock: true
      };
    }
  }

  /**
   * Create account unlock ticket
   */
  async createUnlockTicket(userEmail, userName, lockoutInfo) {
    const subject = `🔓 Account Unlock: ${userName} (${userEmail})`;

    const description = `
<p><strong>Account Unlock Request - Automated</strong></p>

<p><strong>User Details:</strong></p>
<ul>
  <li><strong>Name:</strong> ${userName}</li>
  <li><strong>Email:</strong> ${userEmail}</li>
</ul>

<p><strong>Lockout Information:</strong></p>
<ul>
  <li><strong>Lockout Time:</strong> ${lockoutInfo.lockoutTime || 'N/A'}</li>
  <li><strong>Failed Attempts:</strong> ${lockoutInfo.failedAttempts || 'Unknown'}</li>
  <li><strong>Location:</strong> ${lockoutInfo.location || 'Unknown'}</li>
  <li><strong>IP Address:</strong> ${lockoutInfo.ipAddress || 'Unknown'}</li>
</ul>

<p><strong>Actions Taken:</strong></p>
<ul>
  <li>✅ Account unlocked automatically</li>
  <li>✅ OTP sent to user for password reset</li>
  <li>⏳ Awaiting user password reset</li>
</ul>

<p><strong>Next Steps:</strong></p>
<ol>
  <li>User will receive OTP via SMS/Email</li>
  <li>User will reset password using OTP</li>
  <li>Ticket will auto-close upon successful password reset</li>
</ol>

<p><em>This ticket was created automatically by the L1 Automation System.</em></p>
    `;

    return await this.createTicket({
      userEmail,
      userName,
      subject,
      description,
      priority: 'High',
      category: 'Account Management',
      subcategory: 'Account Unlock'
    });
  }

  /**
   * Update ticket status
   */
  async updateTicket(ticketId, update) {
    if (!this.baseURL || !this.apiKey) {
      console.log(`[MOCK TICKET UPDATE] ${ticketId}:`, update);
      return { success: true, mock: true };
    }

    try {
      const response = await axios.put(
        `${this.baseURL}/api/v3/requests/${ticketId}`,
        {
          input_data: {
            request: update
          }
        },
        {
          headers: {
            'authtoken': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error updating ticket:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add note to ticket
   */
  async addNote(ticketId, note) {
    if (!this.baseURL || !this.apiKey) {
      console.log(`[MOCK TICKET NOTE] ${ticketId}:`, note);
      return { success: true, mock: true };
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/api/v3/requests/${ticketId}/notes`,
        {
          input_data: {
            note: {
              description: note,
              show_to_requester: true
            }
          }
        },
        {
          headers: {
            'authtoken': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error adding note to ticket:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close ticket with resolution
   */
  async closeTicket(ticketId, resolution) {
    const update = {
      status: {
        name: 'Closed'
      },
      resolution: {
        content: resolution
      }
    };

    return await this.updateTicket(ticketId, update);
  }

  /**
   * Close ticket after successful password reset
   */
  async closeUnlockTicket(ticketId, userEmail) {
    const resolution = `
<p><strong>Resolution:</strong></p>
<p>Account unlock completed successfully for ${userEmail}.</p>

<ul>
  <li>✅ Account unlocked</li>
  <li>✅ OTP verified</li>
  <li>✅ Password reset completed</li>
  <li>✅ User can now login</li>
</ul>

<p><strong>Resolution Time:</strong> ${new Date().toLocaleString()}</p>
<p><strong>Resolved By:</strong> AI Agent (Automated)</p>

<p><em>This ticket was closed automatically by the L1 Automation System.</em></p>
    `;

    return await this.closeTicket(ticketId, resolution);
  }
}

module.exports = new TicketService();
