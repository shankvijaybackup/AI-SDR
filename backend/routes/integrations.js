import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getAuthUrl, exchangeCodeForTokens } from '../hubspotClient.js';

const router = express.Router();
const prisma = new PrismaClient();

// Redirect to HubSpot Auth
router.get('/hubspot/auth', (req, res) => {
    const { companyId } = req.query;

    if (!companyId) {
        return res.status(400).send('Missing companyId');
    }

    // Use companyId as state
    const authUrl = getAuthUrl() + `&state=${encodeURIComponent(companyId)}`;
    res.redirect(authUrl);
});

// OAuth Callback
router.get('/hubspot/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error('HubSpot Auth Error:', error);
        return res.redirect(`${process.env.FRONTEND_ORIGIN}/settings?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return res.status(400).send('Missing code or state');
    }

    const companyId = state;

    try {
        const tokens = await exchangeCodeForTokens(code);

        // tokens: { access_token, refresh_token, expires_in, ... }
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

        // Update Company Settings
        await prisma.companySettings.upsert({
            where: { companyId },
            update: {
                hubspotConnected: true,
                hubspotAccessToken: tokens.access_token,
                hubspotRefreshToken: tokens.refresh_token,
                hubspotExpiresAt: expiresAt,
            },
            create: {
                companyId,
                hubspotConnected: true,
                hubspotAccessToken: tokens.access_token,
                hubspotRefreshToken: tokens.refresh_token,
                hubspotExpiresAt: expiresAt,
            }
        });

        // Determine Frontend URL (hardcoded or env)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/settings?success=hubspot_connected`);

    } catch (err) {
        console.error('Failed to exchange tokens:', err);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/settings?error=token_exchange_failed`);
    }
});

export default router;
