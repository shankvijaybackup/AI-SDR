import express from 'express';
import prisma from '../lib/prisma.js';
import { getActiveCall, activeCalls } from './initiate-call.js';
import { getCall as getCallFromRedis } from '../callState.js';
import { summarizeCall } from '../openaiClient.js';
import { handleCallComplete as handleBulkCallComplete } from '../services/bulkCallManager.js';

const router = express.Router();

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
        // 1. Get InMemory Call State + Redis Call State
        // CRITICAL FIX: Check Redis first since that's where transcripts are stored
        let activeCall = await getCallFromRedis(CallSid);

        // Fallback to old activeCalls Map if not in Redis
        if (!activeCall) {
            activeCall = getActiveCall(CallSid) || (callId ? getActiveCall(callId) : null);
            console.log(`[Twilio Webhook] Using activeCalls Map for ${CallSid} (Redis lookup returned null)`);
        } else {
            console.log(`[Twilio Webhook] ✅ Retrieved call from Redis with ${activeCall.transcript?.length || 0} transcript entries`);
        }

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
            console.log(`\n[Twilio Webhook] 📝 SAVING TRANSCRIPT FOR CALL ${CallSid}`);
            console.log(`[Twilio Webhook] Transcript Array Length: ${activeCall.transcript.length} entries`);

            // Log every single entry for verification
            console.log(`[Twilio Webhook] COMPLETE TRANSCRIPT DUMP:`);
            activeCall.transcript.forEach((entry, idx) => {
                console.log(`  Entry ${idx + 1}/${activeCall.transcript.length}:`);
                console.log(`    Speaker: ${entry.speaker}`);
                console.log(`    Text: "${entry.text}"`);
                console.log(`    Characters: ${entry.text?.length || 0}`);
                console.log(`    Timestamp: ${entry.timestamp || 'N/A'}`);
            });

            console.log(`[Twilio Webhook] Generating summary for call ${CallSid}...`);
            try {
                const summary = await summarizeCall({ transcript: activeCall.transcript });
                updateData.aiSummary = summary;

                // Save full transcript
                updateData.transcript = activeCall.transcript;

                // Simple sentiment inference (placeholder)
                updateData.sentimentScore = 0.5;

                console.log(`[Twilio Webhook] ✅ Summary generated: ${summary.substring(0, 50)}...`);
                console.log(`[Twilio Webhook] ✅ Transcript will be saved to database (${activeCall.transcript.length} entries)`);
            } catch (err) {
                console.error(`[Twilio Webhook] ❌ Summary generation failed:`, err);
            }
        } else if (activeCall?.transcript) {
            // Save transcript even if not completed successfully (e.g. failed mid-call)
            console.log(`[Twilio Webhook] ⚠️ Call ${CallSid} not completed but has ${activeCall.transcript.length} transcript entries - saving anyway`);
            updateData.transcript = activeCall.transcript;
        } else {
            console.warn(`[Twilio Webhook] ⚠️ No transcript found for call ${CallSid} (Status: ${CallStatus})`);
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
            console.log(`[Twilio Webhook] 💾 WRITING TO DATABASE - Call ${dbCall.id}`);
            if (updateData.transcript) {
                console.log(`[Twilio Webhook] Database write includes ${updateData.transcript.length} transcript entries`);
            }

            await prisma.call.update({
                where: { id: dbCall.id },
                data: updateData
            });

            console.log(`[Twilio Webhook] ✅ DATABASE WRITE SUCCESSFUL for Call ${dbCall.id}`);

            // Verify the write by reading back
            const verifyCall = await prisma.call.findUnique({
                where: { id: dbCall.id },
                select: {
                    id: true,
                    transcript: true,
                    status: true,
                    duration: true
                }
            });

            if (verifyCall) {
                const transcriptLength = Array.isArray(verifyCall.transcript) ? verifyCall.transcript.length : 0;
                console.log(`[Twilio Webhook] ✅ VERIFICATION: Database now shows ${transcriptLength} transcript entries for call ${dbCall.id}`);

                if (updateData.transcript && transcriptLength !== updateData.transcript.length) {
                    console.error(`[Twilio Webhook] ❌ CRITICAL: Transcript length mismatch! Tried to save ${updateData.transcript.length} but database has ${transcriptLength}`);
                }
            }
        } else {
            console.warn(`[Twilio Webhook] ⚠️ Call record not found in DB for SID ${CallSid}`);
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
