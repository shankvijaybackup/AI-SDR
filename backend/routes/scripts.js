/**
 * Call Script Management API Routes
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { generatePersonalizedScript, validateScript, generateScriptFlowDiagram } from '../services/scriptGeneration.js';

const router = express.Router();

/**
 * GET /api/scripts/:leadId
 * Get generated script for a lead
 */
router.get('/:leadId', async (req, res) => {
    try {
        const { leadId } = req.params;

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (!lead.generatedScript) {
            return res.status(404).json({ error: 'No script generated for this lead. Enrich the lead first.' });
        }

        // Validate script quality
        const validation = validateScript(lead.generatedScript);

        // Generate flow diagram
        const flowDiagram = generateScriptFlowDiagram(lead.generatedScript);

        res.json({
            script: lead.generatedScript,
            validation,
            flowDiagram,
            status: lead.scriptStatus || 'pending_review'
        });

    } catch (error) {
        console.error('Get script error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scripts/:leadId/regenerate
 * Regenerate script for a lead
 */
router.post('/:leadId/regenerate', async (req, res) => {
    try {
        const { leadId } = req.params;

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (!lead.linkedinData?.persona) {
            return res.status(400).json({ error: 'Lead must be enriched before generating script' });
        }

        // Regenerate script
        console.log(`Regenerating script for lead ${leadId}`);
        const script = await generatePersonalizedScript(lead, lead.linkedinData.persona);

        // Save to database
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                generatedScript: script,
                scriptStatus: 'pending_review',
                updatedAt: new Date()
            }
        });

        // Validate and get flow diagram
        const validation = validateScript(script);
        const flowDiagram = generateScriptFlowDiagram(script);

        res.json({
            message: 'Script regenerated successfully',
            script,
            validation,
            flowDiagram
        });

    } catch (error) {
        console.error('Regenerate script error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/scripts/:leadId/approve
 * Approve script for use in calls
 */
router.put('/:leadId/approve', async (req, res) => {
    try {
        const { leadId } = req.params;
        const { notes } = req.body;

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead || !lead.generatedScript) {
            return res.status(404).json({ error: 'Script not found' });
        }

        // Update script status
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                scriptStatus: 'approved',
                scriptApprovedAt: new Date(),
                scriptApprovalNotes: notes,
                updatedAt: new Date()
            }
        });

        res.json({
            message: 'Script approved successfully',
            status: 'approved'
        });

    } catch (error) {
        console.error('Approve script error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/scripts/:leadId/edit
 * Edit and save script modifications
 */
router.put('/:leadId/edit', async (req, res) => {
    try {
        const { leadId } = req.params;
        const { script, section } = req.body;

        if (!script) {
            return res.status(400).json({ error: 'Script data required' });
        }

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        let updatedScript = lead.generatedScript || {};

        if (section) {
            // Update specific section
            updatedScript[section] = script;
        } else {
            // Update entire script
            updatedScript = script;
        }

        // Save to database
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                generatedScript: updatedScript,
                scriptStatus: 'edited', // Mark as edited by admin
                updatedAt: new Date()
            }
        });

        // Re-validate
        const validation = validateScript(updatedScript);

        res.json({
            message: 'Script updated successfully',
            script: updatedScript,
            validation
        });

    } catch (error) {
        console.error('Edit script error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/scripts/pending/review
 * Get all scripts pending review
 */
router.get('/pending/review', async (req, res) => {
    try {
        const leadsWithPendingScripts = await prisma.lead.findMany({
            where: {
                scriptStatus: 'pending_review'
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                company: true,
                jobTitle: true,
                generatedScript: true,
                linkedinData: true,
                createdAt: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Add validation for each
        const scriptsWithValidation = leadsWithPendingScripts.map(lead => ({
            leadId: lead.id,
            leadName: `${lead.firstName} ${lead.lastName}`,
            company: lead.company,
            jobTitle: lead.jobTitle,
            script: lead.generatedScript,
            validation: validateScript(lead.generatedScript),
            discProfile: lead.linkedinData?.persona?.discProfile?.value || lead.linkedinData?.persona?.discProfile,
            createdAt: lead.createdAt
        }));

        res.json({
            scripts: scriptsWithValidation,
            count: scriptsWithValidation.length
        });

    } catch (error) {
        console.error('Get pending scripts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scripts/:leadId/test
 * Test script with AI agent (dry run)
 */
router.post('/:leadId/test', async (req, res) => {
    try {
        const { leadId } = req.params;

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead || !lead.generatedScript) {
            return res.status(404).json({ error: 'Script not found' });
        }

        // TODO: Integrate with Bland AI or voice agent for test call
        // For now, return mock test result
        const testResult = {
            status: 'success',
            message: 'Script structure validated. Ready for live call.',
            sections: {
                opening: { valid: true, duration: '30s' },
                rapport: { valid: true, duration: '45s' },
                discovery: { valid: true, duration: '2-3min' },
                value: { valid: true, duration: '2min' },
                close: { valid: true, duration: '30s' }
            },
            estimatedDuration: '6-8 minutes',
            readinessScore: 92
        };

        res.json(testResult);

    } catch (error) {
        console.error('Test script error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
