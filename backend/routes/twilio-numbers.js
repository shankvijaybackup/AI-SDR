import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const backendUrl = process.env.PUBLIC_BASE_URL;

if (!accountSid || !authToken) {
    console.warn('[Twilio Numbers] Missing TWILIO credentials');
}

const client = twilio(accountSid, authToken);

/**
 * Search for available Twilio phone numbers
 */
export async function searchAvailableNumbers(req, res) {
    try {
        const { country = 'US', areaCode, contains, limit = 20 } = req.query;

        if (!accountSid || !authToken) {
            return res.status(500).json({ error: 'Twilio credentials not configured' });
        }

        console.log(`[Twilio] Searching numbers: country=${country}, areaCode=${areaCode}`);

        // Search for available phone numbers
        const numbers = await client.availablePhoneNumbers(country).local.list({
            areaCode: areaCode ? parseInt(areaCode) : undefined,
            contains,
            limit: parseInt(limit),
            voiceEnabled: true,
        });

        // Format results
        const formatted = numbers.map(num => ({
            phoneNumber: num.phoneNumber,
            friendlyName: num.friendlyName,
            locality: num.locality,
            region: num.region,
            capabilities: num.capabilities,
            // Estimate monthly cost (Twilio pricing varies by country)
            estimatedCost: country === 'US' ? 1.00 : 1.50
        }));

        res.json({ numbers: formatted });
    } catch (error) {
        console.error('[Twilio] Search error:', error);
        res.status(500).json({
            error: 'Failed to search numbers',
            details: error.message
        });
    }
}

/**
 * Purchase a Twilio phone number
 */
export async function purchaseNumber(req, res) {
    try {
        const { phoneNumber, region } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        if (!accountSid || !authToken || !backendUrl) {
            return res.status(500).json({ error: 'Twilio credentials or backend URL not configured' });
        }

        console.log(`[Twilio] Purchasing number: ${phoneNumber}`);

        // Purchase the number with webhook configuration
        const purchasedNumber = await client.incomingPhoneNumbers.create({
            phoneNumber,
            voiceUrl: `${backendUrl}/api/twilio/voice`,
            statusCallback: `${backendUrl}/api/twilio/status`,
            statusCallbackMethod: 'POST',
            voiceMethod: 'POST'
        });

        // Auto-detect region from country code if not provided
        let detectedRegion = region;
        if (!detectedRegion) {
            if (phoneNumber.startsWith('+1')) detectedRegion = 'US';
            else if (phoneNumber.startsWith('+44')) detectedRegion = 'UK';
            else if (phoneNumber.startsWith('+61')) detectedRegion = 'ANZ';
            else if (phoneNumber.startsWith('+91')) detectedRegion = 'India';
            else detectedRegion = 'Other';
        }

        res.json({
            success: true,
            number: {
                sid: purchasedNumber.sid,
                phoneNumber: purchasedNumber.phoneNumber,
                friendlyName: purchasedNumber.friendlyName,
                region: detectedRegion,
                capabilities: purchasedNumber.capabilities,
                provider: 'twilio',
                twilioSid: purchasedNumber.sid
            }
        });
    } catch (error) {
        console.error('[Twilio] Purchase error:', error);
        res.status(500).json({
            error: 'Failed to purchase number',
            details: error.message
        });
    }
}

/**
 * Release a Twilio phone number
 */
export async function releaseNumber(req, res) {
    try {
        const { twilioSid } = req.query;

        if (!twilioSid) {
            return res.status(400).json({ error: 'Twilio SID is required' });
        }

        if (!accountSid || !authToken) {
            return res.status(500).json({ error: 'Twilio credentials not configured' });
        }

        console.log(`[Twilio] Releasing number: ${twilioSid}`);

        // Release the number from Twilio
        await client.incomingPhoneNumbers(twilioSid).remove();

        res.json({
            success: true,
            message: 'Number released successfully'
        });
    } catch (error) {
        console.error('[Twilio] Release error:', error);
        res.status(500).json({
            error: 'Failed to release number',
            details: error.message
        });
    }
}
