import express from 'express';
import prisma from '../lib/prisma.js';
import { enrichLeadWithLinkedIn, validateLinkedInSession } from '../services/linkedinEnrichment.js';

const router = express.Router();

// List leads
router.get('/', async (req, res) => {
    const { companyId, page = 1, limit = 50, search, status } = req.query;

    if (!companyId) {
        return res.status(400).json({ error: 'companyId is required' });
    }

    const skip = (page - 1) * limit;

    const where = {
        companyId: companyId,
        ...(status && { status }),
        ...(search && {
            OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } }
            ]
        })
    };

    try {
        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    account: {
                        include: {
                            signals: {
                                orderBy: { createdAt: 'desc' },
                                take: 20
                            }
                        }
                    },
                    signals: {
                        orderBy: { createdAt: 'desc' },
                        take: 10
                    }
                }
            }),
            prisma.lead.count({ where })
        ]);

        res.json({
            data: leads,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('List leads error:', error);
        res.status(500).json({ error: 'Failed to list leads' });
    }
});

// Get lead by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const lead = await prisma.lead.findUnique({
            where: { id },
            include: {
                account: true,
                calls: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(lead);
    } catch (error) {
        console.error('Get lead error:', error);
        res.status(500).json({ error: 'Failed to get lead' });
    }
});

// Create new lead
router.post('/', async (req, res) => {
    const {
        companyId,
        userId,
        accountId,
        firstName,
        lastName,
        email,
        phone,
        company,
        jobTitle,
        linkedinUrl,
        notes,
        status = 'new'
    } = req.body;

    if (!companyId || !userId || !firstName || !lastName || !phone) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['companyId', 'userId', 'firstName', 'lastName', 'phone']
        });
    }

    try {
        const lead = await prisma.lead.create({
            data: {
                companyId,
                userId,
                accountId,
                firstName,
                lastName,
                email,
                phone,
                company,
                jobTitle,
                linkedinUrl,
                notes,
                status
            }
        });

        res.status(201).json(lead);
    } catch (error) {
        console.error('Create lead error:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// Update lead
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.companyId;

    try {
        const lead = await prisma.lead.update({
            where: { id },
            data: updateData
        });

        res.json(lead);
    } catch (error) {
        console.error('Update lead error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// Enrich lead with LinkedIn data
router.post('/:id/enrich', async (req, res) => {
    const { id } = req.params;

    try {
        // Enrich the lead (pass prisma instance)
        // The enrichLeadWithLinkedIn function handles RAPIDAPI_KEY or LINKEDIN_COOKIE internally
        const enrichedLead = await enrichLeadWithLinkedIn(id, prisma);

        res.json({
            message: 'Lead enriched successfully',
            lead: enrichedLead
        });

    } catch (error) {
        console.error('Enrich lead error:', error);

        // Return appropriate error
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (error.message.includes('LinkedIn URL') || error.message.includes('firstName')) {
            return res.status(400).json({
                error: 'Insufficient data for enrichment',
                message: 'Lead needs either: (1) LinkedIn URL, or (2) firstName + lastName + company'
            });
        }

        if (error.message.includes('not configured')) {
            return res.status(500).json({
                error: 'Enrichment not configured',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Enrichment failed',
            message: error.message
        });
    }
});

// Validate LinkedIn session
router.get('/system/linkedin-status', async (req, res) => {
    try {
        const status = await validateLinkedInSession();
        res.json(status);
    } catch (error) {
        res.status(500).json({
            valid: false,
            error: 'Failed to check LinkedIn session'
        });
    }
});

// Delete lead
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.lead.delete({
            where: { id }
        });

        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Delete lead error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

export default router;
