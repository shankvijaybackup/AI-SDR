import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getActiveCall, activeCalls } from './initiate-call.js';
import { summarizeCall } from '../openaiClient.js';
import { handleCallComplete as handleBulkCallComplete } from '../services/bulkCallManager.js';

const router = express.Router();
const prisma = new PrismaClient();

// Handle Twilio Status Callbacks (Completed, Busy, No Answer, etc.)
router.post('/status', async (req, res) => {
    // Twilio sends data in body (urlencoded)
    const { CallSid, CallStatus, CallDuration, callId: queryCallId, campaignId: queryCampaignId } = req.body;
    // We also passed callId/campaignId in query params usually, check req.query if not in body (Twilio merges them sometimes or we need to look at req.query)
    const callId = req.query.callId || req.body.callId;
    const campaignId = req.query.campaignId || req.body.campaignId;

    console.log(`[Twilio Webhook] Status: ${CallStatus}, CallSid: ${CallSid}, CallId: ${callId}`);

    // Ack Twilio request immediately to avoid timeouts
    res.sendStatus(200);

    try {
        // 1. Get InMemory Call State
        // Call might be indexed by CallSid or CallId
        let activeCall = getActiveCall(CallSid) || (callId ? getActiveCall(callId) : null);

        // 2. Determine Outcome
        let outcome = 'unknown';
        if (CallStatus === 'completed') outcome = 'connected';
        else if (['busy', 'no-answer', 'canceled', 'failed'].includes(CallStatus)) outcome = CallStatus;

        // 3. Prepare Update Data
        const updateData = {
            status: CallStatus,
            twilioCallSid: CallSid // Ensure it's linked
        };

        if (CallDuration) {
            updateData.duration = parseInt(CallDuration, 10);
        }

        // 4. If Completed, Generate Summary & Notes
        if (CallStatus === 'completed' && activeCall && activeCall.transcript && activeCall.transcript.length > 0) {
            console.log(`[Twilio Webhook] Generating summary for call ${CallSid}...`);
            try {
                const summary = await summarizeCall({ transcript: activeCall.transcript });
                updateData.aiSummary = summary;

                // Save full transcript
                updateData.transcript = activeCall.transcript;

                // Simple sentiment inference (placeholder)
                updateData.sentimentScore = 0.5;

                console.log(`[Twilio Webhook] Summary generated: ${summary.substring(0, 50)}...`);
            } catch (err) {
                console.error(`[Twilio Webhook] Summary generation failed:`, err);
            }
        } else if (activeCall?.transcript) {
            // Save transcript even if not completed successfully (e.g. failed mid-call)
            updateData.transcript = activeCall.transcript;
        }

        // 5. Update Database
        // Find existing call record first
        const dbCall = await prisma.call.findFirst({
            where: {
                OR: [
                    { twilioCallSid: CallSid },
                    { id: callId }
                ]
            }
        });

        if (dbCall) {
            await prisma.call.update({
                where: { id: dbCall.id },
                data: updateData
            });
            console.log(`[Twilio Webhook] DB Updated for Call ${dbCall.id}`);
        } else {
            console.warn(`[Twilio Webhook] Call record not found in DB for SID ${CallSid}`);
        }

        // 6. Handle Campaign Logic
        if (campaignId) {
            // Need to pass internal call ID if possible, or campaign manager handles it
            await handleBulkCallComplete(dbCall?.id || callId, campaignId, CallStatus);
        }

        // 7. Cleanup Memory if terminal status
        if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
            // Wait a moment before cleanup in case late media packets arrive
            setTimeout(() => {
                if (activeCalls.has(CallSid)) activeCalls.delete(CallSid);
                if (callId && activeCalls.has(callId)) activeCalls.delete(callId);
                console.log(`[Twilio Webhook] Cleared memory for ${CallSid}`);
            }, 5000);
        }

    } catch (error) {
        console.error(`[Twilio Webhook] Error processing status:`, error);
    }
});

// Handle AMD (Answering Machine Detection)
router.post('/amd-status', async (req, res) => {
    const { CallSid, AnsweredBy } = req.body;
    console.log(`[Twilio AMD] Call ${CallSid} answered by: ${AnsweredBy}`);

    // Potentially update call status or hang up if machine
    // For now just log it
    res.sendStatus(200);
});

export default router;
