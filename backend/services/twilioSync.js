// services/twilioSync.js
// Sync historical call data from Twilio API to database

import twilio from 'twilio';
import prisma from '../lib/prisma.js';


// Initialize Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

/**
 * Fetch historical calls from Twilio API
 * @param {Object} options - Filter options
 * @param {Date} options.startDate - Start date for filtering calls
 * @param {Date} options.endDate - End date for filtering calls
 * @param {string} options.status - Filter by call status (completed, busy, etc.)
 * @param {number} options.limit - Maximum number of calls to fetch (default 100)
 * @returns {Promise<Array>} Array of call records
 */
export async function fetchTwilioCalls(options = {}) {
    const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
        endDate = new Date(),
        status = null,
        limit = 100
    } = options;

    console.log(`[Twilio Sync] Fetching calls from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    try {
        const listParams = {
            startTimeAfter: startDate,
            startTimeBefore: endDate,
            limit: limit
        };

        if (status) {
            listParams.status = status;
        }

        const calls = await twilioClient.calls.list(listParams);
        console.log(`[Twilio Sync] Fetched ${calls.length} calls from Twilio API`);

        return calls.map(call => ({
            sid: call.sid,
            to: call.to,
            from: call.from,
            status: call.status,
            direction: call.direction,
            duration: call.duration ? parseInt(call.duration, 10) : 0,
            startTime: call.startTime,
            endTime: call.endTime,
            price: call.price,
            priceUnit: call.priceUnit,
            answeredBy: call.answeredBy
        }));
    } catch (error) {
        console.error('[Twilio Sync] Error fetching calls:', error.message);
        throw error;
    }
}

/**
 * Sync Twilio calls to database
 * Creates missing records, updates existing ones
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync results
 */
export async function syncTwilioCalls(options = {}) {
    const results = {
        fetched: 0,
        matched: 0,
        created: 0,
        updated: 0,
        errors: []
    };

    try {
        const twilioCalls = await fetchTwilioCalls(options);
        results.fetched = twilioCalls.length;

        for (const twilioCall of twilioCalls) {
            try {
                // Skip inbound calls - we only care about outbound
                if (twilioCall.direction !== 'outbound-api') {
                    continue;
                }

                // Find existing call by Twilio SID
                const existingCall = await prisma.call.findFirst({
                    where: { twilioCallSid: twilioCall.sid }
                });

                if (existingCall) {
                    // ALWAYS update the call status from Twilio (the source of truth)
                    // This ensures 'pending' calls get updated to 'completed', 'busy', etc.
                    const needsUpdate = existingCall.status !== twilioCall.status ||
                        !existingCall.duration ||
                        existingCall.status === 'pending' ||
                        existingCall.status === 'initiated' ||
                        existingCall.status === 'ringing';

                    if (needsUpdate) {
                        await prisma.call.update({
                            where: { id: existingCall.id },
                            data: {
                                status: twilioCall.status,
                                duration: twilioCall.duration || existingCall.duration
                            }
                        });
                        results.updated++;
                        console.log(`[Twilio Sync] Updated call ${existingCall.id}: ${existingCall.status} -> ${twilioCall.status}`);
                    } else {
                        results.matched++;
                    }
                } else {
                    // Log orphan call (no matching DB record)
                    // We can't create a full record without lead/user context
                    console.log(`[Twilio Sync] Orphan call found: ${twilioCall.sid} to ${twilioCall.to}`);
                    results.errors.push({
                        sid: twilioCall.sid,
                        reason: 'No matching database record - call may have been made outside the app'
                    });
                }
            } catch (callError) {
                console.error(`[Twilio Sync] Error processing call ${twilioCall.sid}:`, callError.message);
                results.errors.push({
                    sid: twilioCall.sid,
                    reason: callError.message
                });
            }
        }

        console.log(`[Twilio Sync] Sync complete:`, {
            fetched: results.fetched,
            matched: results.matched,
            updated: results.updated,
            errors: results.errors.length
        });

        return results;
    } catch (error) {
        console.error('[Twilio Sync] Sync failed:', error.message);
        throw error;
    }
}

/**
 * Get Twilio account usage summary
 * @returns {Promise<Object>} Usage summary
 */
export async function getTwilioUsage() {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get call count this month
        const calls = await twilioClient.calls.list({
            startTimeAfter: startOfMonth,
            limit: 1000
        });

        // Calculate totals
        let totalDuration = 0;
        let completedCalls = 0;
        let failedCalls = 0;

        for (const call of calls) {
            if (call.direction === 'outbound-api') {
                if (call.status === 'completed') {
                    completedCalls++;
                    totalDuration += parseInt(call.duration || 0, 10);
                } else if (['busy', 'no-answer', 'failed', 'canceled'].includes(call.status)) {
                    failedCalls++;
                }
            }
        }

        // Get account balance (if available)
        let balance = null;
        try {
            const account = await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
            balance = account.balance;
        } catch (e) {
            console.log('[Twilio Sync] Could not fetch account balance');
        }

        return {
            period: {
                start: startOfMonth.toISOString(),
                end: today.toISOString()
            },
            calls: {
                total: calls.length,
                completed: completedCalls,
                failed: failedCalls
            },
            totalDurationMinutes: Math.round(totalDuration / 60),
            balance: balance
        };
    } catch (error) {
        console.error('[Twilio Sync] Error fetching usage:', error.message);
        throw error;
    }
}

export default {
    fetchTwilioCalls,
    syncTwilioCalls,
    getTwilioUsage
};
