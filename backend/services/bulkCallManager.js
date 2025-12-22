/**
 * Bulk Call Manager Service
 * Handles sequential execution of bulk calling campaigns
 */

// Import Prisma client (installed in backend's node_modules)
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client for backend
const prisma = new PrismaClient();

// Store active campaign states
const activeCampaigns = new Map();

/**
 * Start a bulk calling campaign
 */
async function startCampaign(campaignId, userId) {
    console.log(`[BulkCall] Starting campaign ${campaignId}`);

    try {
        // Fetch campaign from database
        const campaign = await prisma.bulkCallCampaign.findFirst({
            where: { id: campaignId, userId },
            include: {
                script: true,
            },
        });

        if (!campaign) {
            console.error(`[BulkCall] Campaign ${campaignId} not found`);
            return { error: 'Campaign not found' };
        }

        // Initialize campaign state
        activeCampaigns.set(campaignId, {
            status: 'running',
            paused: false,
            currentIndex: campaign.currentLeadIndex,
        });

        // Start processing calls
        processNextCall(campaignId);

        return { success: true, campaignId };
    } catch (error) {
        console.error(`[BulkCall] Error starting campaign:`, error);
        return { error: error.message };
    }
}

/**
 * Process the next call in the campaign queue
 */
async function processNextCall(campaignId) {
    const state = activeCampaigns.get(campaignId);

    if (!state || state.paused || state.status === 'cancelled') {
        console.log(`[BulkCall] Campaign ${campaignId} is paused or cancelled, stopping`);
        return;
    }

    try {
        // Fetch current campaign state from database
        const campaign = await prisma.bulkCallCampaign.findUnique({
            where: { id: campaignId },
            include: { script: true },
        });

        if (!campaign || campaign.status === 'cancelled' || campaign.status === 'completed') {
            console.log(`[BulkCall] Campaign ${campaignId} is no longer active`);
            activeCampaigns.delete(campaignId);
            return;
        }

        if (campaign.status === 'paused') {
            console.log(`[BulkCall] Campaign ${campaignId} is paused`);
            state.paused = true;
            return;
        }

        const currentIndex = campaign.currentLeadIndex;

        // Check if all leads have been called
        if (currentIndex >= campaign.leadIds.length) {
            console.log(`[BulkCall] Campaign ${campaignId} completed all calls`);
            await prisma.bulkCallCampaign.update({
                where: { id: campaignId },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                },
            });
            activeCampaigns.delete(campaignId);
            return;
        }

        const leadId = campaign.leadIds[currentIndex];
        console.log(`[BulkCall] Processing lead ${currentIndex + 1}/${campaign.leadIds.length}: ${leadId}`);

        // Fetch lead details
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
        });

        if (!lead || !lead.phone) {
            console.log(`[BulkCall] Lead ${leadId} not found or no phone, skipping`);
            await skipToNextLead(campaignId, campaign, 'no_phone');
            return;
        }

        // Prepare personalized script
        let personalizedScript = campaign.script.content
            .replace(/\{\{firstName\}\}/g, lead.firstName)
            .replace(/\{\{lastName\}\}/g, lead.lastName)
            .replace(/\{\{company\}\}/g, lead.company || '')
            .replace(/\{\{jobTitle\}\}/g, lead.jobTitle || '')
            .replace(/\{\{repName\}\}/g, 'Alex');

        // Create call record
        const call = await prisma.call.create({
            data: {
                userId: campaign.userId,
                leadId: lead.id,
                scriptId: campaign.scriptId,
                campaignId: campaign.id,
                voicePersona: 'auto',
                status: 'initiated',
                transcript: [],
            },
        });

        console.log(`[BulkCall] Created call ${call.id} for lead ${leadId}`);

        // Initiate the actual Twilio call
        try {
            const twilioResponse = await initiateCallViaTwilio({
                callId: call.id,
                phoneNumber: lead.phone,
                script: personalizedScript,
                leadName: `${lead.firstName} ${lead.lastName}`,
                leadEmail: lead.email,
                region: lead.region,
                campaignId: campaign.id,
            });

            if (twilioResponse.callSid) {
                // Update call with Twilio SID
                await prisma.call.update({
                    where: { id: call.id },
                    data: {
                        twilioCallSid: twilioResponse.callSid,
                        status: 'calling',
                    },
                });
                console.log(`[BulkCall] Twilio call started: ${twilioResponse.callSid}`);
            }
        } catch (twilioError) {
            console.error(`[BulkCall] Twilio call failed:`, twilioError);
            await prisma.call.update({
                where: { id: call.id },
                data: { status: 'failed' },
            });

            // Update campaign stats and move to next
            await prisma.bulkCallCampaign.update({
                where: { id: campaignId },
                data: {
                    failedCalls: { increment: 1 },
                    completedCalls: { increment: 1 },
                    currentLeadIndex: { increment: 1 },
                },
            });

            // Schedule next call with delay
            setTimeout(() => processNextCall(campaignId), campaign.delayBetweenCalls * 1000);
        }
    } catch (error) {
        console.error(`[BulkCall] Error processing call:`, error);
    }
}

