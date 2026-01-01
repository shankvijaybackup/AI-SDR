import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getAuthUrl, exchangeCodeForTokens, getLists, refreshAccessToken } from '../hubspotClient.js';
import { importFromList } from '../services/hubspotSync.js';

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

// ... (existing imports)


// ... (existing routes)

// LISTS API: Fetch available Contact Lists
router.get('/hubspot/lists', async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).send('Missing companyId');

    try {
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        if (!settings?.hubspotAccessToken) return res.status(401).send('Not connected');

        let accessToken = settings.hubspotAccessToken;
        // Basic Token Refresh Check (Should use shared middleware/service ideally)
        if (settings.hubspotExpiresAt && new Date() > new Date(settings.hubspotExpiresAt.getTime() - 60000)) {
            const tokens = await refreshAccessToken(settings.hubspotRefreshToken);
            accessToken = tokens.access_token;
            await prisma.companySettings.update({
                where: { companyId },
                data: { hubspotAccessToken: tokens.access_token, hubspotExpiresAt: new Date(Date.now() + tokens.expires_in * 1000) }
            });
        }

        const listsRes = await getLists(accessToken);
        res.json({ lists: listsRes.lists || [] });
    } catch (err) {
        console.error('Failed to fetch lists:', err);
        res.status(500).json({ error: err.message });
    }
});

// IMPORT API: Trigger import from specific List
router.post('/hubspot/import-list', async (req, res) => {
    const { companyId, listId } = req.body;
    if (!companyId || !listId) return res.status(400).send('Missing params');

    try {
        // Run import (async or await? For MVP await to show result, or async for background)
        // Let's await for now to give immediate feedback on small lists
        const result = await importFromList(companyId, listId);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Import failed:', err);
        res.status(500).json({ error: err.message });
    }
});


export default router;
