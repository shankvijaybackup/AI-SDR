import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Example customer references for script generation
const CUSTOMER_REFERENCES = {
  financial_services: [
    { name: 'Pepper Money', region: 'ANZ', industry: 'Financial Services', users: 2038 },
    { name: 'Zuora', region: 'USA', industry: 'Financial Services', users: 1842 },
  ],
  government: [
    { name: 'SIA', region: 'ANZ', industry: 'Public Sector/Insurance', users: 219 },
    { name: 'icare NSW', region: 'ANZ', industry: 'Government', users: 5000 },
  ],
  pharma: [
    { name: 'Abzena', region: 'UK', industry: 'Life Sciences', users: 564 },
    { name: 'StructureTx', region: 'USA', industry: 'Biotechnology', users: 610 },
  ],
  healthcare: [
    { name: 'AVMC', region: 'USA', industry: 'Healthcare', users: 7487 },
  ],
  media: [
    { name: 'Mari', region: 'USA', industry: 'Media & Entertainment', users: 488 },
    { name: 'oOh!media', region: 'ANZ', industry: 'Media & Advertising', users: 800 },
  ],
  technology: [
    { name: 'High Level', region: 'USA', industry: 'Marketing', users: 3202 },
    { name: 'HighRadius', region: 'USA', industry: 'Technology', users: 4090 },
  ],
};

// Atomicwork credibility points
const ATOMICWORK_CREDIBILITY = `
Founded by proven leaders:
- Vijay Rayapati (CEO): Ex-Nutanix GM, led successful exit (Minjar acquired by Nutanix)
- Kiran Darisi (CTO): Co-founder of Freshworks (IPO: $10B+ valuation)
- Parsuram Vijayasankar (Chief Designer): Co-founder of Freshworks

Funding: $40M total
- $11M Seed (Sep 2023): Blume Ventures, Z47 (Matrix Partners)
- $3M Strategic (Sep 2024): 40+ global CIOs/CTOs
- $25M Series A (Jan 2025): Khosla Ventures (lead), Battery Ventures, Peak XV Partners

AI-native employee service management platform helping companies transform IT support.
`;

/**
 * GET /api/leads/:id/script
 * Get generated script for a lead
 */