/**
 * Skip to next lead (when current lead is invalid)
 */
async function skipToNextLead(campaignId, campaign, reason) {
    await prisma.bulkCallCampaign.update({
        where: { id: campaignId },
        data: {
            currentLeadIndex: { increment: 1 },
            failedCalls: { increment: 1 },
            completedCalls: { increment: 1 },
        },
    });

    console.log(`[BulkCall] Skipped lead (${reason}), moving to next`);
    setTimeout(() => processNextCall(campaignId), 1000);
}

/**
 * Initiate a call via the existing Twilio initiate-call route
 */
async function initiateCallViaTwilio(params) {
    const { createOutboundCall } = await import('../twilioClient.js');
    const { initCall } = await import('../callState.js');
    const { setVoiceForCall } = await import('../server.js');
    const { getVoiceByLocation } = await import('../utils/voice-rotation.js');

    // Select voice based on lead's region
    const selectedVoice = getVoiceByLocation(params.region);

    const publicBaseUrl = process.env.PUBLIC_BASE_URL;

    // Create Twilio call
    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const call = await client.calls.create({
        url: `${publicBaseUrl}/api/twilio/voice?callId=${params.callId}&voicePersona=${selectedVoice.name}&script=${encodeURIComponent(params.script)}`,
        to: params.phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
        statusCallback: `${publicBaseUrl}/api/twilio/status?callId=${params.callId}&campaignId=${params.campaignId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
    });

    // Store voice for this call
    setVoiceForCall(call.sid, selectedVoice.id);

    // Initialize call state
    initCall(call.sid, {
        script: params.script,
        leadName: params.leadName,
        companyName: '',
        userId: null,
        campaignId: params.campaignId,
    });

    return { callSid: call.sid, status: call.status };
}

/**
 * Handle call completion (called from Twilio status callback)
 */
async function handleCallComplete(callId, campaignId, callStatus) {
    console.log(`[BulkCall] Call ${callId} completed with status: ${callStatus}`);

    if (!campaignId) return;

    try {
        // Determine if call was successful
        const isSuccess = callStatus === 'completed';

        // Update campaign stats
        await prisma.bulkCallCampaign.update({
            where: { id: campaignId },
            data: {
                completedCalls: { increment: 1 },
                ...(isSuccess ? { successfulCalls: { increment: 1 } } : { failedCalls: { increment: 1 } }),
                currentLeadIndex: { increment: 1 },
            },
        });

        // Fetch campaign to check delay
        const campaign = await prisma.bulkCallCampaign.findUnique({
            where: { id: campaignId },
        });

        if (campaign && campaign.status === 'running') {
            // Schedule next call with delay
            console.log(`[BulkCall] Scheduling next call in ${campaign.delayBetweenCalls}s`);
            setTimeout(() => processNextCall(campaignId), campaign.delayBetweenCalls * 1000);
        }
    } catch (error) {
        console.error(`[BulkCall] Error handling call completion:`, error);
    }
}

/**
 * Control campaign (pause/resume/cancel)
 */
async function controlCampaign(campaignId, action) {
    console.log(`[BulkCall] Control action: ${action} for campaign ${campaignId}`);

    const state = activeCampaigns.get(campaignId);

    switch (action) {
        case 'pause':
            if (state) state.paused = true;
            break;
        case 'resume':
            if (state) {
                state.paused = false;
                processNextCall(campaignId);
            } else {
                // Re-initialize and resume
                const campaign = await prisma.bulkCallCampaign.findUnique({
                    where: { id: campaignId },
                });
                if (campaign) {
                    activeCampaigns.set(campaignId, {
                        status: 'running',
                        paused: false,
                        currentIndex: campaign.currentLeadIndex,
                    });
                    processNextCall(campaignId);
                }
            }
            break;
        case 'cancel':
            if (state) {
                state.status = 'cancelled';
                activeCampaigns.delete(campaignId);
            }
            break;
    }

    return { success: true, action };
}

export {
    startCampaign,
    processNextCall,
    handleCallComplete,
    controlCampaign,
};
