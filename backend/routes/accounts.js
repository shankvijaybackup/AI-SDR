import express from 'express';
import { PrismaClient } from '@prisma/client';
import { syncHubSpotAccount } from '../services/hubspotSync.js';
import { enrichAccount } from '../services/enrichment.js';

const router = express.Router();
const prisma = new PrismaClient();

// List Accounts
router.get('/', async (req, res) => {
    const { companyId, page = 1, limit = 50, search } = req.query;
    const skip = (page - 1) * limit;

    // Filter accessible accounts
    // In a real multi-tenant app, we'd check req.user.companyId from middleware.
    // For now, accept companyId query param as "current tenant".

    if (!companyId) return res.status(400).send('companyId is required');

    const where = {
        companyId: companyId,
        ...(search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { domain: { contains: search, mode: 'insensitive' } }
            ]
        } : {})
    };

    try {
        const [accounts, total] = await Promise.all([
            prisma.account.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    _count: {
                        select: { leads: true }
                    }
                }
            }),
            prisma.account.count({ where })
        ]);

        res.json({
            data: accounts,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('List Accounts Error:', error);
        res.status(500).send('Failed to list accounts');
    }
});

// Get Account Detail
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const account = await prisma.account.findUnique({
            where: { id },
            include: {
                leads: {
                    orderBy: { createdAt: 'desc' },
                    take: 20 // Recent contacts
                }
            }
        });

        if (!account) return res.status(404).send('Account not found');
        res.json(account);
    } catch (error) {
        console.error('Get Account Error:', error);
        res.status(500).send('Failed to get account');
    }
});

// Trigger Enrichment
router.post('/:id/enrich', async (req, res) => {
    const { id } = req.params;
    try {
        const success = await enrichAccount(id);
        if (success) {
            const updated = await prisma.account.findUnique({ where: { id } });
            res.json(updated);
        } else {
            res.status(400).send('Enrichment failed or yielded no data');
        }
    } catch (error) {
        console.error('Enrich Account Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Trigger HubSpot Sync
router.post('/sync/hubspot', async (req, res) => {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).send('companyId is required');

    try {
        // Run async/background
        syncHubSpotAccount(companyId).catch(err => console.error('Background Sync Error:', err));
        res.json({ message: 'Sync started' });
    } catch (error) {
        console.error('Sync Trigger Error:', error);
        res.status(500).send('Failed to trigger sync');
    }
});

export default router;