router.get('/:id/script', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        companyId: true,
        jobTitle: true,
        generatedScript: true,
        scriptStatus: true,
        scriptApprovedAt: true,
        scriptApprovalNotes: true,
        linkedinData: true,
      },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Check multi-tenancy
    if (req.user.companyId && lead.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      lead: {
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`,
        company: lead.company,
        jobTitle: lead.jobTitle,
      },
      script: lead.generatedScript,
      status: lead.scriptStatus || 'not_generated',
      approvedAt: lead.scriptApprovedAt,
      approvalNotes: lead.scriptApprovalNotes,
      persona: lead.linkedinData?.persona,
    });
  } catch (error) {
    console.error('Get script error:', error);
    res.status(500).json({ error: 'Failed to get script' });
  }
});

/**
 * POST /api/leads/:id/script/generate
 * Generate a hyper-personalized call script for a lead
 */
router.post('/:id/script/generate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Script Generator] Starting script generation for lead ${id}`);

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });

    if (!lead) {
      console.error(`[Script Generator] Lead not found: ${id}`);
      return res.status(404).json({ error: 'Lead not found' });
    }

    console.log(`[Script Generator] Lead found: ${lead.firstName} ${lead.lastName} at ${lead.company}`);

    // Check multi-tenancy
    if (req.user.companyId && lead.companyId !== req.user.companyId) {
      console.error(`[Script Generator] Access denied for lead ${id} - company mismatch`);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Make enrichment optional - generate basic script even without LinkedIn data
    const isEnriched = lead.linkedinEnriched && lead.linkedinData;
    if (!isEnriched) {
      console.warn(`[Script Generator] Lead ${id} not enriched - generating basic script`);
    }

    const persona = (isEnriched && lead.linkedinData?.persona) ? lead.linkedinData.persona : {};
    const companyContext = lead.account?.enrichmentData || {};

    // Determine industry for customer references
    let customerRefs = [];
    const industry = lead.company?.toLowerCase() || '';
    if (industry.includes('bank') || industry.includes('financial') || industry.includes('fintech')) {
      customerRefs = CUSTOMER_REFERENCES.financial_services;
    } else if (industry.includes('government') || industry.includes('public') || industry.includes('state')) {
      customerRefs = CUSTOMER_REFERENCES.government;
    } else if (industry.includes('pharma') || industry.includes('biotech') || industry.includes('life science')) {
      customerRefs = CUSTOMER_REFERENCES.pharma;
    } else if (industry.includes('health') || industry.includes('hospital') || industry.includes('medical')) {
      customerRefs = CUSTOMER_REFERENCES.healthcare;
    } else if (industry.includes('media') || industry.includes('advertising') || industry.includes('marketing')) {
      customerRefs = CUSTOMER_REFERENCES.media;
    } else {
      customerRefs = CUSTOMER_REFERENCES.technology;
    }

    // Build hyper-personalized script
    const script = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      leadName: `${lead.firstName} ${lead.lastName}`,
      company: lead.company,
      jobTitle: lead.jobTitle,

      introduction: {
        greeting: `Hi ${lead.firstName}, this is Sarah calling from Atomicwork.`,
        permission: `Is this a good time for a quick call? I promise to keep it under 3 minutes if you're open to it.`,
        timing: `I know you're likely in the middle of ${persona.discProfile === 'D' ? 'driving results and executing priorities' : 'your day'}, so I'll be respectful of your time.`,
      },

      credibilityBuilding: {
        introduction: `Quick context on Atomicwork - we're an AI-native employee service management platform.`,
        founders: `Founded by ex-Nutanix and ex-Freshworks leaders - Vijay Rayapati (CEO), Kiran Darisi and Parsuram Vijayasankar (both Freshworks co-founders).`,
        funding: `We recently raised $40M including Series A led by Khosla Ventures.`,
        customerExample: customerRefs.length > 0 ? `Working with companies like ${customerRefs[0].name} in ${customerRefs[0].region}${customerRefs[0].industry ? ` (${customerRefs[0].industry})` : ''} with ${customerRefs[0].users.toLocaleString()}+ users.` : '',
      },

      discovery: {
        contextualOpening: persona.painPoints && persona.painPoints.length > 0
          ? `${lead.firstName}, I noticed from your profile that you're focused on ${persona.painPoints[0]}.`
          : `${lead.firstName}, given your role as ${lead.jobTitle} at ${lead.company}, I imagine you're dealing with employee service challenges.`,

        painPointValidation: persona.painPoints && persona.painPoints.length > 0
          ? `Are you currently facing challenges with ${persona.painPoints.join(', ')}?`
          : `What are your biggest pain points when it comes to IT support and employee services?`,

        smartQuestions: persona.strategicPrep?.smartQuestions || [
          'How is your team currently handling employee IT support requests?',
          'What are the main bottlenecks in your service delivery?',
          'Have you explored AI-powered solutions for automating support?',
        ],
      },

      valueProposition: {
        painToSolution: {
          efficiency: 'Our AI agents can handle routine support tickets 24/7, reducing resolution time by 60% on average.',
          automation: 'We automate repetitive tasks like password resets, access requests, and onboarding workflows.',
          experience: 'Employees get instant responses via Slack/Teams/Email, no more waiting in queues.',
          insights: 'Real-time analytics help you identify patterns and optimize your service delivery.',
        },

        differentiators: [
          'AI-native from the ground up (not bolted on)',
          'Multi-channel support (Slack, Teams, Email, Portal)',
          'Pre-built integrations with your existing tools',
          'Set up in days, not months',
        ],

        socialProof: customerRefs.map(ref => ({
          name: ref.name,
          industry: ref.industry,
          region: ref.region,
          users: ref.users,
          result: 'Reduced ticket volume by 40-60%, improved employee satisfaction scores',
        })),
      },

      objectionHandling: {
        budgetConcern: {
          objection: 'We don\'t have budget right now',
          response: `I totally understand. Let's look at the cost of NOT solving this - what's the current cost of support tickets, agent time, and employee productivity loss? Our ROI typically pays for itself in 6-8 months. Plus, ${persona.motivators?.includes('Results') ? 'I know you\'re focused on results' : 'we can'} show clear value metrics from day one.`,
        },
        changeManagement: {
          objection: 'We just implemented a new system',
          response: `That's actually perfect timing. Atomicwork integrates WITH your existing systems, not replacing them. Think of us as a smart layer on top that makes your current tools work better together.`,
        },
        timing: {
          objection: 'Not the right time',
          response: `Fair enough. When would be a better time to revisit this? I'm happy to set up a brief 15-minute demo when it makes sense for you. In the meantime, can I send you a quick case study from ${customerRefs[0]?.name || 'a similar company'}?`,
        },
      },

      closing: {
        directAsk: persona.discProfile === 'D' || persona.discProfile === 'C'
          ? `${lead.firstName}, based on what we've discussed, I think there's clear value here. Can we schedule a 30-minute demo for next week so you can see this in action?`
          : `${lead.firstName}, I'd love to show you how this works. Would you be open to a quick demo call next week?`,

        alternativeClose: `If a demo isn't the right next step, could I send you a detailed case study and ROI calculator? Then we can reconnect in a few weeks?`,

        urgency: `We're currently running a Q1 promotion for new customers, so there's potential cost savings if we can get you started soon.`,
      },

      agentToneInstructions: {
        communicationStyle: persona.communicationStyle || 'Professional, clear, and respectful',
        discProfile: persona.discProfile || 'Not specified',
        toneGuidance: persona.discProfile === 'D'
          ? 'Be direct, confident, and results-focused. No fluff. Show ROI clearly.'
          : persona.discProfile === 'I'
          ? 'Be enthusiastic, friendly, and relationship-focused. Share stories and build rapport.'
          : persona.discProfile === 'S'
          ? 'Be patient, supportive, and empathetic. Build trust slowly. Emphasize team benefits.'
          : 'Be precise, data-driven, and logical. Provide details, answer questions thoroughly.',

        motivators: Array.isArray(persona.motivators) ? persona.motivators : [],
        avoidTopics: (persona.internalCoaching && Array.isArray(persona.internalCoaching.pitfallsAvoid)) ? persona.internalCoaching.pitfallsAvoid : [],
      },

      additionalNotes: {
        talkingPoints: Array.isArray(persona.talkingPoints) ? persona.talkingPoints : [],
        howToWin: (persona.internalCoaching && Array.isArray(persona.internalCoaching.howToWin)) ? persona.internalCoaching.howToWin : [],
        regionalContext: lead.region || 'Not specified',
        timezone: lead.region === 'ANZ' ? 'AEDT (UTC+11)' : 'Check timezone',
      },
    };

    console.log(`[Script Generator] Script structure created successfully for ${lead.firstName} ${lead.lastName}`);

    // Save script to database
    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        generatedScript: script,
        scriptStatus: 'pending_review',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        generatedScript: true,
        scriptStatus: true,
      },
    });

    console.log(`[Script Generator] Generated script for ${lead.firstName} ${lead.lastName} at ${lead.company}`);

    res.json({
      message: 'Script generated successfully',
      lead: {
        id: updatedLead.id,
        name: `${updatedLead.firstName} ${updatedLead.lastName}`,
      },
      script: updatedLead.generatedScript,
      status: updatedLead.scriptStatus,
    });
  } catch (error) {
    console.error('[Script Generator] ❌ CRITICAL ERROR:');
    console.error('[Script Generator] Error message:', error.message);
    console.error('[Script Generator] Error stack:', error.stack);
    console.error('[Script Generator] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({
      error: 'Failed to generate script',
      details: error.message,
      errorType: error.name || 'UnknownError'
    });
  }
});

/**
 * PATCH /api/leads/:id/script/approve
 * Approve a generated script
 */
router.patch('/:id/script/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Check multi-tenancy
    if (req.user.companyId && lead.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!lead.generatedScript) {
      return res.status(400).json({ error: 'No script to approve' });
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        scriptStatus: 'approved',
        scriptApprovedAt: new Date(),
        scriptApprovalNotes: notes || null,
      },
      select: {
        id: true,
        scriptStatus: true,
        scriptApprovedAt: true,
      },
    });

    res.json({
      message: 'Script approved successfully',
      lead: updatedLead,
    });
  } catch (error) {
    console.error('Approve script error:', error);
    res.status(500).json({ error: 'Failed to approve script' });
  }
});

/**
 * PATCH /api/leads/:id/script
 * Update/edit a generated script
 */
router.patch('/:id/script', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'Script content is required' });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Check multi-tenancy
    if (req.user.companyId && lead.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        generatedScript: script,
        scriptStatus: 'edited',
      },
      select: {
        id: true,
        generatedScript: true,
        scriptStatus: true,
      },
    });

    res.json({
      message: 'Script updated successfully',
      lead: updatedLead,
    });
  } catch (error) {
    console.error('Update script error:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

export default router;
